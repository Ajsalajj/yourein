import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/dialogs.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/format.dart';
import '../../core/net/api_client.dart';
import '../../core/providers.dart';
import '../auth/application/auth_controller.dart';
import '../settings/app_settings.dart';
import '../vpn/application/vpn_controller.dart';
import 'account.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).value;
    final account = ref.watch(accountProvider);
    final settings = ref.watch(settingsProvider);

    return OPage(
      title: 'Account',
      standalone: false,
      slivers: [
        SliverToBoxAdapter(
          child: session == null
              ? GlassSurface(
                  elevation: OElevation.high,
                  padding: const EdgeInsets.all(OSpace.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('You’re not signed in', style: OType.title3),
                      const SizedBox(height: 4),
                      Text('Sign in to connect, manage devices and your subscription.', style: OType.subhead),
                      const SizedBox(height: OSpace.md),
                      OButton(label: 'Sign in or create account', onPressed: () => context.push('/auth')),
                    ],
                  ),
                )
              : _ProfileHeader(email: session.email, account: account.value),
        ),
        if (session != null) ...[
          const SliverToBoxAdapter(child: SectionLabel('Subscription')),
          SliverToBoxAdapter(child: _SubscriptionCard(account: account)),
          SliverToBoxAdapter(
            child: SectionLabel(
              'Devices',
              trailing: account.value == null
                  ? null
                  : Text('${account.value!.devices.length} of ${account.value!.deviceLimit}', style: OType.caption),
            ),
          ),
          SliverToBoxAdapter(child: _Devices(account: account)),
        ],
        const SliverToBoxAdapter(child: SectionLabel('Settings')),
        SliverToBoxAdapter(
          child: OListGroup(children: [
            OListRow(icon: Icons.tune_rounded, title: 'VPN settings', subtitle: 'Routing, leak protection, kill switch', onTap: () => context.push('/settings/vpn')),
            OListRow(icon: Icons.lock_rounded, title: 'Privacy & security', subtitle: 'Data, device key, permissions', onTap: () => context.push('/settings/privacy')),
            OListRow(icon: Icons.help_rounded, title: 'Help & support', subtitle: 'Answers, diagnostics, contact', onTap: () => context.push('/help')),
          ]),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Experience')),
        SliverToBoxAdapter(
          child: GlassSurface(
            padding: EdgeInsets.zero,
            elevation: OElevation.low,
            child: Column(children: [
              OSwitchRow(
                icon: Icons.animation_rounded,
                title: 'Reduce motion',
                subtitle: 'Turns off parallax, floating and ambient animation',
                value: settings.reduceMotion,
                onChanged: ref.read(settingsProvider.notifier).setReduceMotion,
              ),
              const Divider(indent: OSpace.md + 34 + OSpace.sm, height: 1),
              OSwitchRow(
                icon: Icons.vibration_rounded,
                title: 'Haptics',
                subtitle: 'Subtle feedback on taps and connection changes',
                value: settings.haptics,
                onChanged: ref.read(settingsProvider.notifier).setHaptics,
              ),
            ]),
          ),
        ),
        if (session != null) ...[
          const SliverToBoxAdapter(child: SizedBox(height: OSpace.xl)),
          SliverToBoxAdapter(
            child: OButton(
              label: 'Sign out',
              variant: OButtonVariant.secondary,
              onPressed: () async {
                final ok = await showOConfirm(
                  context,
                  title: 'Sign out?',
                  message: 'The VPN will disconnect. Your device key stays on this phone.',
                  confirmLabel: 'Sign out',
                );
                if (!ok) return;
                await ref.read(vpnControllerProvider.notifier).disconnect();
                await ref.read(authControllerProvider.notifier).signOut();
                ref.invalidate(accountProvider);
              },
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: OSpace.xs)),
          SliverToBoxAdapter(
            child: OButton(label: 'Delete account', variant: OButtonVariant.ghost, onPressed: () => _deleteAccount(context, ref)),
          ),
        ],
      ],
    );
  }

  Future<void> _deleteAccount(BuildContext context, WidgetRef ref) async {
    final ok = await showOConfirm(
      context,
      title: 'Delete your account?',
      message:
          'This permanently deletes your account, devices and their server peers. An active Google Play subscription is not cancelled automatically — cancel it in Google Play to stop billing.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    final api = ref.read(apiClientProvider);
    if (api == null) return;
    try {
      await ref.read(vpnControllerProvider.notifier).disconnect();
      await api.delete('/v1/me');
      await ref.read(authControllerProvider.notifier).clearAfterAccountDeletion();
      ref.invalidate(accountProvider);
      if (context.mounted) showOToast(context, 'Your account has been deleted.', color: OColors.success);
    } on ApiException {
      if (context.mounted) showOToast(context, 'Couldn’t delete the account. Try again.', color: OColors.error);
    }
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.email, required this.account});
  final String email;
  final Account? account;

  @override
  Widget build(BuildContext context) {
    final premium = account?.subscription.isPremium ?? false;
    return GlassSurface(
      elevation: OElevation.high,
      padding: const EdgeInsets.all(OSpace.lg),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [OColors.blue, Color(0xFF243B7A)]),
              boxShadow: OElevation.glow(OColors.blue, strength: 0.6),
            ),
            child: Text(email.isEmpty ? '?' : email[0].toUpperCase(), style: OType.title2),
          ),
          const SizedBox(width: OSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(email, style: OType.bodyStrong, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                StatusPill(label: premium ? 'Premium' : 'Free plan', color: premium ? OColors.ice : OColors.textMuted),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.account});
  final AsyncValue<Account?> account;

  @override
  Widget build(BuildContext context) {
    final sub = account.value?.subscription;
    final String title, detail;
    if (account.isLoading) {
      title = 'Checking subscription…';
      detail = '';
    } else if (account.hasError || sub == null) {
      title = 'Subscription unavailable';
      detail = 'Couldn’t reach the account service.';
    } else if (sub.isPremium) {
      title = 'Orvane Premium';
      detail = switch (sub.status) {
        'canceled' => 'Ends ${sub.expiresAt == null ? 'at period end' : Fmt.date(sub.expiresAt!)} — won’t renew',
        'grace' => 'Payment issue — fix it in Google Play to keep Premium',
        _ => sub.renewsAt == null ? 'Active' : 'Renews ${Fmt.date(sub.renewsAt!)}',
      };
    } else {
      title = 'Free plan';
      detail = 'Free locations on one device. Upgrade for every location.';
    }
    return Pressable(
      onTap: () => context.push('/premium'),
      pressedScale: 0.98,
      semanticLabel: '$title. $detail',
      child: GlassSurface(
        tint: sub?.isPremium == true ? OColors.blue : null,
        child: Row(
          children: [
            const Icon(Icons.workspace_premium_rounded, color: OColors.ice),
            const SizedBox(width: OSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: OType.bodyStrong),
                  if (detail.isNotEmpty) ...[const SizedBox(height: 2), Text(detail, style: OType.footnote)],
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: OColors.textFaint),
          ],
        ),
      ),
    );
  }
}

