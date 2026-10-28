import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../domain/vpn_models.dart';

/// Events pushed by the native engine without being asked.
sealed class EngineEvent {
  const EngineEvent();
}

/// The tunnel went down outside of our control (system revoked it, another
/// VPN took over, the service died) or came up (e.g. always-on VPN at boot).
class TunnelStateEvent extends EngineEvent {
  const TunnelStateEvent({required this.up, this.serverId, this.reason});
  final bool up;
  final String? serverId;
  final String? reason;
}

/// Underlying network availability changed.
class NetworkEvent extends EngineEvent {
  const NetworkEvent({required this.available, this.type});
  final bool available;
  final String? type;
}

class EngineStatus {
  const EngineStatus({required this.up, this.serverId, this.stats});
  final bool up;
  final String? serverId;
  final TunnelStats? stats;
}

class EngineException implements Exception {
  const EngineException(this.code, [this.message]);
  final String code;
  final String? message;
  @override
  String toString() => 'EngineException($code)';
}

/// Boundary to the platform VPN implementation.
abstract interface class VpnEngine {
  bool get isSupported;
  Stream<EngineEvent> get events;

  /// Ensures Android VPN permission, showing the system dialog if needed.
  Future<bool> prepare();

  /// Device public key (base64). Generates and stores a key pair on first
  /// call; the private half never leaves native secure storage.
  Future<String> publicKey();

  /// Replaces the device key pair. Existing server peers become invalid.
  Future<String> rotateKey();

  Future<void> start(TunnelConfig config);
  Future<void> stop();
  Future<EngineStatus> status();

  /// Opens Android's VPN settings (always-on VPN / block connections
  /// without VPN live there; apps cannot toggle them).
  Future<void> openSystemVpnSettings();

  /// Non-sensitive diagnostic facts for support screens.
  Future<Map<String, Object?>> diagnostics();

  /// Human-readable device model, used to label the device in the account.
  Future<String> deviceName();
}

/// Real engine on Android, backed by the Kotlin WireGuard integration.
class MethodChannelVpnEngine implements VpnEngine {
  MethodChannelVpnEngine({
    MethodChannel method = const MethodChannel('app.orvane.vpn/engine'),
    EventChannel events = const EventChannel('app.orvane.vpn/events'),
  })  : _m = method,
        _e = events;

  final MethodChannel _m;
  final EventChannel _e;
  Stream<EngineEvent>? _events;

  @override
  bool get isSupported => true;

  @override
  Stream<EngineEvent> get events => _events ??= _e.receiveBroadcastStream().map(_parseEvent).where((e) => e != null).cast<EngineEvent>();

  static EngineEvent? _parseEvent(dynamic raw) {
    if (raw is! Map) return null;
    return switch (raw['type']) {
      'tunnel' => TunnelStateEvent(
          up: raw['up'] == true,
          serverId: raw['serverId'] as String?,
          reason: raw['reason'] as String?,
        ),
      'network' => NetworkEvent(available: raw['available'] == true, type: raw['networkType'] as String?),
      _ => null,
    };
  }

  Future<T> _call<T>(String method, [Object? args]) async {
    try {
      final result = await _m.invokeMethod<T>(method, args);
      return result as T;
    } on PlatformException catch (e) {
      throw EngineException(e.code, e.message);
    }
  }

  @override
  Future<bool> prepare() => _call<bool>('prepare');

  @override
  Future<String> publicKey() => _call<String>('publicKey');

  @override
  Future<String> rotateKey() => _call<String>('rotateKey');

  @override
  Future<void> start(TunnelConfig config) => _call<void>('start', config.toChannelMap());

  @override
  Future<void> stop() => _call<void>('stop');

  @override
  Future<EngineStatus> status() async {
    final m = await _call<Map<Object?, Object?>>('status');
    final handshake = (m['lastHandshakeMs'] as num?)?.toInt() ?? 0;
    return EngineStatus(
      up: m['up'] == true,
      serverId: m['serverId'] as String?,
      stats: m['up'] == true
          ? TunnelStats(
              rxBytes: (m['rxBytes'] as num?)?.toInt() ?? 0,
              txBytes: (m['txBytes'] as num?)?.toInt() ?? 0,
              lastHandshake: handshake > 0 ? DateTime.fromMillisecondsSinceEpoch(handshake) : null,
            )
          : null,
    );
  }

  @override
  Future<void> openSystemVpnSettings() => _call<void>('openVpnSettings');

  @override
  Future<Map<String, Object?>> diagnostics() async =>
      (await _call<Map<Object?, Object?>>('diagnostics')).map((k, v) => MapEntry(k.toString(), v));

  @override
  Future<String> deviceName() => _call<String>('deviceName');
}

/// Used on every platform without a native engine (web preview, tests,
/// desktop). It never pretends to connect.
class UnsupportedVpnEngine implements VpnEngine {
  const UnsupportedVpnEngine();

  Never _fail() => throw const EngineException('UNSUPPORTED');

  @override
  bool get isSupported => false;
  @override
  Stream<EngineEvent> get events => const Stream.empty();
  @override
  Future<bool> prepare() async => _fail();
  @override
  Future<String> publicKey() async => _fail();
  @override
  Future<String> rotateKey() async => _fail();
  @override
  Future<void> start(TunnelConfig config) async => _fail();
  @override
  Future<void> stop() async {}
  @override
  Future<EngineStatus> status() async => const EngineStatus(up: false);
  @override
  Future<void> openSystemVpnSettings() async {}
  @override
  Future<Map<String, Object?>> diagnostics() async => {'engine': 'unsupported', 'platform': defaultTargetPlatform.name};
  @override
  Future<String> deviceName() async => defaultTargetPlatform.name;
}

VpnEngine createPlatformEngine() =>
    !kIsWeb && defaultTargetPlatform == TargetPlatform.android ? MethodChannelVpnEngine() : const UnsupportedVpnEngine();
