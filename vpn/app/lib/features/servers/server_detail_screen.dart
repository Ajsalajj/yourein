import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/format.dart';
import '../../core/motion/tilt.dart';
import '../account/account.dart';
import 'application/server_providers.dart';
import 'data/latency_probe.dart';
import 'domain/server.dart';
import 'locations_screen.dart';
import 'widgets/server_visuals.dart';

class ServerDetailScreen extends ConsumerStatefulWidget {
  const ServerDetailScreen({super.key, required this.serverId});

  final String serverId;

  @override
  ConsumerState<ServerDetailScreen> createState() => _ServerDetailScreenState();
}

class _ServerDetailScreenState extends ConsumerState<ServerDetailScreen> {
  bool _measuring = false;

  Future<void> _measure(VpnServer s) async {
    setState(() => _measuring = true);
    final l = await measureLatency(s.probeHost, s.probePort);
    if (!mounted) return;
    ref.read(latencyProvider.notifier).record(s.id, l);
    setState(() => _measuring = false);
  }

  @override
  Widget build(BuildContext context) {
    final servers = ref.watch(serversProvider).value ?? const <VpnServer>[];
    VpnServer? server;
    for (final s in servers) {
      if (s.id == widget.serverId) server = s;
    }
    if (server == null) {
      return const OPage(
        title: 'Location',
        slivers: [
          SliverToBoxAdapter(
            child: OEmptyState(
              icon: Icons.location_off_rounded,
              title: 'Location not found',
              message: 'It may have been removed from the server list.',
            ),
          ),
        ],
      );
    }
    final s = server;
    final latencies = ref.watch(latencyProvider);
    final premium = ref.watch(isPremiumProvider);
    final favorite = ref.watch(favoritesProvider).contains(s.id);
    final locked = s.isPremium && !premium;

    return OPage(
      title: s.city,
      subtitle: s.countryName,
      actions: [
        OIconButton(
          icon: favorite ? Icons.star_rounded : Icons.star_outline_rounded,
          semanticLabel: favorite ? 'Remove from favorites' : 'Add to favorites',
          size: 40,
          active: favorite,
          onPressed: () => ref.read(favoritesProvider.notifier).toggle(s.id),
        ),
      ],
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: OSpace.xl),
            child: Center(
              child: Tilt3D(
                maxAngle: 0.12,
                depth: 2,
                child: Container(
                  width: 132,
                  height: 132,
                  decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: OElevation.glow(OColors.blue, strength: 0.8)),
                  child: ServerFlag(server: s, size: 132),
                ),
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Row(
            children: [
              Expanded(
                child: _Fact(
                  label: 'Latency',
                  value: !latencies.containsKey(s.id) ? '—' : (latencies[s.id] == null ? 'No reply' : Fmt.latency(latencies[s.id])),
                  footnote: 'Measured from this device',
                ),
              ),
              const SizedBox(width: OSpace.xs),
              Expanded(
                child: _Fact(
                  label: 'Status',
                  value: switch (s.availability) {
                    ServerAvailability.online => 'Online',
                    ServerAvailability.maintenance => 'Maintenance',
                    ServerAvailability.offline => 'Offline',
                  },
                  color: s.isOnline ? OColors.success : OColors.warning,
                  footnote: s.loadPercent != null ? 'Load ${s.loadPercent}%' : 'Load not reported',
                ),
              ),
            ],
          ),
        ),
        const SliverToBoxAdapter(child: SectionLabel('Connection')),
        SliverToBoxAdapter(
          child: OListGroup(children: [
            const OListRow(icon: Icons.shield_rounded, title: 'Protocol', subtitle: 'WireGuard', trailing: SizedBox.shrink()),
            const OListRow(
              icon: Icons.key_rounded,
              title: 'Encryption',
              subtitle: 'ChaCha20-Poly1305 with Curve25519 key exchange',
              trailing: SizedBox.shrink(),
            ),
            OListRow(
              icon: Icons.workspace_premium_rounded,
              title: 'Plan',
              subtitle: s.isPremium ? 'Premium location' : 'Included in Free',
              trailing: s.isPremium ? const PremiumBadge() : const SizedBox.shrink(),
            ),
          ]),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: OSpace.xl),
            child: Column(
              children: [
                OButton(
                  label: locked ? 'Unlock with Premium' : 'Connect here',
                  icon: locked ? Icons.lock_open_rounded : Icons.power_settings_new_rounded,
                  onPressed: s.isOnline || locked ? () => chooseServer(context, ref, s) : null,
                ),
                const SizedBox(height: OSpace.xs),
                OButton(
                  label: 'Measure latency again',
                  variant: OButtonVariant.ghost,
                  loading: _measuring,
                  onPressed: s.isOnline && LatencyNotifier.supported ? () => _measure(s) : null,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value, required this.footnote, this.color = OColors.text});

  final String label;
  final String value;
  final String footnote;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: GlassSurface(
        elevation: OElevation.low,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: OType.caption),
            const SizedBox(height: 6),
            Text(value, style: OType.metric.copyWith(color: color)),
            const SizedBox(height: 4),
            Text(footnote, style: OType.caption.copyWith(color: OColors.textFaint)),
          ],
        ),
      ),
    );
  }
}
