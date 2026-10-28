import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/design/components/pressable.dart';
import '../../../core/design/tokens.dart';
import '../../../core/motion/tilt.dart';
import '../../vpn/domain/vpn_models.dart';

/// Loads the sphere shader once for the whole app.
final Future<ui.FragmentProgram?> _sphereProgram = ui.FragmentProgram.fromAsset('shaders/sphere.frag')
    .then<ui.FragmentProgram?>((p) => p)
    .catchError((Object _) => null);

/// The interactive 3D connection sphere.
///
/// All animated values live in a [_SphereFrame] that painters listen to
/// directly, so a frame repaints only the sphere's layers and never
/// rebuilds widgets. When motion is reduced the ticker stops and state
/// changes are shown as static frames.
class ConnectionSphere extends StatefulWidget {
  const ConnectionSphere({
    super.key,
    required this.phase,
    required this.onPressed,
    this.step,
    this.size = 280,
    this.semanticLabel,
  });

  final VpnPhase phase;
  final ConnectStep? step;
  final VoidCallback? onPressed;
  final double size;
  final String? semanticLabel;

  @override
  State<ConnectionSphere> createState() => _ConnectionSphereState();
}

/// Per-frame values, smoothed towards per-phase targets.
class _SphereFrame extends ChangeNotifier {
  double time = 0;
  double energy = 0.25;
  double press = 0;
  double rings = 0; // orbital ring visibility
  double accentMix = 0; // success flash
  double shock = 1; // success shockwave progress (1 = idle)
  double float = 0; // vertical float offset in px
  double breathe = 0;
  Color tint = OColors.blue;
  Color iconColor = OColors.ice;
  double iconGlow = 0.2;
  Offset tilt = Offset.zero;
  double progress = 0;

  void tick() => notifyListeners();
}

class _ConnectionSphereState extends State<ConnectionSphere> with SingleTickerProviderStateMixin {
  final _frame = _SphereFrame();
  late final Ticker _ticker = createTicker(_onTick);
  Duration _last = Duration.zero;
  double _sinceNotify = 0;
  bool _pressed = false;
  TiltController? _tilt;
  bool _motion = true;
  ui.FragmentProgram? _program;

  @override
  void initState() {
    super.initState();
    _sphereProgram.then((p) {
      if (mounted) setState(() => _program = p);
    });
    _snapToTargets();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _tilt?.removeListener(_onTiltChanged);
    _tilt = TiltScope.of(context)..addListener(_onTiltChanged);
    _motion = TiltScope.motionAllowed(context);
    if (_motion) {
      if (!_ticker.isActive) _ticker.start();
    } else {
      _ticker.stop();
      _snapToTargets();
    }
  }

  @override
  void didUpdateWidget(ConnectionSphere old) {
    super.didUpdateWidget(old);
    if (old.phase != widget.phase && widget.phase == VpnPhase.connected) {
      _frame.shock = 0;
      _frame.accentMix = 1;
      OHaptics.medium();
    }
    if (!_motion) _snapToTargets();
  }

  void _onTiltChanged() {
    _frame.tilt = _tilt!.value;
    if (!_ticker.isActive) _frame.tick();
  }

  // Targets for the current phase.
  (double energy, double rings, Color tint, Color icon, double glow) get _targets => switch (widget.phase) {
        VpnPhase.disconnected => (0.22, 0.0, OColors.blue, OColors.ice.withValues(alpha: 0.78), 0.15),
        VpnPhase.connecting => (0.62, 1.0, OColors.blue, OColors.ice, 0.55),
        VpnPhase.reconnecting => (0.5, 0.85, const Color(0xFF6E8FD8), OColors.ice, 0.4),
        VpnPhase.connected => (1.0, 0.32, OColors.blue, OColors.text, 1.0),
        VpnPhase.disconnecting => (0.35, 0.4, OColors.blue, OColors.ice.withValues(alpha: 0.7), 0.25),
        VpnPhase.error => (0.18, 0.0, Color.lerp(OColors.blue, OColors.error, 0.72)!, OColors.error, 0.45),
      };

  void _snapToTargets() {
    final (e, rings, tint, icon, glow) = _targets;
    _frame
      ..energy = e
      ..rings = rings
      ..tint = tint
      ..iconColor = icon
      ..iconGlow = glow
      ..accentMix = 0
      ..shock = 1
      ..float = 0
      ..breathe = 0
      ..progress = widget.step?.progress ?? 0
      ..press = _pressed ? 1 : 0
      ..tick();
  }

