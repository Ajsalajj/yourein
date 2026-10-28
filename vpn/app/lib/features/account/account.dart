import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../auth/application/auth_controller.dart';

enum PlanTier { free, premium }

@immutable
class Device {
  const Device({required this.id, required this.name, required this.platform, required this.createdAt, this.lastSeenAt});

  final String id;
  final String name;
  final String platform;
  final DateTime createdAt;
  final DateTime? lastSeenAt;

  factory Device.fromJson(Map<String, dynamic> j) => Device(
        id: j['id'] as String,
        name: j['name'] as String,
        platform: j['platform'] as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
        lastSeenAt: j['lastSeenAt'] == null ? null : DateTime.parse(j['lastSeenAt'] as String),
      );
}

@immutable
class Subscription {
  const Subscription({required this.tier, required this.status, this.productId, this.renewsAt, this.expiresAt, this.store});

  final PlanTier tier;

  /// `active`, `grace`, `on_hold`, `canceled` (active until expiry), `expired`, or `none`.
  final String status;
  final String? productId;
  final DateTime? renewsAt;
  final DateTime? expiresAt;
  final String? store;

  bool get isPremium => tier == PlanTier.premium;

  factory Subscription.fromJson(Map<String, dynamic> j) => Subscription(
        tier: j['tier'] == 'premium' ? PlanTier.premium : PlanTier.free,
        status: j['status'] as String? ?? 'none',
        productId: j['productId'] as String?,
        renewsAt: j['renewsAt'] == null ? null : DateTime.parse(j['renewsAt'] as String),
        expiresAt: j['expiresAt'] == null ? null : DateTime.parse(j['expiresAt'] as String),
        store: j['store'] as String?,
      );

  static const free = Subscription(tier: PlanTier.free, status: 'none');
}

@immutable
class Account {
  const Account({required this.userId, required this.email, required this.subscription, required this.devices, required this.deviceLimit});

  final String userId;
  final String email;
  final Subscription subscription;
  final List<Device> devices;
  final int deviceLimit;

  factory Account.fromJson(Map<String, dynamic> j) => Account(
        userId: j['id'] as String,
        email: j['email'] as String,
        subscription: Subscription.fromJson(j['subscription'] as Map<String, dynamic>),
        devices: (j['devices'] as List).cast<Map<String, dynamic>>().map(Device.fromJson).toList(),
        deviceLimit: (j['deviceLimit'] as num).toInt(),
      );
}

/// The signed-in user's account from the backend (null when signed out).
final accountProvider = FutureProvider<Account?>((ref) async {
  final session = await ref.watch(authControllerProvider.future);
  final api = ref.watch(apiClientProvider);
  if (session == null || api == null) return null;
  final j = await api.get('/v1/me') as Map<String, dynamic>;
  return Account.fromJson(j);
}, retry: (_, _) => null);

/// Whether the user currently holds a premium entitlement, as verified by
/// the backend. Never derived from local purchase state alone.
final isPremiumProvider = Provider<bool>((ref) => ref.watch(accountProvider).value?.subscription.isPremium ?? false);
