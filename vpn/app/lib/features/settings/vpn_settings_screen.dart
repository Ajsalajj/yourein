import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../vpn/application/vpn_controller.dart';
import '../vpn/domain/vpn_models.dart';
import 'app_settings.dart';

class VpnSettingsScreen extends ConsumerWidget {
  const VpnSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(settingsProvider);
    final n = ref.read(settingsProvider.notifier);
    final engine = ref.watch(vpnEngineProvider);
    final active = ref.watch(vpnControllerProvider.select((v) => v.phase != VpnPhase.disconnected && v.phase != VpnPhase.error));

    Widget group(List<Widget> rows) {
      final items = <Widget>[];
      for (var i = 0; i < rows.length; i++) {
        if (i > 0) items.add(const Divider(indent: OSpace.md + 34 + OSpace.sm, height: 1));
        items.add(rows[i]);
      }
      return GlassSurface(padding: EdgeInsets.zero, elevation: OElevation.low, child: Column(children: items));
    }

    return OPage(
      title: 'VPN settings',
      slivers: [
        if (active)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.only(top: OSpace.xs),
              child: ONotice(
                message: 'Routing changes apply the next time you connect.',
                color: OColors.ice,
                icon: Icons.info_outline_rounded,
              ),
            ),
          ),
        const SliverToBoxAdapter(child: SectionLabel('Connection')),
        SliverToBoxAdapter(
          child: group([
            OSwitchRow(
              icon: Icons.play_circle_outline_rounded,
              title: 'Connect when Orvane opens',
              subtitle: 'Connects to your selected location at launch',
              value: s.connectOnLaunch,
              onChanged: n.setConnectOnLaunch,
            ),
          ]),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Leak protection')),
        SliverToBoxAdapter(
          child: group([
            OSwitchRow(
              icon: Icons.lan_rounded,
              title: 'Block IPv6 outside the tunnel',
              subtitle: 'Sends all IPv6 into the tunnel even if the server has no IPv6, so it can’t leak',
              value: s.blockIpv6Leaks,
              onChanged: n.setBlockIpv6Leaks,
            ),
            OSwitchRow(
              icon: Icons.router_rounded,
              title: 'Allow local network',
              subtitle: 'Printers, casting and other devices on your Wi‑Fi bypass the tunnel',
              value: s.excludeLan,
              onChanged: n.setExcludeLan,
            ),
            const OListRow(
              icon: Icons.dns_rounded,
              title: 'DNS',
              subtitle: 'Queries go through the tunnel to the resolver of the server you’re connected to',
              trailing: SizedBox.shrink(),
            ),
          ]),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Kill switch')),
        SliverToBoxAdapter(
          child: GlassSurface(
            elevation: OElevation.low,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Block traffic whenever the VPN is off', style: OType.callout),
                const SizedBox(height: 4),
                Text(
                  'Android provides this system-wide. Open VPN settings, tap the gear next to Orvane, then turn on “Always-on VPN” and “Block connections without VPN”. Apps can’t switch it on themselves.',
                  style: OType.footnote,
                ),
                const SizedBox(height: OSpace.md),
                OButton(
                  label: 'Open Android VPN settings',
                  icon: Icons.open_in_new_rounded,
                  variant: OButtonVariant.secondary,
                  onPressed: engine.isSupported ? engine.openSystemVpnSettings : null,
                ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Protocol')),
        const SliverToBoxAdapter(
          child: OListGroup(children: [
            OListRow(
              icon: Icons.shield_rounded,
              title: 'WireGuard',
              subtitle: 'The only protocol Orvane uses. Keys are Curve25519; traffic is ChaCha20-Poly1305.',
              trailing: SizedBox.shrink(),
            ),
          ]),
        ),
      ],
    );
  }
}
