import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../motion/tilt.dart';
import '../tokens.dart';

/// The deep-space backdrop shared by every screen.
///
/// Three layers at different parallax depths: a far dust field, two soft
/// light blooms, and a vignette that stays put. Each layer is painted once
/// into its own [RepaintBoundary]; tilt only moves the cached layers, so
/// the backdrop costs a compositing transform per frame, not a repaint.
class AmbientBackground extends StatelessWidget {
  const AmbientBackground({super.key, required this.child, this.accent = OColors.blue, this.intensity = 1});

  final Widget child;

  /// Colour of the main bloom; screens can warm it to reflect state.
  final Color accent;
  final double intensity;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: OColors.bg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const ParallaxLayer(
            depth: -0.4,
            maxShift: 10,
            child: RepaintBoundary(child: CustomPaint(painter: _DustPainter())),
          ),
          ParallaxLayer(
            depth: -0.9,
            maxShift: 18,
            child: RepaintBoundary(
              child: TweenAnimationBuilder<Color?>(
                tween: ColorTween(end: accent),
                duration: OMotion.cinematic,
                curve: OMotion.inOut,
                builder: (context, c, _) => CustomPaint(painter: _BloomPainter(c ?? accent, intensity)),
              ),
            ),
          ),
          const IgnorePointer(child: RepaintBoundary(child: CustomPaint(painter: _VignettePainter()))),
          child,
        ],
      ),
    );
  }
}

class _DustPainter extends CustomPainter {
  const _DustPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rnd = math.Random(7);
    final p = Paint();
    final count = (size.width * size.height / 5200).clamp(40, 220).toInt();
    for (var i = 0; i < count; i++) {
      final o = Offset(rnd.nextDouble() * size.width, rnd.nextDouble() * size.height);
      final r = 0.4 + rnd.nextDouble() * 0.9;
      p.color = OColors.ice.withValues(alpha: 0.05 + rnd.nextDouble() * 0.16);
      canvas.drawCircle(o, r, p);
    }
  }

  @override
  bool shouldRepaint(_DustPainter oldDelegate) => false;
}

class _BloomPainter extends CustomPainter {
  _BloomPainter(this.accent, this.intensity);

  final Color accent;
  final double intensity;

  @override
  void paint(Canvas canvas, Size size) {
    void bloom(Offset c, double r, Color color, double a) {
      final rect = Rect.fromCircle(center: c, radius: r);
      canvas.drawRect(
        rect,
        Paint()
          ..shader = RadialGradient(
            colors: [color.withValues(alpha: a * intensity), color.withValues(alpha: 0)],
          ).createShader(rect),
      );
    }

    final w = size.width, h = size.height;
    bloom(Offset(w * 0.5, h * 0.36), w * 0.95, accent, 0.20);
    bloom(Offset(w * 1.05, h * -0.05), w * 0.8, OColors.ice, 0.07);
    bloom(Offset(w * -0.15, h * 0.95), w * 0.9, const Color(0xFF3B2F9E), 0.12);
  }

  @override
  bool shouldRepaint(_BloomPainter old) => old.accent != accent || old.intensity != intensity;
}

class _VignettePainter extends CustomPainter {
  const _VignettePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          radius: 1.1,
          colors: [Colors.transparent, OColors.bgDeep.withValues(alpha: 0.75)],
          stops: const [0.55, 1],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_VignettePainter oldDelegate) => false;
}
