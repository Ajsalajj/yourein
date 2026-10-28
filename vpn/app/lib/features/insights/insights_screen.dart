import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/buttons.dart';
import '../../core/design/components/elements.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/components/page.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/format.dart';
import '../servers/application/server_providers.dart';
import '../vpn/application/vpn_controller.dart';
import '../vpn/domain/vpn_models.dart';
import 'throughput_history.dart';

class InsightsScreen extends ConsumerWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vpn = ref.watch(vpnControllerProvider);
    final history = ref.watch(throughputHistoryProvider);
    final server = ref.watch(selectedServerProvider);
    final live = vpn.phase == VpnPhase.connected || vpn.phase == VpnPhase.reconnecting;

    return OPage(
      title: 'Insights',
      subtitle: 'Read from the tunnel on this device',
      standalone: false,
      slivers: [
        if (!live)
          SliverToBoxAdapter(
            child: OEmptyState(
              icon: Icons.insights_rounded,
              title: 'No active session',
              message: 'Connect to see live throughput, data used and tunnel health.',
              action: OButton(label: 'Go to Connect', variant: OButtonVariant.secondary, expand: false, onPressed: () => context.go('/home')),
            ),
          )
        else ...[
          SliverToBoxAdapter(
            child: GlassSurface(
              elevation: OElevation.high,
              padding: const EdgeInsets.fromLTRB(OSpace.md, OSpace.md, OSpace.md, OSpace.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text('Throughput', style: OType.bodyStrong)),
                      const _Legend(color: OColors.blue, label: 'Down'),
                      const SizedBox(width: OSpace.sm),
                      const _Legend(color: OColors.success, label: 'Up'),
                    ],
                  ),
                  const SizedBox(height: OSpace.xs),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(Fmt.rate(vpn.rxRate), style: OType.title2.copyWith(fontFeatures: OType.metric.fontFeatures)),
                      const SizedBox(width: OSpace.xs),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 3),
                        child: Text('↑ ${Fmt.rate(vpn.txRate)}', style: OType.footnote),
                      ),
                    ],
                  ),
                  const SizedBox(height: OSpace.md),
                  Semantics(
                    label: 'Throughput chart for the last ${history.length} seconds',
                    child: SizedBox(height: 150, child: _ThroughputChart(samples: history)),
                  ),
                  const SizedBox(height: OSpace.xs),
                  Text('Last ${ThroughputHistory.window} seconds', style: OType.caption.copyWith(color: OColors.textFaint)),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SectionLabel('This session')),
          SliverToBoxAdapter(
            child: Row(
              children: [
                Expanded(child: _Metric(label: 'Downloaded', value: Fmt.bytes(vpn.stats?.rxBytes))),
                const SizedBox(width: OSpace.xs),
                Expanded(child: _Metric(label: 'Uploaded', value: Fmt.bytes(vpn.stats?.txBytes))),
              ],
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: OSpace.xs)),
          SliverToBoxAdapter(
            child: Row(
              children: [
                Expanded(child: _DurationMetric(since: vpn.connectedSince)),
                const SizedBox(width: OSpace.xs),
                Expanded(child: _HandshakeMetric(at: vpn.stats?.lastHandshake)),
              ],
            ),
          ),
          const SliverToBoxAdapter(child: SectionLabel('Tunnel')),
          SliverToBoxAdapter(
            child: OListGroup(children: [
              OListRow(
                icon: Icons.location_on_rounded,
                title: 'Location',
                subtitle: server == null ? 'Unknown' : '${server.city}, ${server.countryName}',
                trailing: const SizedBox.shrink(),
              ),
              const OListRow(icon: Icons.shield_rounded, title: 'Protocol', subtitle: 'WireGuard', trailing: SizedBox.shrink()),
              OListRow(
                icon: vpn.phase == VpnPhase.connected ? Icons.check_circle_rounded : Icons.sync_problem_rounded,
                iconColor: vpn.phase == VpnPhase.connected ? OColors.success : OColors.warning,
                title: 'Health',
                subtitle: vpn.phase == VpnPhase.connected
                    ? 'Handshakes are current'
                    : 'Waiting for a fresh handshake; traffic stays in the tunnel',
                trailing: const SizedBox.shrink(),
              ),
            ]),
          ),
        ],
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: OSpace.xl),
            child: Text(
              'Orvane never records the sites or apps you use. Session figures are counted by the tunnel on this phone and are not uploaded.',
              style: OType.footnote.copyWith(color: OColors.textFaint),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label, style: OType.caption),
        ],
      );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => MergeSemantics(
        child: GlassSurface(
          elevation: OElevation.low,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: OType.caption),
              const SizedBox(height: 6),
              AnimatedSwitcher(
                duration: OMotion.quick,
                child: Text(value, key: ValueKey(value), style: OType.metric),
              ),
            ],
          ),
        ),
      );
}

