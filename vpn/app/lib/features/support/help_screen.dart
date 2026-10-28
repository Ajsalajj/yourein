import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/dialogs.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/providers.dart';
import '../vpn/application/vpn_controller.dart';

const _faq = [
  (
    'Why does Android ask for VPN permission?',
    'Android requires every VPN app to get your approval once before it can create a tunnel. It’s a system dialog, and you can revoke it in Settings at any time.'
  ),
  (
    'What does the sphere’s colour mean?',
    'Dim blue is disconnected, orbiting rings mean a connection is being set up, bright blue with a green flash means the server completed an encrypted handshake. We never show “Protected” before that handshake.'
  ),
  (
    'How do I stop all traffic if the VPN drops?',
    'Use Android’s built-in kill switch: VPN settings → Orvane → Always-on VPN and Block connections without VPN. The link is in Orvane’s VPN settings.'
  ),
  (
    'How is latency measured?',
    'Your phone times a connection to each server’s probe port. It reflects your network right now, so it changes as you move between Wi‑Fi and mobile data.'
  ),
  (
    'Some apps don’t work while connected',
    'A few services block VPN traffic. Try another location. Local devices like printers need “Allow local network” in VPN settings.'
  ),
  (
    'How do I cancel Premium?',
    'Subscriptions are managed by Google Play: Play Store → Profile → Payments & subscriptions → Subscriptions. Deleting your Orvane account doesn’t cancel billing on its own.'
  ),
];

class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> {
  int? _open;

  Future<String> _diagnostics() async {
    final engine = ref.read(vpnEngineProvider);
    final vpn = ref.read(vpnControllerProvider);
    final d = <String, Object?>{
      'phase': vpn.phase.name,
      if (vpn.error != null) 'lastError': vpn.error!.kind.name,
      'lastHandshake': vpn.stats?.lastHandshake?.toIso8601String(),
      ...await engine.diagnostics(),
    };
    return const JsonEncoder.withIndent('  ').convert(d);
  }

  @override
  Widget build(BuildContext context) {
    final email = ref.watch(appConfigProvider).supportEmail;
    return OPage(
      title: 'Help & support',
      slivers: [
        const SliverToBoxAdapter(child: SectionLabel('Common questions')),
        SliverList.separated(
          itemCount: _faq.length,
          separatorBuilder: (_, _) => const SizedBox(height: OSpace.xs),
          itemBuilder: (context, i) {
            final open = _open == i;
            return Pressable(
              onTap: () => setState(() => _open = open ? null : i),
              pressedScale: 0.985,
              semanticLabel: _faq[i].$1,
              semanticHint: open ? 'Collapse' : 'Expand',
              child: GlassSurface(
                elevation: OElevation.low,
                tint: open ? OColors.blue : null,
                child: AnimatedSize(
                  duration: OMotion.standard,
                  curve: OMotion.enter,
                  alignment: Alignment.topCenter,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(child: Text(_faq[i].$1, style: OType.callout.copyWith(fontWeight: FontWeight.w600))),
                        AnimatedRotation(
                          turns: open ? 0.5 : 0,
                          duration: OMotion.standard,
                          curve: OMotion.enter,
                          child: const Icon(Icons.expand_more_rounded, color: OColors.textMuted),
                        ),
                      ]),
                      if (open) ...[
                        const SizedBox(height: OSpace.xs),
                        Text(_faq[i].$2, style: OType.footnote.copyWith(fontSize: 14)),
                      ],
                    ],
                  ),
                ),
              ),
            );
          },
        ),
        const SliverToBoxAdapter(child: SectionLabel('Diagnostics')),
        SliverToBoxAdapter(
          child: GlassSurface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Copies connection state, app and Android version, and network type. No keys, IP addresses or account details are included.',
                  style: OType.footnote,
                ),
                const SizedBox(height: OSpace.md),
                OButton(
                  label: 'Copy diagnostics',
                  icon: Icons.content_copy_rounded,
                  variant: OButtonVariant.secondary,
                  onPressed: () async {
                    final text = await _diagnostics();
                    await Clipboard.setData(ClipboardData(text: text));
                    if (context.mounted) showOToast(context, 'Diagnostics copied.');
                  },
                ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Contact')),
        SliverToBoxAdapter(
          child: OListGroup(children: [
            OListRow(
              icon: Icons.mail_rounded,
              title: 'Email support',
              subtitle: email.isEmpty ? 'Support address not configured for this build' : email,
              onTap: email.isEmpty
                  ? null
                  : () => launchUrl(Uri(scheme: 'mailto', path: email, queryParameters: {'subject': 'Orvane support'})),
            ),
          ]),
        ),
      ],
    );
  }
}
