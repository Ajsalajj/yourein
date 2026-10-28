import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/dialogs.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/net/api_client.dart';
import '../../core/providers.dart';
import '../auth/application/auth_controller.dart';
import '../servers/application/server_providers.dart';
import '../vpn/application/vpn_controller.dart';
import '../vpn/data/vpn_engine.dart';

class PrivacyScreen extends ConsumerStatefulWidget {
  const PrivacyScreen({super.key});

  @override
  ConsumerState<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends ConsumerState<PrivacyScreen> {
  bool _rotating = false;

  Future<void> _rotateKey() async {
    final ok = await showOConfirm(
      context,
      title: 'Create a new device key?',
      message: 'The VPN disconnects, this phone gets a fresh key pair, and the old key is revoked on every server.',
      confirmLabel: 'Rotate key',
    );
    if (!ok || !mounted) return;
    setState(() => _rotating = true);
    final engine = ref.read(vpnEngineProvider);
    final api = ref.read(apiClientProvider);
    try {
      await ref.read(vpnControllerProvider.notifier).disconnect();
      final oldKey = await engine.publicKey();
      final newKey = await engine.rotateKey();
      if (api != null && ref.read(authControllerProvider).value != null) {
        await api.post('/v1/devices/rotate', {'oldPublicKey': oldKey, 'newPublicKey': newKey});
      }
      if (mounted) showOToast(context, 'New device key created.', color: OColors.success);
    } on EngineException {
      if (mounted) showOToast(context, 'Couldn’t create a new key on this device.', color: OColors.error);
    } on ApiException {
      if (mounted) {
        showOToast(context, 'New key created, but the old one couldn’t be revoked online. Remove the old device from Account.', color: OColors.warning);
      }
    } finally {
      if (mounted) setState(() => _rotating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = ref.watch(appConfigProvider);
    final engine = ref.watch(vpnEngineProvider);

    return OPage(
      title: 'Privacy & security',
      slivers: [
        const SliverToBoxAdapter(child: SectionLabel('What Orvane never keeps')),
        SliverToBoxAdapter(
          child: GlassSurface(
            tint: OColors.success,
            child: Column(children: const [
              _Line(icon: Icons.block_rounded, color: OColors.success, text: 'Websites you visit, DNS queries or traffic contents'),
              _Line(icon: Icons.block_rounded, color: OColors.success, text: 'Connection timestamps or your IP address in logs'),
              _Line(icon: Icons.block_rounded, color: OColors.success, text: 'Your device’s private key — it never leaves this phone'),
            ]),
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('What we store to run the service')),
        SliverToBoxAdapter(
          child: GlassSurface(
            child: Column(children: const [
              _Line(icon: Icons.alternate_email_rounded, text: 'Your account email and password hash (via Supabase Auth)'),
              _Line(icon: Icons.devices_rounded, text: 'Device names, public keys and assigned tunnel addresses'),
              _Line(icon: Icons.receipt_long_rounded, text: 'Subscription status from Google Play'),
              _Line(icon: Icons.memory_rounded, text: 'While connected, the gateway holds your current IP in memory only, as WireGuard requires'),
            ]),
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Device key')),
        SliverToBoxAdapter(
          child: GlassSurface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Generated on this phone and stored encrypted with a key held by Android Keystore. Only the public half is sent to Orvane.',
                  style: OType.footnote,
                ),
                const SizedBox(height: OSpace.md),
                OButton(
                  label: 'Rotate device key',
                  icon: Icons.autorenew_rounded,
                  variant: OButtonVariant.secondary,
                  loading: _rotating,
                  onPressed: engine.isSupported ? _rotateKey : null,
                ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Documents')),
        SliverToBoxAdapter(
          child: OListGroup(children: [
            OListRow(
              icon: Icons.policy_rounded,
              title: 'Privacy policy',
              subtitle: config.privacyPolicyUrl.isEmpty ? 'Not configured for this build' : null,
              onTap: config.privacyPolicyUrl.isEmpty
                  ? null
                  : () => launchUrl(Uri.parse(config.privacyPolicyUrl), mode: LaunchMode.externalApplication),
            ),
            OListRow(
              icon: Icons.gavel_rounded,
              title: 'Terms of service',
              subtitle: config.termsUrl.isEmpty ? 'Not configured for this build' : null,
              onTap: config.termsUrl.isEmpty ? null : () => launchUrl(Uri.parse(config.termsUrl), mode: LaunchMode.externalApplication),
            ),
          ]),
        ),
        const SliverToBoxAdapter(child: SectionLabel('This device')),
        SliverToBoxAdapter(
          child: OButton(
            label: 'Clear favorites and preferences',
            variant: OButtonVariant.destructive,
            onPressed: () async {
              final ok = await showOConfirm(
                context,
                title: 'Clear local data?',
                message: 'Removes favorites, your selected location and app preferences from this phone. Your account and device key are kept.',
                confirmLabel: 'Clear',
                destructive: true,
              );
              if (!ok) return;
              final prefs = ref.read(sharedPrefsProvider);
              for (final k in prefs.getKeys().where((k) => k.startsWith('servers.') || k.startsWith('settings.'))) {
                await prefs.remove(k);
              }
              await prefs.setBool('settings.onboardingDone', true);
              ref.invalidate(sharedPrefsProvider);
              if (context.mounted) showOToast(context, 'Local data cleared.');
            },
          ),
        ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.icon, required this.text, this.color = OColors.ice});
  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: OSpace.sm),
            Expanded(child: Text(text, style: OType.callout)),
          ],
        ),
      );
}