class _DurationMetric extends StatefulWidget {
  const _DurationMetric({required this.since});
  final DateTime? since;
  @override
  State<_DurationMetric> createState() => _DurationMetricState();
}

class _DurationMetricState extends State<_DurationMetric> {
  late final Timer _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  @override
  void dispose() {
    _t.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      _Metric(label: 'Duration', value: widget.since == null ? '—' : Fmt.clock(DateTime.now().difference(widget.since!)));
}

class _HandshakeMetric extends StatefulWidget {
  const _HandshakeMetric({required this.at});
  final DateTime? at;
  @override
  State<_HandshakeMetric> createState() => _HandshakeMetricState();
}

class _HandshakeMetricState extends State<_HandshakeMetric> {
  late final Timer _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  @override
  void dispose() {
    _t.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _Metric(label: 'Last handshake', value: Fmt.ago(widget.at));
}

/// Two smoothed area lines on a shared, auto-scaled axis. Animates between
/// sample sets so new data glides in rather than jumping.
class _ThroughputChart extends StatelessWidget {
  const _ThroughputChart({required this.samples});

  final List<ThroughputSample> samples;

  @override
  Widget build(BuildContext context) {
    final peak = samples.fold<double>(1, (m, s) => math.max(m, math.max(s.rx, s.tx)));
    return TweenAnimationBuilder<double>(
      tween: Tween(end: peak),
      duration: OMotion.standard,
      curve: OMotion.inOut,
      builder: (context, scale, _) => RepaintBoundary(
        child: CustomPaint(painter: _ChartPainter(samples, scale), size: Size.infinite),
      ),
    );
  }
}

class _ChartPainter extends CustomPainter {
  _ChartPainter(this.samples, this.scale);

  final List<ThroughputSample> samples;
  final double scale;

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()..color = OColors.hairline;
    for (var i = 1; i <= 3; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (samples.length < 2) {
      final tp = TextPainter(
        text: TextSpan(text: 'Collecting samples…', style: OType.caption.copyWith(color: OColors.textFaint)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, size.center(Offset(-tp.width / 2, -tp.height / 2)));
      return;
    }
    void series(double Function(ThroughputSample) pick, Color color) {
      final n = ThroughputHistory.window - 1;
      final start = n - (samples.length - 1);
      Offset at(int i) => Offset(size.width * (start + i) / n, size.height * (1 - (pick(samples[i]) / scale).clamp(0.0, 1.0) * 0.92));
      final line = Path()..moveTo(at(0).dx, at(0).dy);
      for (var i = 1; i < samples.length; i++) {
        final p0 = at(i - 1), p1 = at(i);
        final mx = (p0.dx + p1.dx) / 2;
        line.cubicTo(mx, p0.dy, mx, p1.dy, p1.dx, p1.dy);
      }
      final area = Path.from(line)
        ..lineTo(at(samples.length - 1).dx, size.height)
        ..lineTo(at(0).dx, size.height)
        ..close();
      canvas.drawPath(
        area,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
      canvas.drawPath(
        line,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = color,
      );
      final last = at(samples.length - 1);
      canvas.drawCircle(last, 3.5, Paint()..color = color);
      canvas.drawCircle(last, 7, Paint()..color = color.withValues(alpha: 0.2));
    }

    series((s) => s.tx, OColors.success);
    series((s) => s.rx, OColors.blue);
  }

  @override
  bool shouldRepaint(_ChartPainter old) => old.samples != samples || old.scale != scale;
}
