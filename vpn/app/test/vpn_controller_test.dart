import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:orvane/features/servers/domain/server.dart';
import 'package:orvane/features/vpn/application/vpn_controller.dart';
import 'package:orvane/features/vpn/data/vpn_engine.dart';
import 'package:orvane/features/vpn/domain/routing.dart';
import 'package:orvane/features/vpn/domain/vpn_models.dart';

/// Scriptable engine double. It records calls and reports whatever
/// handshake state the test sets.
class FakeEngine implements VpnEngine {
  bool permission = true;
  bool up = false;
  DateTime? handshake;
  bool handshakeOnStart = true;
  int rx = 0, tx = 0;
  String? startError;
  final calls = <String>[];
  final _events = StreamController<EngineEvent>.broadcast();

  void emit(EngineEvent e) => _events.add(e);

  @override
  bool get isSupported => true;
  @override
  Stream<EngineEvent> get events => _events.stream;
  @override
  Future<bool> prepare() async {
    calls.add('prepare');
    return permission;
  }

  @override
  Future<String> publicKey() async {
    calls.add('publicKey');
    return 'PUBKEY';
  }

  @override
  Future<String> rotateKey() async => 'PUBKEY2';
  @override
  Future<void> start(TunnelConfig config) async {
    calls.add('start:${config.serverId}');
    if (startError != null) throw EngineException(startError!);
    up = true;
    if (handshakeOnStart) handshake = DateTime.now();
  }

  @override
  Future<void> stop() async {
    calls.add('stop');
    up = false;
    handshake = null;
  }

  @override
  Future<EngineStatus> status() async => EngineStatus(
        up: up,
        serverId: up ? 'srv' : null,
        stats: up ? TunnelStats(rxBytes: rx, txBytes: tx, lastHandshake: handshake) : null,
      );

  @override
  Future<void> openSystemVpnSettings() async {}
  @override
  Future<Map<String, Object?>> diagnostics() async => {};
}

class FakeProvisioner implements Provisioner {
  ProvisionException? failWith;
  String? lastKey;

  @override
  Future<TunnelConfig> provision({required VpnServer server, required String devicePublicKey}) async {
    lastKey = devicePublicKey;
    if (failWith != null) throw failWith!;
    return TunnelConfig(
      serverId: server.id,
      addresses: const ['10.64.0.2/32'],
      dns: const ['10.64.0.1'],
      serverPublicKey: 'SERVERKEY',
      endpoint: 'gw.example:51820',
      allowedIps: const ['0.0.0.0/0', '::/0'],
    );
  }
}

