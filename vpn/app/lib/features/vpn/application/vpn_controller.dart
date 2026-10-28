import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../auth/application/auth_controller.dart';
import '../../servers/domain/server.dart';
import '../../settings/app_settings.dart';
import '../data/api_provisioner.dart';
import '../data/vpn_engine.dart';
import '../domain/provisioner.dart';
import '../domain/routing.dart';
import '../domain/vpn_models.dart';

export '../domain/provisioner.dart';

/// Timing policy, injectable so tests can run it fast.
class VpnTimings {
  const VpnTimings({
    this.handshakeTimeout = const Duration(seconds: 15),
    this.handshakePoll = const Duration(milliseconds: 400),
    this.statsPoll = const Duration(seconds: 1),
    this.staleAfter = const Duration(minutes: 3),
  });

  final Duration handshakeTimeout;
  final Duration handshakePoll;
  final Duration statsPoll;

  /// WireGuard re-handshakes at least every ~2 minutes on an active tunnel
  /// with keepalive; beyond this the server is considered unreachable.
  final Duration staleAfter;
}

final vpnEngineProvider = Provider<VpnEngine>((ref) => createPlatformEngine());
final provisionerProvider = Provider<Provisioner>((ref) {
  final api = ref.watch(apiClientProvider);
  if (api == null) return const NotConfiguredProvisioner();
  return ApiProvisioner(
    api,
    deviceName: () => ref.read(vpnEngineProvider).deviceName().catchError((Object _) => 'Android device'),
    signedIn: () => ref.read(authControllerProvider).value != null,
  );
});
final vpnTimingsProvider = Provider<VpnTimings>((ref) => const VpnTimings());

final routingPolicyProvider = Provider<RoutingPolicy>((ref) {
  final s = ref.watch(settingsProvider);
  return RoutingPolicy(blockIpv6Leaks: s.blockIpv6Leaks, excludeLan: s.excludeLan);
});

final vpnControllerProvider = NotifierProvider<VpnController, VpnState>(VpnController.new);

/// Owns the connection lifecycle.
///
/// Truthfulness rules:
///  * The phase only becomes [VpnPhase.connected] after the engine reports a
///    WireGuard handshake newer than the start of the attempt.
///  * If no handshake arrives in time the tunnel is torn down and an error
///    is shown; there is no "connected" fallback.
///  * Once connected, a stale handshake moves to [VpnPhase.reconnecting]
///    but the tunnel stays up, so traffic is held inside it instead of
///    silently leaking onto the open network.
class VpnController extends Notifier<VpnState> {
  late VpnEngine _engine;
  late VpnTimings _t;
  StreamSubscription<EngineEvent>? _events;
  Timer? _poll;
  AppLifecycleListener? _lifecycle;
  int _attempt = 0;
  bool _foreground = true;
  bool _networkAvailable = true;
  TunnelStats? _lastStats;
  DateTime? _lastStatsAt;

  @override
  VpnState build() {
    _engine = ref.watch(vpnEngineProvider);
    _t = ref.watch(vpnTimingsProvider);
    _events = _engine.events.listen(_onEngineEvent);
    _lifecycle = AppLifecycleListener(onStateChange: _onLifecycle);
    ref.onDispose(() {
      _events?.cancel();
      _poll?.cancel();
      _lifecycle?.dispose();
    });
    if (_engine.isSupported) Future.microtask(_syncFromEngine);
    return const VpnState();
  }

  void _onLifecycle(AppLifecycleState s) {
    _foreground = s == AppLifecycleState.resumed;
    if (_foreground && (state.phase == VpnPhase.connected || state.phase == VpnPhase.reconnecting)) {
      _syncFromEngine();
      _startStatsPolling();
    } else if (!_foreground) {
      // Stats are only for the UI; don't wake the CPU in the background.
      _poll?.cancel();
    }
  }

  /// Adopts a tunnel that is already running (app restarted, always-on VPN).
  Future<void> _syncFromEngine() async {
    try {
      final s = await _engine.status();
      if (!ref.mounted) return;
      if (s.up && state.phase == VpnPhase.disconnected) {
        final hs = s.stats?.lastHandshake;
        final fresh = hs != null && DateTime.now().difference(hs) < _t.staleAfter;
        state = VpnState(
          phase: fresh ? VpnPhase.connected : VpnPhase.reconnecting,
          serverId: s.serverId,
          connectedSince: fresh ? hs : null,
          stats: s.stats,
        );
        _startStatsPolling();
      } else if (!s.up && (state.phase == VpnPhase.connected || state.phase == VpnPhase.reconnecting)) {
        _toDisconnected();
      }
    } on EngineException {
      // Status is best-effort; the next event or poll will correct it.
    }
  }

  Future<void> toggle(VpnServer? server) async {
    switch (state.phase) {
      case VpnPhase.disconnected:
      case VpnPhase.error:
        await connect(server);
      case VpnPhase.connected:
      case VpnPhase.reconnecting:
      case VpnPhase.connecting:
        await disconnect();
      case VpnPhase.disconnecting:
        break;
    }
  }

