import 'package:flutter_test/flutter_test.dart';
import 'package:orvane/features/vpn/domain/routing.dart';
import 'package:orvane/features/vpn/domain/vpn_models.dart';

TunnelConfig cfg({List<String> addresses = const ['10.64.0.2/32'], List<String> allowed = const ['0.0.0.0/0', '::/0']}) =>
    TunnelConfig(
      serverId: 's',
      addresses: addresses,
      dns: const ['10.64.0.1'],
      serverPublicKey: 'k',
      endpoint: 'e:51820',
      allowedIps: allowed,
    );

void main() {
  test('default policy keeps full-tunnel routes', () {
    final c = applyRouting(cfg(), const RoutingPolicy());
    expect(c.allowedIps, ['0.0.0.0/0', '::/0']);
  });

  test('excluding LAN swaps 0/0 for public ranges and keeps DNS in-tunnel', () {
    final c = applyRouting(cfg(), const RoutingPolicy(excludeLan: true));
    expect(c.allowedIps, isNot(contains('0.0.0.0/0')));
    expect(c.allowedIps, containsAll(publicIpv4Ranges));
    expect(c.allowedIps, contains('10.64.0.1/32'));
    expect(c.allowedIps.any((r) => r.startsWith('192.168.')), isFalse);
    expect(c.allowedIps.any((r) => r.startsWith('10.0.')), isFalse);
  });

  test('IPv6 leak blocking adds ::/0 even when the server gave none', () {
    final c = applyRouting(cfg(allowed: ['0.0.0.0/0']), const RoutingPolicy());
    expect(c.allowedIps, contains('::/0'));
  });

  test('without leak blocking and no v6 address, ::/0 is dropped', () {
    final c = applyRouting(cfg(), const RoutingPolicy(blockIpv6Leaks: false));
    expect(c.allowedIps, ['0.0.0.0/0']);
  });

  test('without leak blocking, ::/0 stays when the tunnel has IPv6', () {
    final c = applyRouting(cfg(addresses: ['10.64.0.2/32', 'fd00::2/128']), const RoutingPolicy(blockIpv6Leaks: false));
    expect(c.allowedIps, contains('::/0'));
  });
}