const server = VpnServer(
  id: 'srv',
  name: 'Test',
  countryCode: 'NL',
  city: 'Amsterdam',
  tier: ServerTier.free,
  availability: ServerAvailability.online,
  probeHost: 'gw.example',
  probePort: 443,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeEngine engine;
  late FakeProvisioner provisioner;
  late ProviderContainer c;

  setUp(() {
    engine = FakeEngine();
    provisioner = FakeProvisioner();
    c = ProviderContainer(overrides: [
      vpnEngineProvider.overrideWithValue(engine),
      provisionerProvider.overrideWithValue(provisioner),
      routingPolicyProvider.overrideWithValue(const RoutingPolicy()),
      vpnTimingsProvider.overrideWithValue(const VpnTimings(
        handshakeTimeout: Duration(milliseconds: 300),
        handshakePoll: Duration(milliseconds: 20),
        statsPoll: Duration(milliseconds: 30),
        staleAfter: Duration(milliseconds: 200),
      )),
    ]);
    c.listen(vpnControllerProvider, (_, _) {});
  });

  tearDown(() => c.dispose());

  VpnController ctrl() => c.read(vpnControllerProvider.notifier);
  VpnState state() => c.read(vpnControllerProvider);

  test('connects only after a handshake is observed', () async {
    final phases = <VpnPhase>[];
    c.listen(vpnControllerProvider, (_, n) => phases.add(n.phase));
    await ctrl().connect(server);
    expect(state().phase, VpnPhase.connected);
    expect(state().connectedSince, isNotNull);
    expect(engine.calls, ['prepare', 'publicKey', 'start:srv']);
    expect(provisioner.lastKey, 'PUBKEY');
    expect(phases.first, VpnPhase.connecting);
  });

  test('no handshake -> tunnel torn down and an error, never "connected"', () async {
    engine.handshakeOnStart = false;
    final phases = <VpnPhase>[];
    c.listen(vpnControllerProvider, (_, n) => phases.add(n.phase));
    await ctrl().connect(server);
    expect(state().phase, VpnPhase.error);
    expect(state().error!.kind, VpnErrorKind.handshakeTimeout);
    expect(engine.calls.last, 'stop');
    expect(engine.up, isFalse);
    expect(phases, isNot(contains(VpnPhase.connected)));
  });

  test('a stale handshake from before the attempt does not count', () async {
    engine.handshakeOnStart = false;
    engine.handshake = DateTime.now().subtract(const Duration(minutes: 10));
    await ctrl().connect(server);
    expect(state().phase, VpnPhase.error);
  });

  test('permission denied is reported and nothing starts', () async {
    engine.permission = false;
    await ctrl().connect(server);
    expect(state().error!.kind, VpnErrorKind.permissionDenied);
    expect(engine.calls, ['prepare']);
  });

  test('provisioning failures map to their error kind', () async {
    provisioner.failWith = const ProvisionException(VpnErrorKind.deviceLimit);
    await ctrl().connect(server);
    expect(state().error!.kind, VpnErrorKind.deviceLimit);
    expect(engine.calls, isNot(contains('start:srv')));
  });

  test('requires a selected server', () async {
    await ctrl().connect(null);
    expect(state().error!.kind, VpnErrorKind.noServerSelected);
  });

  test('engine start failure surfaces as tunnelFailed', () async {
    engine.startError = 'BACKEND_FAILED';
    await ctrl().connect(server);
    expect(state().error!.kind, VpnErrorKind.tunnelFailed);
  });

  test('disconnect stops the tunnel and verifies it is down', () async {
    await ctrl().connect(server);
    await ctrl().disconnect();
    expect(state().phase, VpnPhase.disconnected);
    expect(engine.up, isFalse);
  });

  test('system revocation while connected shows a revoked error', () async {
    await ctrl().connect(server);
    engine.up = false;
    engine.emit(const TunnelStateEvent(up: false, reason: 'revoked'));
    await Future<void>.delayed(Duration.zero);
    expect(state().phase, VpnPhase.error);
    expect(state().error!.kind, VpnErrorKind.revoked);
  });

  test('stale handshake while connected -> reconnecting, tunnel kept up', () async {
    await ctrl().connect(server);
    engine.handshake = DateTime.now().subtract(const Duration(seconds: 5));
    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(state().phase, VpnPhase.reconnecting);
    expect(engine.up, isTrue, reason: 'never drop protection silently');
    engine.handshake = DateTime.now();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(state().phase, VpnPhase.connected);
  });

  test('stats polling computes transfer rates from real counters', () async {
    final rates = <double>[];
    c.listen(vpnControllerProvider, (_, n) {
      if (n.rxRate != null) rates.add(n.rxRate!);
    });
    await ctrl().connect(server);
    await Future<void>.delayed(const Duration(milliseconds: 45));
    engine.rx = 100000;
    engine.tx = 5000;
    await Future<void>.delayed(const Duration(milliseconds: 90));
    expect(state().stats!.rxBytes, 100000);
    expect(rates.any((r) => r > 0), isTrue);
    expect(rates.every((r) => r >= 0), isTrue);
  });

  test('disconnect during connect cancels the attempt', () async {
    engine.handshakeOnStart = false;
    final pending = ctrl().connect(server);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await ctrl().disconnect();
    await pending;
    expect(state().phase, VpnPhase.disconnected);
  });
}