class _Devices extends ConsumerWidget {
  const _Devices({required this.account});
  final AsyncValue<Account?> account;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devices = account.value?.devices;
    if (devices == null) {
      return account.isLoading
          ? const Padding(padding: EdgeInsets.all(OSpace.lg), child: Center(child: OSpinner()))
          : Text('Device list unavailable.', style: OType.footnote);
    }
    if (devices.isEmpty) {
      return Text('No devices yet. This phone is registered the first time you connect.', style: OType.footnote);
    }
    return OListGroup(children: [
      for (final d in devices)
        OListRow(
          icon: Icons.smartphone_rounded,
          title: d.name,
          subtitle: 'Added ${Fmt.date(d.createdAt)} · last seen ${Fmt.ago(d.lastSeenAt)}',
          trailing: IconButton(
            tooltip: 'Remove ${d.name}',
            icon: const Icon(Icons.remove_circle_outline_rounded, color: OColors.error, size: 20),
            onPressed: () async {
              final ok = await showOConfirm(
                context,
                title: 'Remove ${d.name}?',
                message: 'Its key is revoked on every server immediately. It can be added again by connecting from it.',
                confirmLabel: 'Remove device',
                destructive: true,
              );
              if (!ok) return;
              try {
                await ref.read(apiClientProvider)?.delete('/v1/devices/${d.id}');
                ref.invalidate(accountProvider);
              } on ApiException {
                if (context.mounted) showOToast(context, 'Couldn’t remove the device. Try again.', color: OColors.error);
              }
            },
          ),
        ),
    ]);
  }
}