  void _onTick(Duration elapsed) {
    final dt = _last == Duration.zero ? 1 / 60 : ((elapsed - _last).inMicroseconds / 1e6).clamp(0.0, 0.05);
    _last = elapsed;
    final f = _frame;
    f.time = (f.time + dt) % 1000;
    final t = f.time;

    double approach(double v, double target, double rate) => v + (target - v) * (1 - math.exp(-dt * rate));

    final (e, rings, tint, icon, glow) = _targets;
    final pulse = switch (widget.phase) {
      VpnPhase.disconnected => 0.06 * math.sin(t * 1.15), // slow breathing
      VpnPhase.connecting => 0.14 * math.sin(t * 4.2),
      VpnPhase.reconnecting => 0.12 * math.sin(t * 2.2),
      VpnPhase.connected => 0.035 * math.sin(t * 1.6),
      _ => 0.0,
    };
    f.energy = approach(f.energy, e + pulse, 6);
    f.rings = approach(f.rings, rings, 3.2);
    f.tint = Color.lerp(f.tint, tint, 1 - math.exp(-dt * 4))!;
    f.iconColor = Color.lerp(f.iconColor, icon, 1 - math.exp(-dt * 6))!;
    f.iconGlow = approach(f.iconGlow, glow, 4);
    f.press = approach(f.press, _pressed ? 1 : 0, 18);
    f.progress = approach(f.progress, widget.step?.progress ?? (widget.phase == VpnPhase.connected ? 1 : 0), 5);
    f.float = math.sin(t * 0.85) * 5 + math.sin(t * 0.37) * 2;
    f.breathe = widget.phase == VpnPhase.disconnected ? math.sin(t * 1.15) : 0;
    if (f.shock < 1) f.shock = math.min(1, f.shock + dt / 1.3);
    if (f.accentMix > 0) f.accentMix = math.max(0, f.accentMix - dt / 1.8);

    // While resting, 30 fps is visually identical and halves GPU work.
    _sinceNotify += dt;
    final resting = widget.phase == VpnPhase.disconnected && f.press < 0.01 && f.tilt == Offset.zero;
    if (resting && _sinceNotify < 1 / 31) return;
    _sinceNotify = 0;
    f.tick();
  }

  void _drag(DragUpdateDetails d) {
    final r = widget.size / 2;
    final local = d.localPosition - Offset(r, r * 1.08);
    _tilt?.nudge(Offset(local.dx / r, local.dy / r) * 0.8);
  }

