import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/brand.dart';
import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/pressable.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/format.dart';
import '../../core/motion/tilt.dart';
import '../account/account.dart';
import '../servers/application/server_providers.dart';
import '../servers/domain/server.dart';
import '../servers/widgets/server_visuals.dart';
import '../vpn/application/vpn_controller.dart';
import '../vpn/domain/vpn_models.dart';
import 'widgets/connection_sphere.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vpn = ref.watch(vpnControllerProvider);
    final server = ref.watch(selectedServerProvider);
    final premium = ref.watch(isPremiumProvider);

    void toggle() => ref.read(vpnControllerProvider.notifier).toggle(server);

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: OSpace.gutter),
        child: Column(
          children: [
            const SizedBox(height: OSpace.xs),
            Reveal(child: _TopBar(premium: premium)),
            const SizedBox(height: OSpace.lg),
            Reveal(delay: const Duration(milliseconds: 80), child: _StatusHeader(state: vpn, server: server)),
            Expanded(
              child: LayoutBuilder(
                builder: (context, c) {
                  final size = c.maxWidth.clamp(160.0, 400.0).toDouble();
                  final fit = (c.maxHeight / 1.16).clamp(120.0, size).toDouble();
                  return Center(
                    child: ConnectionSphere(
                      size: fit,
                      phase: vpn.phase,
                      step: vpn.step,
                      onPressed: toggle,
                      semanticLabel: switch (vpn.phase) {
                        VpnPhase.connected || VpnPhase.reconnecting => 'Disconnect VPN',
                        VpnPhase.connecting => 'Cancel connection',
                        VpnPhase.disconnecting => 'Disconnecting',
                        _ => 'Connect VPN',
                      },
                    ),
                  );
                },
              ),
            ),
            AnimatedSize(
              duration: OMotion.standard,
              curve: OMotion.enter,
              child: AnimatedSwitcher(
                duration: OMotion.standard,
                child: vpn.phase == VpnPhase.error && vpn.error != null
                    ? Padding(
                        key: ValueKey(vpn.error!.kind),
                        padding: const EdgeInsets.only(bottom: OSpace.sm),
                        child: _ErrorNotice(error: vpn.error!, server: server),
                      )
                    : const SizedBox(width: double.infinity),
              ),
            ),
            Reveal(
              delay: const Duration(milliseconds: 160),
              child: Tilt3D(maxAngle: 0.05, child: _ServerCard(server: server, connected: vpn.phase == VpnPhase.connected)),
            ),
            const SizedBox(height: OSpace.sm),
            Reveal(delay: const Duration(milliseconds: 220), child: _LiveStats(state: vpn)),
            // Room for the floating navigation bar.
            SizedBox(height: 96 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.premium});

  final bool premium;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const OrvaneWordmark(),
        const Spacer(),
        Pressable(
          onTap: () => context.push('/premium'),
          semanticLabel: premium ? 'Premium plan active' : 'View Premium plans',
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            decoration: BoxDecoration(
              borderRadius: ORadius.chip,
              gradient: premium
                  ? const LinearGradient(colors: [Color(0x334F8CFF), Color(0x2293C5FD)])
                  : null,
              color: premium ? null : OColors.glassFill,
              border: Border.all(color: premium ? OColors.blue.withValues(alpha: 0.45) : OColors.glassStroke),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(premium ? Icons.workspace_premium_rounded : Icons.auto_awesome_rounded, size: 15, color: OColors.ice),
                const SizedBox(width: 6),
                Text(premium ? 'Premium' : 'Go Premium', style: OType.caption.copyWith(color: OColors.text)),
              ],
            ),
          ),
        ),
        const SizedBox(width: OSpace.xs),
        OIconButton(
          icon: Icons.tune_rounded,
          semanticLabel: 'VPN settings',
          onPressed: () => context.push('/settings/vpn'),
        ),
      ],
    );
  }
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.state, required this.server});

  final VpnState state;
  final VpnServer? server;

  @override
  Widget build(BuildContext context) {
    final (label, color, live) = switch (state.phase) {
      VpnPhase.disconnected => ('Not protected', OColors.textMuted, false),
      VpnPhase.connecting => ('Connecting', OColors.ice, true),
      VpnPhase.connected => ('Protected', OColors.success, true),
      VpnPhase.reconnecting => ('Reconnecting', OColors.warning, true),
      VpnPhase.disconnecting => ('Disconnecting', OColors.textMuted, true),
      VpnPhase.error => ('Not connected', OColors.error, false),
    };
    final place = server == null ? null : '${server!.city}, ${server!.countryName}';

    final Widget headline = switch (state.phase) {
      VpnPhase.connected => _ConnectionTimer(since: state.connectedSince),
      VpnPhase.connecting => Text(state.step?.label ?? 'Connecting', style: OType.title2, textAlign: TextAlign.center),
      VpnPhase.reconnecting => Text('Restoring secure link', style: OType.title2, textAlign: TextAlign.center),
      VpnPhase.disconnecting => Text('Closing tunnel', style: OType.title2, textAlign: TextAlign.center),
      VpnPhase.error => Text(state.error?.title ?? 'Not connected', style: OType.title2, textAlign: TextAlign.center),
      VpnPhase.disconnected => Text('Tap to connect', style: OType.title2, textAlign: TextAlign.center),
    };

    final sub = switch (state.phase) {
      VpnPhase.connected => place != null ? 'Encrypted via $place' : 'Encrypted with WireGuard',
      VpnPhase.reconnecting => 'Traffic is held inside the tunnel, not sent unprotected',
      VpnPhase.connecting => place ?? '',
      _ => place != null ? 'Ready for $place' : 'Choose a location below',
    };

    return Semantics(
      liveRegion: true,
      child: Column(
        children: [
          StatusPill(label: label, color: color, live: live),
          const SizedBox(height: OSpace.sm),
          AnimatedSwitcher(
            duration: OMotion.standard,
            switchInCurve: OMotion.enter,
            transitionBuilder: (child, a) => FadeTransition(
              opacity: a,
              child: SlideTransition(position: Tween(begin: const Offset(0, 0.15), end: Offset.zero).animate(a), child: child),
            ),
            child: KeyedSubtree(key: ValueKey('${state.phase}-${state.step}'), child: headline),
          ),
          const SizedBox(height: 6),
          AnimatedSwitcher(
            duration: OMotion.standard,
            child: Text(sub, key: ValueKey(sub), style: OType.subhead, textAlign: TextAlign.center, maxLines: 2),
          ),
        ],
      ),
    );
  }
}

