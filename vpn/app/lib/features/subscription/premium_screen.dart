import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/motion/tilt.dart';
import '../account/account.dart';
import '../auth/application/auth_controller.dart';
import '../home/widgets/connection_sphere.dart';
import '../vpn/domain/vpn_models.dart';
import 'billing.dart';

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  String? _selected;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(billingControllerProvider.notifier).load());
  }

  static String _periodLabel(String iso) => switch (iso) {
        'P1M' => 'per month',
        'P1Y' => 'per year',
        'P3M' => 'every 3 months',
        'P6M' => 'every 6 months',
        'P1W' => 'per week',
        _ => iso,
      };

  static String _trialLabel(String iso) => switch (iso) {
        'P1W' => '1-week free trial',
        'P3D' => '3-day free trial',
        'P1M' => '1-month free trial',
        _ => 'Free trial',
      };

  /// Real saving computed from Play's prices for the user's currency.
  static int? _yearlySaving(List<PlanOffer> offers) {
    PlanOffer? m, y;
    for (final o in offers) {
      if (o.period == 'P1M') m = o;
      if (o.period == 'P1Y') y = o;
    }
    if (m == null || y == null || m.details.currencyCode != y.details.currencyCode) return null;
    final monthlyYear = m.details.rawPrice * 12;
    if (monthlyYear <= 0) return null;
    final pct = ((1 - y.details.rawPrice / monthlyYear) * 100).round();
    return pct > 0 ? pct : null;
  }

  @override
  Widget build(BuildContext context) {
    final billing = ref.watch(billingControllerProvider);
    final account = ref.watch(accountProvider).value;
    final catalog = ref.watch(planCatalogProvider).value;
    final signedIn = ref.watch(authControllerProvider).value != null;
    final premium = account?.subscription.isPremium ?? false;
    final saving = _yearlySaving(billing.offers);
    final selected = billing.offers.where((o) => o.basePlanId == _selected).firstOrNull ??
        billing.offers.where((o) => o.period == 'P1Y').firstOrNull ??
        billing.offers.firstOrNull;

    return OPage(
      title: 'Orvane Premium',
      slivers: [
        const SliverToBoxAdapter(
          child: ExcludeSemantics(
            child: SizedBox(
              height: 210,
              child: Center(child: IgnorePointer(child: ConnectionSphere(phase: VpnPhase.connecting, onPressed: null, size: 190))),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Text(
            premium ? 'You have every location.' : 'Every location. Every device you use.',
            style: OType.title2,
            textAlign: TextAlign.center,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: OSpace.lg)),
        SliverToBoxAdapter(
          child: Tilt3D(
            maxAngle: 0.04,
            child: GlassSurface(
              child: Column(children: [
                const _Feature(icon: Icons.public_rounded, text: 'All premium locations, alongside the free ones'),
                _Feature(
                  icon: Icons.devices_rounded,
                  text: catalog == null
                      ? 'More devices on one account'
                      : 'Up to ${catalog.premiumDeviceLimit} devices (Free: ${catalog.freeDeviceLimit})',
                ),
                const _Feature(icon: Icons.shield_rounded, text: 'Same WireGuard encryption and no-activity-logs policy as Free'),
              ]),
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: OSpace.lg)),
        if (premium && account != null)
          SliverToBoxAdapter(
            child: ONotice(
              title: 'Premium is active',
              message: 'Manage or cancel your subscription in Google Play.',
              color: OColors.success,
              icon: Icons.verified_rounded,
              actionLabel: 'Manage in Google Play',
              onAction: () => launchUrl(
                Uri.parse(
                  'https://play.google.com/store/account/subscriptions?package=app.orvane.vpn'
                  '${catalog != null ? '&sku=${catalog.productId}' : ''}',
                ),
                mode: LaunchMode.externalApplication,
              ),
            ),
          )
        else
          ...switch (billing.phase) {
            BillingPhase.idle || BillingPhase.loading => [
                const SliverToBoxAdapter(child: Padding(padding: EdgeInsets.all(OSpace.xl), child: Center(child: OSpinner()))),
              ],
            BillingPhase.unavailable => [
                SliverToBoxAdapter(
                  child: ONotice(
                    title: 'Plans unavailable',
                    message: billing.message ?? 'Google Play Billing is unavailable.',
                    color: OColors.warning,
                    icon: Icons.info_outline_rounded,
                  ),
                ),
              ],
            _ => [
                for (final o in billing.offers)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: OSpace.xs),
                      child: _PlanCard(
                        offer: o,
                        selected: o == selected,
                        periodLabel: _periodLabel(o.period),
                        badge: o.period == 'P1Y' && saving != null ? 'Save $saving%' : null,
                        trial: o.trial == null ? null : _trialLabel(o.trial!),
                        onTap: () => setState(() => _selected = o.basePlanId),
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: OSpace.sm)),
                SliverToBoxAdapter(
                  child: OButton(
                    label: !signedIn ? 'Sign in to subscribe' : (selected?.trial != null ? 'Start free trial' : 'Subscribe'),
                    loading: billing.phase == BillingPhase.purchasing || billing.phase == BillingPhase.verifying,
                    onPressed: selected == null
                        ? null
                        : () => signedIn ? ref.read(billingControllerProvider.notifier).buy(selected) : context.push('/auth'),
                  ),
                ),
              ],
          },
        if (billing.message != null && billing.phase != BillingPhase.unavailable)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: OSpace.md),
              child: ONotice(
                message: billing.message!,
                color: billing.success ? OColors.success : OColors.ice,
                icon: billing.success ? Icons.verified_rounded : Icons.info_outline_rounded,
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: OSpace.sm),
            child: OButton(
              label: 'Restore purchases',
              variant: OButtonVariant.ghost,
              onPressed: billing.phase == BillingPhase.ready && signedIn ? ref.read(billingControllerProvider.notifier).restore : null,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Text(
            'Subscriptions renew automatically at the price shown until cancelled. Cancel any time in Google Play at least 24 hours before renewal. '
            'Payment is charged to your Google Play account.',
            style: OType.caption.copyWith(color: OColors.textFaint),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            Icon(icon, size: 20, color: OColors.ice),
            const SizedBox(width: OSpace.sm),
            Expanded(child: Text(text, style: OType.callout)),
          ],
        ),
      );
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.offer,
    required this.selected,
    required this.periodLabel,
    required this.onTap,
    this.badge,
    this.trial,
  });

  final PlanOffer offer;
  final bool selected;
  final String periodLabel;
  final String? badge;
  final String? trial;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = offer.period == 'P1Y' ? 'Yearly' : (offer.period == 'P1M' ? 'Monthly' : offer.basePlanId);
    return Pressable(
      onTap: onTap,
      selected: selected,
      pressedScale: 0.98,
      semanticLabel: '$name, ${offer.price} $periodLabel${trial != null ? ', $trial' : ''}',
      child: AnimatedScale(
        duration: OMotion.standard,
        curve: OMotion.settle,
        scale: selected ? 1 : 0.98,
        child: GlassSurface(
          tint: selected ? OColors.blue : null,
          elevation: selected ? OElevation.high : OElevation.low,
          child: Row(
            children: [
              AnimatedContainer(
                duration: OMotion.quick,
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: selected ? OColors.blue : OColors.textFaint, width: selected ? 7 : 1.5),
                ),
              ),
              const SizedBox(width: OSpace.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Text(name, style: OType.bodyStrong),
                      if (badge != null) ...[
                        const SizedBox(width: OSpace.xs),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(borderRadius: ORadius.chip, color: OColors.success.withValues(alpha: 0.16)),
                          child: Text(badge!, style: OType.caption.copyWith(color: OColors.success)),
                        ),
                      ],
                    ]),
                    if (trial != null) Text(trial!, style: OType.footnote.copyWith(color: OColors.ice)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(offer.price, style: OType.metricSmall),
                  Text(periodLabel, style: OType.caption),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
