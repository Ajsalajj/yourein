import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// Device-tilt signal for parallax, normalised to -1..1 on each axis.
///
/// How it works:
///  * The gyroscope rate is integrated into an angle, but the integrator is
///    *leaky*: the angle decays towards zero with a time constant of about a
///    second. Holding the phone at any angle therefore reads as neutral, and
///    a movement produces a response that springs back by itself.
///  * A dead-zone on the raw rate removes sensor noise and drift while the
///    phone is resting.
///  * The output is driven through a critically-damped spring on a [Ticker]
///    so it is smooth at display rate even when sensor samples are uneven.
///  * The ticker stops as soon as the spring settles and the sensor is quiet,
///    and the sensor subscription is dropped while the app is in the
///    background or motion is reduced, so an idle screen costs nothing.
///  * Without a gyroscope it falls back to the accelerometer (gravity
///    direction, high-passed). Without either, touch input from
///    [TiltController.nudge] still drives it.
class TiltController extends ChangeNotifier implements ValueListenable<Offset> {
  TiltController({required TickerProvider vsync}) {
    _ticker = vsync.createTicker(_onTick);
  }

  static const double _maxAngle = 0.32; // radians mapped to |1.0|
  static const double _leakSeconds = 1.1;
  static const double _deadZone = 0.025; // rad/s
  static const double _stiffness = 90;
  static const double _damping = 2 * 9.4868; // 2*sqrt(stiffness): critical

  late final Ticker _ticker;
  StreamSubscription<Object>? _sub;
  bool _enabled = false;
  bool _usingAccelerometer = false;

  // Integrated sensor angle (radians) on each axis.
  double _ax = 0, _ay = 0;
  // Slowly-adapting gravity baseline for the accelerometer fallback.
  double? _gx, _gy;
  DateTime? _lastSample;

  Offset _touch = Offset.zero;
  Offset _value = Offset.zero;
  Offset _velocity = Offset.zero;
  Duration _lastTick = Duration.zero;

  @override
  Offset get value => _value;

  bool get sensorActive => _sub != null;

  /// Turns sensor listening on or off. Off resets to neutral via the spring.
  set enabled(bool on) {
    if (on == _enabled) return;
    _enabled = on;
    if (on) {
      _listenGyroscope();
    } else {
      _stopSensor();
      _ax = _ay = 0;
      _wake();
    }
  }

  /// Touch-driven tilt (e.g. dragging on the hero object). [offset] is in
  /// the same -1..1 space as [value].
  void nudge(Offset offset) {
    _touch = Offset(offset.dx.clamp(-1, 1), offset.dy.clamp(-1, 1));
    _wake();
  }

  void release() {
    _touch = Offset.zero;
    _wake();
  }

  Offset get _target {
    final s = Offset(_ay / _maxAngle, _ax / _maxAngle);
    final t = s + _touch;
    return Offset(t.dx.clamp(-1.0, 1.0), t.dy.clamp(-1.0, 1.0));
  }

  void _listenGyroscope() {
    _usingAccelerometer = false;
    _lastSample = null;
    _sub = gyroscopeEventStream(samplingPeriod: SensorInterval.gameInterval).listen(
      (e) => _onRate(e.x, e.y, e.timestamp),
      onError: (_) {
        _stopSensor();
        if (_enabled) _listenAccelerometer();
      },
      cancelOnError: true,
    );
  }

  void _listenAccelerometer() {
    _usingAccelerometer = true;
    _gx = _gy = null;
    _lastSample = null;
    _sub = accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen(
      (e) => _onGravity(e.x, e.y, e.timestamp),
      onError: (_) => _stopSensor(),
      cancelOnError: true,
    );
  }

  double _dt(DateTime ts) {
    final last = _lastSample;
    _lastSample = ts;
    if (last == null) return 0;
    return (ts.difference(last).inMicroseconds / 1e6).clamp(0.0, 0.1);
  }

  void _onRate(double rx, double ry, DateTime ts) {
    final dt = _dt(ts);
    if (dt == 0) return;
    double dz(double v) => v.abs() < _deadZone ? 0 : v - _deadZone * v.sign;
    final leak = math.exp(-dt / _leakSeconds);
    _ax = ((_ax + dz(rx) * dt) * leak).clamp(-_maxAngle, _maxAngle);
    _ay = ((_ay + dz(ry) * dt) * leak).clamp(-_maxAngle, _maxAngle);
    _wake();
  }

