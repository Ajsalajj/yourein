import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import '../../core/net/api_client.dart';
import '../../core/providers.dart';
import '../account/account.dart';
import '../auth/application/auth_controller.dart';

/// Commercial configuration served by the backend so plans can change
/// without an app release. Prices are never part of it: they always come
/// from Google Play, localised for the user.
@immutable
class PlanCatalog {
  const PlanCatalog({
    required this.productId,
    required this.monthlyBasePlan,
    required this.yearlyBasePlan,
    required this.freeDeviceLimit,
    required this.premiumDeviceLimit,
  });

  final String productId;
  final String monthlyBasePlan;
  final String yearlyBasePlan;
  final int freeDeviceLimit;
  final int premiumDeviceLimit;

  factory PlanCatalog.fromJson(Map<String, dynamic> j) => PlanCatalog(
        productId: j['productId'] as String,
        monthlyBasePlan: j['monthlyBasePlan'] as String,
        yearlyBasePlan: j['yearlyBasePlan'] as String,
        freeDeviceLimit: (j['freeDeviceLimit'] as num).toInt(),
        premiumDeviceLimit: (j['premiumDeviceLimit'] as num).toInt(),
      );
}

final planCatalogProvider = FutureProvider<PlanCatalog?>((ref) async {
  final api = ref.watch(apiClientProvider);
  if (api == null) return null;
  return PlanCatalog.fromJson(await api.get('/v1/plans') as Map<String, dynamic>);
}, retry: (_, _) => null);

/// A purchasable base plan with its Play-provided price.
@immutable
class PlanOffer {
  const PlanOffer({required this.basePlanId, required this.price, required this.period, required this.details, this.offerToken, this.trial});

  final String basePlanId;
  final String price;

  /// ISO-8601 billing period from Play, e.g. P1M, P1Y.
  final String period;
  final ProductDetails details;
  final String? offerToken;

  /// Free-trial period if Play reports one for this offer.
  final String? trial;
}

enum BillingPhase { idle, loading, unavailable, ready, purchasing, verifying }

@immutable
class BillingState {
  const BillingState({this.phase = BillingPhase.idle, this.offers = const [], this.message, this.success = false});

  final BillingPhase phase;
  final List<PlanOffer> offers;
  final String? message;
  final bool success;

  BillingState copyWith({BillingPhase? phase, List<PlanOffer>? offers, String? Function()? message, bool? success}) => BillingState(
        phase: phase ?? this.phase,
        offers: offers ?? this.offers,
        message: message != null ? message() : this.message,
        success: success ?? this.success,
      );
}

bool get _billingSupported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

/// Google Play Billing integration.
///
/// The purchase stream is subscribed at app start (Play redelivers
/// unacknowledged purchases there). Every purchase token is sent to the
/// backend, which verifies it with the Google Play Developer API and grants
/// the entitlement; only then is the purchase completed locally.
class BillingController extends Notifier<BillingState> {
  StreamSubscription<List<PurchaseDetails>>? _sub;

  InAppPurchase get _iap => InAppPurchase.instance;

  @override
  BillingState build() {
    if (_billingSupported) {
      _sub = _iap.purchaseStream.listen(_onPurchases, onError: (Object _) {});
      ref.onDispose(() => _sub?.cancel());
    }
    return const BillingState();
  }