/// Ticks once a second on its own so the rest of the screen doesn't rebuild.
class _ConnectionTimer extends StatefulWidget {
  const _ConnectionTimer({required this.since});

  final DateTime? since;

  @override
  State<_ConnectionTimer> createState() => _ConnectionTimerState();
}

class _ConnectionTimerState extends State<_ConnectionTimer> {
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final since = widget.since;
    final text = since == null ? '00:00:00' : Fmt.clock(DateTime.now().difference(since));
    return Semantics(
      label: 'Connected for $text',
      child: ExcludeSemantics(child: Text(text, style: OType.timer)),
    );
  }
}

class _ErrorNotice extends ConsumerWidget {
  const _ErrorNotice({required this.error, required this.server});

  final VpnError error;
  final VpnServer? server;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ctrl = ref.read(vpnControllerProvider.notifier);
    final (String? label, VoidCallback? action) = switch (error.kind) {
      VpnErrorKind.notSignedIn => ('Sign in', () => context.push('/auth')),
      VpnErrorKind.noServerSelected => ('Choose location', () => context.go('/locations')),
      VpnErrorKind.premiumRequired => ('See Premium', () => context.push('/premium')),
      VpnErrorKind.deviceLimit => ('Manage devices', () => context.go('/account')),
      _ when error.retryable => ('Try again', () => ctrl.connect(server)),
      _ => (null, null),
    };
    // The headline above already shows the error title.
    return ONotice(
      message: error.message,
      actionLabel: label,
      onAction: action,
      onDismiss: ctrl.dismissError,
    );
  }
}