  void _onGravity(double x, double y, DateTime ts) {
    final dt = _dt(ts);
    // Baseline follows gravity with a ~1s lag; the difference is the tilt.
    final a = dt == 0 ? 1.0 : 1 - math.exp(-dt / _leakSeconds);
    _gx = _gx == null ? x : _gx! + (x - _gx!) * a;
    _gy = _gy == null ? y : _gy! + (y - _gy!) * a;
    const g = 9.81;
    _ay = (-(x - _gx!) / g).clamp(-_maxAngle, _maxAngle);
    _ax = ((y - _gy!) / g).clamp(-_maxAngle, _maxAngle);
    _wake();
  }

  void _stopSensor() {
    _sub?.cancel();
    _sub = null;
  }

  void pauseForLifecycle() => _stopSensor();

  void resumeForLifecycle() {
    if (_enabled && _sub == null) {
      _usingAccelerometer ? _listenAccelerometer() : _listenGyroscope();
    }
  }

  void _wake() {
    if (!_ticker.isActive) {
      _lastTick = Duration.zero;
      _ticker.start();
    }
  }

  void _onTick(Duration elapsed) {
    final dt = _lastTick == Duration.zero
        ? 1 / 60
        : ((elapsed - _lastTick).inMicroseconds / 1e6).clamp(0.0, 1 / 20);
    _lastTick = elapsed;

    final target = _target;
    final accel = (target - _value) * _stiffness - _velocity * _damping;
    _velocity += accel * dt;
    _value += _velocity * dt;

    final settled = (target - _value).distance < 0.0015 && _velocity.distance < 0.004;
    if (settled) {
      _value = target;
      _velocity = Offset.zero;
      if (_touch == Offset.zero && (_ax.abs() + _ay.abs()) < 1e-4) _ticker.stop();
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _stopSensor();
    _ticker.dispose();
    super.dispose();
  }
}

/// Owns a [TiltController] for the subtree and keeps it in step with the
/// app lifecycle and the reduced-motion preference.
class TiltScope extends StatefulWidget {
  const TiltScope({super.key, required this.child, this.reduceMotion = false});

  final Widget child;

  /// App-level "reduce motion" setting, combined with the system one.
  final bool reduceMotion;

  static TiltController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_TiltInherited>();
    assert(scope != null, 'No TiltScope above this context');
    return scope!.controller;
  }

  /// Whether parallax/ambient motion should run at all here.
  static bool motionAllowed(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_TiltInherited>();
    return !(scope?.reduced ?? false) && !MediaQuery.disableAnimationsOf(context);
  }

  @override
  State<TiltScope> createState() => _TiltScopeState();
}

class _TiltScopeState extends State<TiltScope> with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final TiltController _controller = TiltController(vsync: this);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(TiltScope oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    _controller.enabled = !widget.reduceMotion && !MediaQuery.disableAnimationsOf(context);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _controller.resumeForLifecycle();
    } else {
      _controller.pauseForLifecycle();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = widget.reduceMotion || MediaQuery.disableAnimationsOf(context);
    return _TiltInherited(controller: _controller, reduced: reduced, child: widget.child);
  }
}

class _TiltInherited extends InheritedWidget {
  const _TiltInherited({required this.controller, required this.reduced, required super.child});

  final TiltController controller;
  final bool reduced;

  @override
  bool updateShouldNotify(_TiltInherited old) => old.controller != controller || old.reduced != reduced;
}

/// Shifts its child by the current tilt. Higher [depth] moves further, so
/// stacking layers with different depths produces parallax. Negative depth
/// moves against the tilt (background layers).
class ParallaxLayer extends StatelessWidget {
  const ParallaxLayer({super.key, required this.depth, required this.child, this.maxShift = 14});

  final double depth;
  final double maxShift;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tilt = TiltScope.of(context);
    return AnimatedBuilder(
      animation: tilt,
      child: child,
      builder: (context, child) => Transform.translate(
        offset: tilt.value * (maxShift * depth),
        child: child,
      ),
    );
  }
}

/// Rotates its child in 3D with the tilt, with real perspective, so cards
/// read as physical panes floating above the background.
class Tilt3D extends StatelessWidget {
  const Tilt3D({super.key, required this.child, this.maxAngle = 0.06, this.depth = 1});

  final Widget child;
  final double maxAngle;
  final double depth;

  @override
  Widget build(BuildContext context) {
    final tilt = TiltScope.of(context);
    return AnimatedBuilder(
      animation: tilt,
      child: child,
      builder: (context, child) {
        final t = tilt.value;
        final m = Matrix4.identity()
          ..setEntry(3, 2, 0.0012)
          ..rotateX(-t.dy * maxAngle)
          ..rotateY(t.dx * maxAngle)
          ..translateByDouble(t.dx * 6 * depth, t.dy * 6 * depth, 0, 1);
        return Transform(transform: m, alignment: Alignment.center, child: child);
      },
    );
  }
}
