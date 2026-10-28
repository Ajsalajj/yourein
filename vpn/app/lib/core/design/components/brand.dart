import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';

/// The Orvane mark: a lit orb inside an inclined orbit.
class OrvaneMark extends StatelessWidget {
  const OrvaneMark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SizedBox.square(dimension: size, child: const CustomPaint(painter: _MarkPainter())),
    );
  }
}

class _MarkPainter extends CustomPainter {
  const _MarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width * 0.28;
    final orb = Rect.fromCircle(center: c, radius: r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(-0.4, -0.5),
          colors: [Color(0xFFDCEBFF), OColors.blue, Color(0xFF0B1A3D)],
          stops: [0, 0.45, 1],
        ).createShader(orb),
    );
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(-math.pi / 7);
    final orbit = Rect.fromCenter(center: Offset.zero, width: size.width * 0.96, height: size.width * 0.34);
    canvas.drawOval(
      orbit,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.06
        ..shader = const LinearGradient(colors: [Color(0x0093C5FD), OColors.ice, Color(0x3393C5FD)]).createShader(orbit),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_MarkPainter oldDelegate) => false;
}

class OrvaneWordmark extends StatelessWidget {
  const OrvaneWordmark({super.key, this.size = 26});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Orvane',
      header: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          OrvaneMark(size: size),
          const SizedBox(width: 8),
          ExcludeSemantics(child: Text('Orvane', style: OType.title3.copyWith(letterSpacing: -0.4))),
        ],
      ),
    );
  }
}

/// Fades and lifts its child in after [delay]. Instant when motion is reduced.
class Reveal extends StatefulWidget {
  const Reveal({super.key, required this.child, this.delay = Duration.zero, this.offset = 14});

  final Widget child;
  final Duration delay;
  final double offset;

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: OMotion.emphasized);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.value = 1;
    } else if (_c.isDismissed) {
      Future.delayed(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = OMotion.enter.transform(_c.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(offset: Offset(0, widget.offset * (1 - t)), child: child),
        );
      },
    );
  }
}