class _ServerCard extends ConsumerWidget {
  const _ServerCard({required this.server, required this.connected});

  final VpnServer? server;
  final bool connected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servers = ref.watch(serversProvider);
    final latency = server == null ? null : ref.watch(latencyProvider)[server!.id];

    final Widget content;
    if (server != null) {
      content = Row(
        children: [
          ServerFlag(server: server!, size: 44),
          const SizedBox(width: OSpace.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(child: Text(server!.countryName, style: OType.bodyStrong, overflow: TextOverflow.ellipsis)),
                    if (server!.isPremium) ...[const SizedBox(width: 6), const PremiumBadge()],
                  ],
                ),
                const SizedBox(height: 2),
                Text(server!.city, style: OType.footnote),
              ],
            ),
          ),
          LatencyLabel(latency: latency, measured: ref.watch(latencyProvider).containsKey(server!.id)),
          const SizedBox(width: OSpace.xs),
          const Icon(Icons.chevron_right_rounded, color: OColors.textFaint),
        ],
      );
    } else {
      final (title, subtitle) = switch (servers) {
        AsyncLoading() => ('Loading locations…', 'Fetching the live server list'),
        AsyncError(:final error) => (
            'Locations unavailable',
            error is ServersUnavailable && error.reason == 'not_configured'
                ? 'No Orvane service is configured for this build'
                : 'Couldn’t reach the server list — tap to retry',
          ),
        _ => ('Choose a location', 'Pick from the live server list'),
      };
      content = Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(shape: BoxShape.circle, color: OColors.glassFill, border: Border.all(color: OColors.glassStroke)),
            child: servers.isLoading
                ? const Center(child: OSpinner(size: 18))
                : const Icon(Icons.public_rounded, color: OColors.ice, size: 22),
          ),
          const SizedBox(width: OSpace.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: OType.bodyStrong),
                const SizedBox(height: 2),
                Text(subtitle, style: OType.footnote, maxLines: 2),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: OColors.textFaint),
        ],
      );
    }

    return Pressable(
      onTap: () {
        if (servers.hasError) ref.invalidate(serversProvider);
        context.go('/locations');
      },
      pressedScale: 0.98,
      semanticLabel: server == null ? 'Choose a location' : 'Location: ${server!.city}, ${server!.countryName}. Change location',
      child: GlassSurface(
        padding: const EdgeInsets.symmetric(horizontal: OSpace.md, vertical: 14),
        tint: connected ? OColors.success : null,
        elevation: OElevation.high,
        child: content,
      ),
    );
  }
}

class _LiveStats extends StatelessWidget {
  const _LiveStats({required this.state});

  final VpnState state;

  @override
  Widget build(BuildContext context) {
    final live = state.phase == VpnPhase.connected || state.phase == VpnPhase.reconnecting;
    final total = state.stats == null ? null : state.stats!.rxBytes + state.stats!.txBytes;
    return AnimatedOpacity(
      duration: OMotion.standard,
      opacity: live ? 1 : 0.55,
      child: Row(
        children: [
          Expanded(child: _StatTile(icon: Icons.south_rounded, label: 'Download', value: live ? Fmt.rate(state.rxRate) : '—')),
          const SizedBox(width: OSpace.xs),
          Expanded(child: _StatTile(icon: Icons.north_rounded, label: 'Upload', value: live ? Fmt.rate(state.txRate) : '—')),
          const SizedBox(width: OSpace.xs),
          Expanded(child: _StatTile(icon: Icons.data_usage_rounded, label: 'Session', value: live ? Fmt.bytes(total) : '—')),
        ],
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label: ${value == '—' ? 'not available' : value}',
      child: ExcludeSemantics(
        child: GlassSurface(
          elevation: OElevation.low,
          padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
          radius: ORadius.md,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 13, color: OColors.ice),
                  const SizedBox(width: 4),
                  Flexible(child: Text(label, style: OType.caption, overflow: TextOverflow.ellipsis)),
                ],
              ),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: AnimatedSwitcher(
                  duration: OMotion.quick,
                  child: Text(value, key: ValueKey(value), style: OType.metricSmall),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
