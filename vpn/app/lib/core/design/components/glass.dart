import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../tokens.dart';

/// A pane of dark glass.
///
/// The material is built from a diagonal translucent fill, a gradient edge
/// that is brighter where light would catch it (top-left), and a soft
/// tinted shadow. Backdrop blur is optional and off by default: it is the
/// most expensive effect on Android GPUs, so only surfaces that actually
/// overlap moving content (navigation bar, sheets) turn it on.
class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(OSpace.md),
    this.radius = ORadius.lg,
    this.blur = false,
    this.tint,
    this.elevation = OElevation.mid,
    this.strong = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final bool blur;

  /// Optional colour washed into the glass (e.g. selected state).
  final Color? tint;
  final List<BoxShadow> elevation;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    final base = strong ? 0.11 : 0.075;
    final fill = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: r,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(Colors.white, tint ?? Colors.white, 0.6)!.withValues(alpha: base + (tint != null ? 0.05 : 0)),
            Colors.white.withValues(alpha: base * 0.35),
          ],
        ),
      ),
      child: CustomPaint(
        foregroundPainter: _GlassEdgePainter(radius: radius, tint: tint),
        child: Padding(padding: padding, child: child),
      ),
    );

    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: elevation),
      child: ClipRRect(
        borderRadius: r,
        child: blur
            ? BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: ColoredBox(color: OColors.bg.withValues(alpha: 0.55), child: fill),
              )
            : ColoredBox(color: OColors.bgRaised.withValues(alpha: 0.72), child: fill),
      ),
    );
  }
}

class _GlassEdgePainter extends CustomPainter {
  _GlassEdgePainter({required this.radius, this.tint});

  final double radius;
  final Color? tint;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect.deflate(0.5), Radius.circular(radius));
    final edge = tint ?? Colors.white;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          edge.withValues(alpha: tint != null ? 0.55 : 0.22),
          edge.withValues(alpha: 0.05),
          edge.withValues(alpha: tint != null ? 0.18 : 0.08),
        ],
        stops: const [0, 0.55, 1],
      ).createShader(rect);
    canvas.drawRRect(rrect, stroke);

    // Specular sheen along the top edge.
    final sheen = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.white.withValues(alpha: 0.06), Colors.white.withValues(alpha: 0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height * 0.45));
    canvas.save();
    canvas.clipRRect(rrect);
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height * 0.45), sheen);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlassEdgePainter old) => old.radius != radius || old.tint != tint;
}