  Future<void> connect(VpnServer? server) async {
    if (state.phase == VpnPhase.connecting || state.phase == VpnPhase.disconnecting) return;
    final attempt = ++_attempt;
    bool current() => ref.mounted && attempt == _attempt;

    if (!_engine.isSupported) return _fail(const VpnError(VpnErrorKind.unsupportedPlatform));
    if (server == null) return _fail(const VpnError(VpnErrorKind.noServerSelected));

    state = VpnState(phase: VpnPhase.connecting, step: ConnectStep.permission, serverId: server.id);
    try {
      final granted = await _engine.prepare();
      if (!current()) return;
      if (!granted) return _fail(const VpnError(VpnErrorKind.permissionDenied));

      state = state.copyWith(step: () => ConnectStep.provisioning);
      final key = await _engine.publicKey();
      final issued = await ref.read(provisionerProvider).provision(server: server, devicePublicKey: key);
      final config = applyRouting(issued, ref.read(routingPolicyProvider));
      if (!current()) return;

      state = state.copyWith(step: () => ConnectStep.starting);
      final startedAt = DateTime.now();
      await _engine.start(config);
      if (!current()) return;

      state = state.copyWith(step: () => ConnectStep.handshake);
      final handshake = await _awaitHandshake(startedAt, current);
      if (!current()) return;
      if (handshake == null) {
        await _engine.stop();
        return _fail(const VpnError(VpnErrorKind.handshakeTimeout));
      }

      _lastStats = null;
      state = state.copyWith(
        phase: VpnPhase.connected,
        step: () => null,
        connectedSince: () => DateTime.now(),
        stats: () => handshake,
      );
      _startStatsPolling();
    } on ProvisionException catch (e) {
      if (current()) _fail(VpnError(e.kind, detail: e.detail));
    } on EngineException catch (e) {
      if (!current()) return;
      _fail(VpnError(
        e.code == 'PERMISSION_DENIED' ? VpnErrorKind.permissionDenied : VpnErrorKind.tunnelFailed,
        detail: e.code == 'PERMISSION_DENIED' ? null : e.code,
      ));
    }
  }

  Future<TunnelStats?> _awaitHandshake(DateTime startedAt, bool Function() current) async {
    final deadline = DateTime.now().add(_t.handshakeTimeout);
    // Handshake timestamps have one-second resolution.
    final notBefore = startedAt.subtract(const Duration(seconds: 2));
    while (DateTime.now().isBefore(deadline)) {
      if (!current()) return null;
      final s = await _engine.status();
      final hs = s.stats?.lastHandshake;
      if (s.up && hs != null && hs.isAfter(notBefore)) return s.stats;
      await Future<void>.delayed(_t.handshakePoll);
    }
    return null;
  }

  Future<void> disconnect() async {
    _attempt++; // cancels an in-flight connect
    _poll?.cancel();
    state = state.copyWith(phase: VpnPhase.disconnecting, step: () => null);
    try {
      await _engine.stop();
    } on EngineException {
      // Re-read the truth below rather than assume.
    }
    final s = await _engine.status().catchError((_) => const EngineStatus(up: false));
    if (!ref.mounted) return;
    if (s.up) {
      state = state.copyWith(phase: VpnPhase.error, error: () => const VpnError(VpnErrorKind.tunnelFailed, detail: 'stop'));
    } else {
      _toDisconnected();
    }
  }

  void dismissError() {
    if (state.phase == VpnPhase.error) _toDisconnected();
  }

  void _toDisconnected() {
    _poll?.cancel();
    state = VpnState(serverId: state.serverId);
  }

  void _fail(VpnError e) {
    _poll?.cancel();
    state = VpnState(phase: VpnPhase.error, error: e, serverId: state.serverId);
  }

  void _onEngineEvent(EngineEvent e) {
    switch (e) {
      case TunnelStateEvent(up: false, :final reason):
        if (state.phase == VpnPhase.connected || state.phase == VpnPhase.reconnecting) {
          _attempt++;
          if (reason == 'revoked') {
            _fail(const VpnError(VpnErrorKind.revoked));
          } else {
            _toDisconnected();
          }
        }
      case TunnelStateEvent(up: true):
        _syncFromEngine();
      case NetworkEvent(:final available):
        _networkAvailable = available;
        if (!available && state.phase == VpnPhase.connected) {
          state = state.copyWith(phase: VpnPhase.reconnecting);
        }
    }
  }

  void _startStatsPolling() {
    _poll?.cancel();
    if (!_foreground) return;
    _poll = Timer.periodic(_t.statsPoll, (_) => _pollStats());
  }

  Future<void> _pollStats() async {
    final EngineStatus s;
    try {
      s = await _engine.status();
    } on EngineException {
      return;
    }
    if (!ref.mounted) return;
    if (!s.up) {
      if (state.phase == VpnPhase.connected || state.phase == VpnPhase.reconnecting) _toDisconnected();
      return;
    }
    final stats = s.stats;
    if (stats == null) return;

    final now = DateTime.now();
    double? rxRate, txRate;
    final prev = _lastStats, prevAt = _lastStatsAt;
    if (prev != null && prevAt != null) {
      final secs = now.difference(prevAt).inMilliseconds / 1000;
      if (secs > 0) {
        rxRate = ((stats.rxBytes - prev.rxBytes) / secs).clamp(0, double.infinity).toDouble();
        txRate = ((stats.txBytes - prev.txBytes) / secs).clamp(0, double.infinity).toDouble();
      }
    }
    _lastStats = stats;
    _lastStatsAt = now;

    final hs = stats.lastHandshake;
    final stale = hs == null || now.difference(hs) > _t.staleAfter;
    final phase = stale || !_networkAvailable ? VpnPhase.reconnecting : VpnPhase.connected;
    state = state.copyWith(
      phase: phase,
      stats: () => stats,
      rxRate: () => rxRate,
      txRate: () => txRate,
      connectedSince: () => state.connectedSince ?? (phase == VpnPhase.connected ? now : null),
    );
  }
}