  @override
  void dispose() {
    _tilt?.removeListener(_onTiltChanged);
    _ticker.dispose();
    _frame.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    final enabled = widget.onPressed != null && widget.phase != VpnPhase.disconnecting;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapCancel: () => setState(() => _pressed = false),
        onTapUp: enabled
            ? (_) {
                setState(() => _pressed = false);
                OHaptics.light();
                widget.onPressed?.call();
              }
            : null,
        onPanUpdate: _motion ? _drag : null,
        onPanEnd: (_) {
          _tilt?.release();
          setState(() => _pressed = false);
        },
        onPanCancel: () => _tilt?.release(),
        excludeFromSemantics: true,
        child: RepaintBoundary(
          child: SizedBox(
            width: s,
            height: s * 1.16,
            child: CustomPaint(
              painter: _SceneBackPainter(_frame),
              foregroundPainter: _SceneFrontPainter(_frame),
              child: CustomPaint(
                painter: _program != null ? _ShaderSpherePainter(_frame, _program!.fragmentShader()) : _FallbackSpherePainter(_frame),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Geometry shared by all sphere painters so layers stay registered.
class _Geo {
  _Geo(Size size, _SphereFrame f)
      : radius = size.width * 0.31 * (1 - f.press * 0.03 + f.breathe * 0.006),
        center = Offset(
          size.width / 2 + f.tilt.dx * size.width * 0.025,
          size.width * 0.54 + f.float + f.tilt.dy * size.width * 0.02,
        ),
        groundY = size.width * (0.54 + 0.31 * 1.32);

  final double radius;
  final Offset center;
  final double groundY;
}

class _ShaderSpherePainter extends CustomPainter {
  _ShaderSpherePainter(this.f, this.shader) : super(repaint: f);

  final _SphereFrame f;
  final ui.FragmentShader shader;

  @override
  void paint(Canvas canvas, Size size) {
    final g = _Geo(size, f);
    final tint = f.tint;
    const accent = OColors.success;
    var i = 0;
    void set(double v) => shader.setFloat(i++, v);
    set(size.width);
    set(size.height);
    set(g.center.dx);
    set(g.center.dy);
    set(g.radius);
    set(f.time);
    set(f.tilt.dx);
    set(f.tilt.dy);
    set(tint.r);
    set(tint.g);
    set(tint.b);
    set(accent.r);
    set(accent.g);
    set(accent.b);
    set(f.accentMix);
    set(f.energy.clamp(0, 1));
    set(f.press);
    final bounds = Rect.fromCircle(center: g.center, radius: g.radius * 1.9);
    canvas.drawRect(bounds, Paint()..shader = shader);
  }

  @override
  bool shouldRepaint(_ShaderSpherePainter old) => old.shader != shader;
}

/// Gradient-only approximation used if the shader can't be loaded.
class _FallbackSpherePainter extends CustomPainter {
  _FallbackSpherePainter(this.f) : super(repaint: f);

  final _SphereFrame f;

  @override
  void paint(Canvas canvas, Size size) {
    final g = _Geo(size, f);
    final tint = Color.lerp(f.tint, OColors.success, f.accentMix)!;
    final glowRect = Rect.fromCircle(center: g.center, radius: g.radius * 1.9);
    canvas.drawRect(
      glowRect,
      Paint()
        ..shader = RadialGradient(
          colors: [tint.withValues(alpha: 0.10 + 0.35 * f.energy), tint.withValues(alpha: 0)],
          stops: const [0.5, 1],
        ).createShader(glowRect),
    );
    final rect = Rect.fromCircle(center: g.center, radius: g.radius);
    final light = Alignment(-0.45 - f.tilt.dx * 0.3, -0.5 - f.tilt.dy * 0.3);
    canvas.drawCircle(
      g.center,
      g.radius,
      Paint()
        ..shader = RadialGradient(
          center: light,
          radius: 1.25,
          colors: [
            Color.lerp(tint, Colors.white, 0.35)!.withValues(alpha: 0.9),
            Color.lerp(const Color(0xFF07122A), tint, 0.25 + 0.3 * f.energy)!,
            const Color(0xFF040915),
            tint.withValues(alpha: 0.8),
          ],
          stops: const [0, 0.32, 0.78, 1],
        ).createShader(rect),
    );
    canvas.drawCircle(
      g.center + Offset(-g.radius * 0.38, -g.radius * 0.42),
      g.radius * 0.12,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.55)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
  }

  @override
  bool shouldRepaint(_FallbackSpherePainter old) => false;
}

/// A tilted 3D orbit, projected orthographically.
class _Orbit {
  const _Orbit({required this.scale, required this.incline, required this.roll, required this.speed, required this.phase});

  final double scale; // radius relative to sphere
  final double incline; // radians around X
  final double roll; // radians around Z
  final double speed; // revolutions / second for the comet head
  final double phase;

  /// Point on the orbit at angle [a]; z > 0 is in front of the sphere.
  (Offset, double) at(double a, double r) {
    final x = math.cos(a) * r * scale;
    final y0 = math.sin(a) * r * scale;
    final y = y0 * math.cos(incline);
    final z = y0 * math.sin(incline);
    final cr = math.cos(roll), sr = math.sin(roll);
    return (Offset(x * cr - y * sr, x * sr + y * cr), z);
  }
}

const _orbits = [
  _Orbit(scale: 1.30, incline: 1.22, roll: -0.38, speed: 0.32, phase: 0),
  _Orbit(scale: 1.48, incline: 1.10, roll: 0.52, speed: -0.22, phase: 2.1),
  _Orbit(scale: 1.18, incline: 1.36, roll: 1.35, speed: 0.45, phase: 4.0),
];

void _paintOrbits(Canvas canvas, Size size, _SphereFrame f, {required bool front}) {
  if (f.rings < 0.01) return;
  final g = _Geo(size, f);
  final r = g.radius * (0.92 + 0.08 * f.rings);
  const segments = 72;
  final paint = Paint()
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round;
  final dot = Paint();

  for (var o = 0; o < _orbits.length; o++) {
    final orbit = _orbits[o];
    // When connected only the first orbit remains, slow and faint.
    final orbitAlpha = f.rings * (o == 0 ? 1.0 : ((f.rings - 0.32) / 0.68).clamp(0.0, 1.0));
    if (orbitAlpha < 0.01) continue;
    final head = f.time * orbit.speed * 2 * math.pi + orbit.phase;
    for (var s = 0; s < segments; s++) {
      final a0 = s / segments * 2 * math.pi;
      final a1 = (s + 1) / segments * 2 * math.pi;
      final (p0, z0) = orbit.at(a0, r);
      final (p1, z1) = orbit.at(a1, r);
      final z = (z0 + z1) / 2;
      if ((z > 0) != front) continue;
      // Behind-the-sphere parts within the silhouette are hidden by the
      // sphere itself, which is painted between the two passes.
      var d = ((a0 - head) % (2 * math.pi));
      if (orbit.speed < 0) d = 2 * math.pi - d;
      final trail = math.exp(-d * 1.4); // comet trail fading behind head
      final depth = 0.55 + 0.45 * (z / (r * orbit.scale)).clamp(-1.0, 1.0);
      final alpha = orbitAlpha * depth * (0.10 + 0.75 * trail);
      paint
        ..strokeWidth = 1.0 + 1.4 * trail * depth
        ..color = Color.lerp(OColors.ice, OColors.blue, 0.35)!.withValues(alpha: alpha.clamp(0, 1));
      canvas.drawLine(g.center + p0, g.center + p1, paint);
    }
    // Particles riding the orbit.
    for (var k = 0; k < 5; k++) {
      final a = f.time * orbit.speed * 2 * math.pi * (0.6 + k * 0.13) + k * 1.27 + orbit.phase;
      final (pt, z) = orbit.at(a, r * (1 + 0.04 * math.sin(f.time * 1.3 + k)));
      if ((z > 0) != front) continue;
      final depth = 0.5 + 0.5 * (z / (r * orbit.scale)).clamp(-1.0, 1.0);
      dot.color = OColors.ice.withValues(alpha: (orbitAlpha * (0.25 + 0.6 * depth)).clamp(0, 1));
      canvas.drawCircle(g.center + pt, 0.9 + 1.3 * depth, dot);
    }
  }
}

/// Behind the sphere: contact shadow and the far halves of the orbits.
class _SceneBackPainter extends CustomPainter {
  _SceneBackPainter(this.f) : super(repaint: f);

  final _SphereFrame f;

  @override
  void paint(Canvas canvas, Size size) {
    final g = _Geo(size, f);
    // Shadow tightens and darkens as the sphere floats closer to the ground.
    final lift = (f.float + 7) / 14; // 0 (low) .. 1 (high)
    final w = g.radius * (1.05 - 0.12 * lift);
    final shadowRect = Rect.fromCenter(center: Offset(size.width / 2 + f.tilt.dx * 6, g.groundY), width: w * 2, height: w * 0.22);
    canvas.drawOval(
      shadowRect,
      Paint()
        ..shader = RadialGradient(
          colors: [Colors.black.withValues(alpha: 0.42 - 0.12 * lift), Colors.black.withValues(alpha: 0)],
        ).createShader(shadowRect),
    );
    // Faint coloured bounce light on the "floor".
    canvas.drawOval(
      shadowRect.inflate(g.radius * 0.2),
      Paint()
        ..shader = RadialGradient(
          colors: [f.tint.withValues(alpha: 0.16 * f.energy), f.tint.withValues(alpha: 0)],
        ).createShader(shadowRect.inflate(g.radius * 0.2)),
    );
    _paintOrbits(canvas, size, f, front: false);
  }

  @override
  bool shouldRepaint(_SceneBackPainter old) => false;
}

/// In front of the sphere: near orbit halves, progress arc, power glyph and
/// the success shockwave.
class _SceneFrontPainter extends CustomPainter {
  _SceneFrontPainter(this.f) : super(repaint: f);

  final _SphereFrame f;

  @override
  void paint(Canvas canvas, Size size) {
    final g = _Geo(size, f);
    _paintOrbits(canvas, size, f, front: true);

    // Progress arc hugging the sphere while connecting.
    if (f.rings > 0.01 && f.progress > 0 && f.progress < 0.999) {
      final rect = Rect.fromCircle(center: g.center, radius: g.radius * 1.085);
      canvas.drawArc(
        rect,
        -math.pi / 2,
        2 * math.pi * f.progress,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = OColors.ice.withValues(alpha: 0.65 * f.rings),
      );
    }

    // Success shockwave.
    if (f.shock < 1) {
      final e = Curves.easeOutCubic.transform(f.shock);
      canvas.drawCircle(
        g.center,
        g.radius * (1.02 + 0.75 * e),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5 * (1 - e) + 0.5
          ..color = OColors.success.withValues(alpha: 0.55 * (1 - e)),
      );
    }

    _paintPowerGlyph(canvas, g);
  }

  void _paintPowerGlyph(Canvas canvas, _Geo g) {
    final s = g.radius * 0.30;
    final c = g.center + Offset(f.tilt.dx * 3, f.tilt.dy * 3); // floats slightly above the glass
    final stroke = g.radius * 0.052;
    final path = Path()
      ..addArc(Rect.fromCircle(center: c + Offset(0, s * 0.08), radius: s), -math.pi / 2 + 0.72, 2 * math.pi - 1.44)
      ..moveTo(c.dx, c.dy - s * 1.02)
      ..lineTo(c.dx, c.dy - s * 0.12);
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    if (f.iconGlow > 0.05) {
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = stroke * 2.2
          ..strokeCap = StrokeCap.round
          ..color = Color.lerp(f.tint, OColors.success, f.accentMix)!.withValues(alpha: 0.55 * f.iconGlow)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, stroke * 1.6),
      );
    }
    canvas.drawPath(path, base..color = f.iconColor);
  }

  @override
  bool shouldRepaint(_SceneFrontPainter old) => false;
}
