import 'package:flutter/foundation.dart';

/// Where the connection is. Only [connected] means traffic is protected, and
/// the controller only enters it after the engine reports a completed
/// WireGuard handshake with the server.
enum VpnPhase { disconnected, connecting, connected, reconnecting, disconnecting, error }

/// Real steps of a connection attempt, used for progress feedback.
enum ConnectStep {
  permission('Requesting VPN permission'),
  provisioning('Securing your device key'),
  starting('Starting encrypted tunnel'),
  handshake('Verifying server handshake');

  const ConnectStep(this.label);
  final String label;

  double get progress => (index + 1) / ConnectStep.values.length;
}

enum VpnErrorKind {
  unsupportedPlatform,
  notConfigured,
  notSignedIn,
  noServerSelected,
  premiumRequired,
  permissionDenied,
  provisioningFailed,
  deviceLimit,
  tunnelFailed,
  handshakeTimeout,
  connectionLost,
  revoked,
}

@immutable
class VpnError {
  const VpnError(this.kind, {this.detail});

  final VpnErrorKind kind;

  /// Extra non-sensitive context (never keys, tokens or configs).
  final String? detail;

  String get title => switch (kind) {
        VpnErrorKind.unsupportedPlatform => 'VPN unavailable on this device',
        VpnErrorKind.notConfigured => 'Service not configured',
        VpnErrorKind.notSignedIn => 'Sign in to connect',
        VpnErrorKind.noServerSelected => 'Choose a location',
        VpnErrorKind.premiumRequired => 'Premium location',
        VpnErrorKind.permissionDenied => 'VPN permission needed',
        VpnErrorKind.provisioningFailed => 'Couldn’t prepare your connection',
        VpnErrorKind.deviceLimit => 'Device limit reached',
        VpnErrorKind.tunnelFailed => 'Tunnel failed to start',
        VpnErrorKind.handshakeTimeout => 'Server didn’t respond',
        VpnErrorKind.connectionLost => 'Connection lost',
        VpnErrorKind.revoked => 'VPN turned off',
      };

  String get message => switch (kind) {
        VpnErrorKind.unsupportedPlatform =>
          'The secure tunnel runs on Android. This preview can’t create a VPN connection.',
        VpnErrorKind.notConfigured =>
          'This build has no Orvane service address, so it can’t fetch servers or provision a tunnel.',
        VpnErrorKind.notSignedIn => 'Your account authorises your devices on our servers.',
        VpnErrorKind.noServerSelected => 'Pick a server location before connecting.',
        VpnErrorKind.premiumRequired => 'This location is part of Orvane Premium.',
        VpnErrorKind.permissionDenied =>
          'Android needs your approval before any app can create a VPN. Nothing was connected.',
        VpnErrorKind.provisioningFailed => 'The server couldn’t register this device. Try again in a moment.',
        VpnErrorKind.deviceLimit => 'Remove a device from your account to connect this one.',
        VpnErrorKind.tunnelFailed => 'Android couldn’t bring up the tunnel interface.',
        VpnErrorKind.handshakeTimeout =>
          'The tunnel started but no encrypted handshake completed, so we disconnected rather than show a false status.',
        VpnErrorKind.connectionLost => 'No handshake from the server for several minutes.',
        VpnErrorKind.revoked => 'Another VPN app took over, or the VPN was switched off in system settings.',
      } +
      (detail != null ? ' ($detail)' : '');

  bool get retryable => switch (kind) {
        VpnErrorKind.unsupportedPlatform || VpnErrorKind.notConfigured || VpnErrorKind.premiumRequired => false,
        _ => true,
      };
}

/// Counters read from the WireGuard backend. All values are measured; when
/// the engine can't provide them they are null and the UI shows a dash.
@immutable
class TunnelStats {
  const TunnelStats({required this.rxBytes, required this.txBytes, this.lastHandshake});

  final int rxBytes;
  final int txBytes;
  final DateTime? lastHandshake;

  static const zero = TunnelStats(rxBytes: 0, txBytes: 0);
}

@immutable
class VpnState {
  const VpnState({
    this.phase = VpnPhase.disconnected,
    this.step,
    this.serverId,
    this.connectedSince,
    this.error,
    this.stats,
    this.rxRate,
    this.txRate,
  });

  final VpnPhase phase;
  final ConnectStep? step;
  final String? serverId;
  final DateTime? connectedSince;
  final VpnError? error;
  final TunnelStats? stats;

  /// Bytes/second over the last sampling interval.
  final double? rxRate;
  final double? txRate;

  bool get isBusy => phase == VpnPhase.connecting || phase == VpnPhase.disconnecting || phase == VpnPhase.reconnecting;

  VpnState copyWith({
    VpnPhase? phase,
    ConnectStep? Function()? step,
    String? Function()? serverId,
    DateTime? Function()? connectedSince,
    VpnError? Function()? error,
    TunnelStats? Function()? stats,
    double? Function()? rxRate,
    double? Function()? txRate,
  }) {
    return VpnState(
      phase: phase ?? this.phase,
      step: step != null ? step() : this.step,
      serverId: serverId != null ? serverId() : this.serverId,
      connectedSince: connectedSince != null ? connectedSince() : this.connectedSince,
      error: error != null ? error() : this.error,
      stats: stats != null ? stats() : this.stats,
      rxRate: rxRate != null ? rxRate() : this.rxRate,
      txRate: txRate != null ? txRate() : this.txRate,
    );
  }
}

/// Tunnel parameters delivered by the backend for one device on one server.
/// Contains no private key: that is generated and kept on the device by the
/// native engine and never crosses into Dart.
@immutable
class TunnelConfig {
  const TunnelConfig({
    required this.serverId,
    required this.addresses,
    required this.dns,
    required this.serverPublicKey,
    required this.endpoint,
    required this.allowedIps,
    this.presharedKey,
    this.persistentKeepalive = 25,
    this.mtu,
  });

  final String serverId;
  final List<String> addresses;
  final List<String> dns;
  final String serverPublicKey;
  final String endpoint;
  final List<String> allowedIps;
  final String? presharedKey;
  final int persistentKeepalive;
  final int? mtu;

  factory TunnelConfig.fromJson(Map<String, dynamic> j) => TunnelConfig(
        serverId: j['serverId'] as String,
        addresses: (j['addresses'] as List).cast<String>(),
        dns: (j['dns'] as List).cast<String>(),
        serverPublicKey: j['serverPublicKey'] as String,
        endpoint: j['endpoint'] as String,
        allowedIps: (j['allowedIps'] as List).cast<String>(),
        presharedKey: j['presharedKey'] as String?,
        persistentKeepalive: (j['persistentKeepalive'] as num?)?.toInt() ?? 25,
        mtu: (j['mtu'] as num?)?.toInt(),
      );

  Map<String, Object?> toChannelMap() => {
        'serverId': serverId,
        'addresses': addresses,
        'dns': dns,
        'serverPublicKey': serverPublicKey,
        'endpoint': endpoint,
        'allowedIps': allowedIps,
        'presharedKey': presharedKey,
        'persistentKeepalive': persistentKeepalive,
        'mtu': mtu,
      };

  @override
  String toString() => 'TunnelConfig(server: $serverId, endpoint: $endpoint)';
}
