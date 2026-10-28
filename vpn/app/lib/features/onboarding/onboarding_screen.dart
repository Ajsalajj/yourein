import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/ambient_background.dart';
import '../../core/design/components/buttons.dart';
import '../../core/design/components/glass.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../../core/motion/tilt.dart';
import '../home/widgets/connection_sphere.dart';
import '../settings/app_settings.dart';
import '../vpn/domain/vpn_models.dart';

class _Page {
  const _Page(this.eyebrow, this.title, this.body);
  final String eyebrow;
  final String title;
  final String body;
}

const _pages = [
  _Page('ORVANE', 'Privacy, in one touch.', 'One sphere. Tap it and your connection is wrapped in modern encryption — and the status you see is always the real one.'),
  _Page('WIREGUARD', 'Fast because it’s lean.', 'Orvane is built on WireGuard, a small, audited protocol that connects in moments and roams between Wi‑Fi and mobile without dropping.'),
  _Page('NO ACTIVITY LOGS', 'Your browsing stays yours.', 'We don’t record the sites you visit or the apps you use. Your device key is created on this phone and its private half never leaves it.'),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pc = PageController();
  double _page = 0;

  @override
  void initState() {
    super.initState();
    _pc.addListener(() => setState(() => _page = _pc.page ?? 0));
  }

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  void _finish() {
    ref.read(settingsProvider.notifier).completeOnboarding();
    context.go('/auth?next=/home');
  }

  @override
  Widget build(BuildContext context) {
    final last = _page.round() == _pages.length - 1;
    return Scaffold(
      body: AmbientBackground(
        child: SafeArea(
          child: Column(
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(0, OSpace.xs, OSpace.xs, 0),
                  child: AnimatedOpacity(
                    duration: OMotion.quick,
                    opacity: last ? 0 : 1,
                    child: OButton(label: 'Skip', variant: OButtonVariant.ghost, expand: false, compact: true, onPressed: last ? null : _finish),
                  ),
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pc,
                  itemCount: _pages.length,
                  itemBuilder: (context, i) {
                    final delta = (_page - i).clamp(-1.0, 1.0);
                    return _OnboardingPage(page: _pages[i], index: i, delta: delta);
                  },
                ),
              ),
              _Dots(page: _page, count: _pages.length),
              Padding(
                padding: const EdgeInsets.all(OSpace.gutter),
                child: OButton(
                  label: last ? 'Get started' : 'Continue',
                  onPressed: last ? _finish : () => _pc.nextPage(duration: OMotion.emphasized, curve: OMotion.enter),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({required this.page, required this.index, required this.delta});

  final _Page page;
  final int index;

  /// -1..1 distance from the settled position, for cross-page parallax.
  final double delta;

  @override
  Widget build(BuildContext context) {
    final fade = 1 - delta.abs();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OSpace.gutter),
      child: Column(
        children: [
          Expanded(
            child: Transform.translate(
              offset: Offset(delta * 90, 0),
              child: Opacity(opacity: fade.clamp(0, 1), child: Center(child: _Illustration(index: index))),
            ),
          ),
          Transform.translate(
            offset: Offset(delta * 40, 0),
            child: Opacity(
              opacity: fade.clamp(0, 1),
              child: Column(
                children: [
                  Text(page.eyebrow, style: OType.eyebrow.copyWith(color: OColors.ice)),
                  const SizedBox(height: OSpace.sm),
                  Semantics(header: true, child: Text(page.title, style: OType.title1, textAlign: TextAlign.center)),
                  const SizedBox(height: OSpace.sm),
                  Text(page.body, style: OType.body.copyWith(color: OColors.textMuted), textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
          const SizedBox(height: OSpace.xl),
        ],
      ),
    );
  }
}

/// Floating, parallaxed compositions. Purely illustrative: none of them
/// reflect or claim any connection state.
class _Illustration extends StatelessWidget {
  const _Illustration({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: switch (index) {
        0 => const IgnorePointer(child: ConnectionSphere(phase: VpnPhase.disconnected, onPressed: null, size: 260)),
        1 => const _CardStack(
            icon: Icons.bolt_rounded,
            lines: ['Handshake', 'ChaCha20-Poly1305', 'Curve25519'],
          ),
        _ => const _CardStack(icon: Icons.visibility_off_rounded, lines: ['Sites visited', 'Apps used', 'DNS queries'], struck: true),
      },
    );
  }
}

class _CardStack extends StatelessWidget {
  const _CardStack({required this.icon, required this.lines, this.struck = false});

  final IconData icon;
  final List<String> lines;
  final bool struck;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 280,
      height: 280,
      child: Stack(
        alignment: Alignment.center,
        children: [
          ParallaxLayer(
            depth: -0.6,
            child: Transform.rotate(
              angle: -0.12,
              child: SizedBox(width: 210, height: 150, child: GlassSurface(child: const SizedBox.expand())),
            ),
          ),
          ParallaxLayer(
            depth: 0.6,
            child: Tilt3D(
              maxAngle: 0.14,
              child: SizedBox(
                width: 240,
                child: GlassSurface(
                  strong: true,
                  elevation: OElevation.high,
                  padding: const EdgeInsets.all(OSpace.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final l in lines)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              Icon(struck ? Icons.block_rounded : Icons.check_circle_rounded,
                                  size: 18, color: struck ? OColors.error : OColors.success),
                              const SizedBox(width: OSpace.xs),
                              Text(
                                l,
                                style: OType.callout.copyWith(
                                  decoration: struck ? TextDecoration.lineThrough : null,
                                  decorationColor: OColors.textMuted,
                                  color: struck ? OColors.textMuted : OColors.text,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: 6,
            right: 18,
            child: ParallaxLayer(
              depth: 1.4,
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(center: Alignment(-0.4, -0.5), colors: [Color(0xFF7FAAFF), OColors.blue, Color(0xFF173A8A)]),
                  boxShadow: OElevation.glow(OColors.blue),
                ),
                child: Icon(icon, color: OColors.text, size: 30),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.page, required this.count});
  final double page;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Page ${page.round() + 1} of $count',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            Builder(builder: (context) {
              final double t = 1 - math.min(1.0, (page - i).abs()).toDouble();
              return Container(
                width: 8 + 18 * t,
                height: 8,
                margin: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  borderRadius: ORadius.chip,
                  color: Color.lerp(OColors.glassHighlight, OColors.ice, t),
                ),
              );
            }),
        ],
      ),
    );
  }
}