  Future<void> load() async {
    if (!_billingSupported) {
      state = const BillingState(phase: BillingPhase.unavailable, message: 'Purchases are made through Google Play on Android.');
      return;
    }
    state = state.copyWith(phase: BillingPhase.loading, message: () => null);
    if (!await _iap.isAvailable()) {
      state = const BillingState(phase: BillingPhase.unavailable, message: 'Google Play Billing isn’t available on this device.');
      return;
    }
    final PlanCatalog? catalog;
    try {
      catalog = await ref.read(planCatalogProvider.future);
    } on Object {
      state = const BillingState(phase: BillingPhase.unavailable, message: 'Couldn’t load plans. Check your connection.');
      return;
    }
    if (catalog == null) {
      state = const BillingState(phase: BillingPhase.unavailable, message: 'This build isn’t connected to the Orvane service.');
      return;
    }
    final res = await _iap.queryProductDetails({catalog.productId});
    final offers = <PlanOffer>[];
    for (final p in res.productDetails.whereType<GooglePlayProductDetails>()) {
      final idx = p.subscriptionIndex;
      final offerDetails = p.productDetails.subscriptionOfferDetails;
      if (idx == null || offerDetails == null) continue;
      final offer = offerDetails[idx];
      final isBase = offer.offerId == null;
      final wanted = offer.basePlanId == catalog.monthlyBasePlan || offer.basePlanId == catalog.yearlyBasePlan;
      // Prefer the store's intro offer (e.g. trial) when one exists; otherwise the base plan.
      final existing = offers.indexWhere((o) => o.basePlanId == offer.basePlanId);
      if (!wanted || (existing >= 0 && isBase)) continue;
      final recurring = offer.pricingPhases.last;
      final first = offer.pricingPhases.first;
      final o = PlanOffer(
        basePlanId: offer.basePlanId,
        price: recurring.formattedPrice,
        period: recurring.billingPeriod,
        details: p,
        offerToken: offer.offerIdToken,
        trial: first.priceAmountMicros == 0 && offer.pricingPhases.length > 1 ? first.billingPeriod : null,
      );
      if (existing >= 0) {
        offers[existing] = o;
      } else {
        offers.add(o);
      }
    }
    offers.sort((a, b) => a.basePlanId == catalog!.yearlyBasePlan ? 1 : (b.basePlanId == catalog.yearlyBasePlan ? -1 : 0));
    state = offers.isEmpty
        ? const BillingState(phase: BillingPhase.unavailable, message: 'No plans are on sale in Google Play for this account yet.')
        : BillingState(phase: BillingPhase.ready, offers: offers);
  }

  Future<void> buy(PlanOffer offer) async {
    final session = ref.read(authControllerProvider).value;
    if (session == null) {
      state = state.copyWith(message: () => 'Sign in first so Premium is linked to your account.');
      return;
    }
    state = state.copyWith(phase: BillingPhase.purchasing, message: () => null);
    final param = GooglePlayPurchaseParam(
      productDetails: offer.details,
      offerToken: offer.offerToken,
      // Lets the backend check the purchase belongs to this account.
      applicationUserName: session.userId,
    );
    try {
      await _iap.buyNonConsumable(purchaseParam: param);
    } on Object {
      state = state.copyWith(phase: BillingPhase.ready, message: () => 'Google Play couldn’t start the purchase.');
    }
  }

  Future<void> restore() async {
    if (!_billingSupported) return;
    state = state.copyWith(phase: BillingPhase.verifying, message: () => null);
    await _iap.restorePurchases();
    // Purchases (if any) arrive on the stream; refresh the entitlement
    // either way in case the backend already knows about them.
    ref.invalidate(accountProvider);
    await Future<void>.delayed(const Duration(seconds: 2));
    if (state.phase == BillingPhase.verifying) {
      state = state.copyWith(phase: BillingPhase.ready, message: () => 'Restore finished. Active subscriptions are linked to your account.');
    }
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.pending:
          state = state.copyWith(phase: BillingPhase.purchasing, message: () => 'Payment pending with Google Play.');
        case PurchaseStatus.canceled:
          state = state.copyWith(phase: BillingPhase.ready, message: () => null);
        case PurchaseStatus.error:
          state = state.copyWith(phase: BillingPhase.ready, message: () => 'The purchase didn’t complete.');
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verify(p);
      }
    }
  }

  Future<void> _verify(PurchaseDetails p) async {
    final api = ref.read(apiClientProvider);
    if (api == null) return;
    state = state.copyWith(phase: BillingPhase.verifying, message: () => null);
    try {
      await api.post('/v1/billing/google/verify', {
        'productId': p.productID,
        'purchaseToken': p.verificationData.serverVerificationData,
      });
      // Only acknowledge once our backend has accepted the token; if this
      // never happens Play refunds automatically after three days.
      if (p.pendingCompletePurchase) await _iap.completePurchase(p);
      ref.invalidate(accountProvider);
      state = state.copyWith(phase: BillingPhase.ready, success: true, message: () => 'Premium is active. Thank you.');
    } on ApiException catch (e) {
      state = state.copyWith(
        phase: BillingPhase.ready,
        message: () => e.code == 'purchase_account_mismatch'
            ? 'This Google Play subscription belongs to a different Orvane account.'
            : 'We couldn’t verify the purchase yet. It will retry next time you open the app.',
      );
    }
  }
}

final billingControllerProvider = NotifierProvider<BillingController, BillingState>(BillingController.new);
