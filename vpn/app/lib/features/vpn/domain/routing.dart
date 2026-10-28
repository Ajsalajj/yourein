import 'vpn_models.dart';

/// Public IPv4 space: 0.0.0.0/0 minus RFC 1918 private ranges, loopback,
/// link-local and multicast. Same set the official WireGuard app uses for
/// "exclude private IPs".
const publicIpv4Ranges = [
  '0.0.0.0/5', '8.0.0.0/7', '11.0.0.0/8', '12.0.0.0/6', '16.0.0.0/4', '32.0.0.0/3', '64.0.0.0/2',
  '128.0.0.0/3', '160.0.0.0/5', '168.0.0.0/6', '172.0.0.0/12', '172.32.0.0/11', '172.64.0.0/10',
  '172.128.0.0/9', '173.0.0.0/8', '174.0.0.0/7', '176.0.0.0/4', '192.0.0.0/9', '192.128.0.0/11',
  '192.160.0.0/13', '192.169.0.0/16', '192.170.0.0/15', '192.172.0.0/14', '192.176.0.0/12',
  '192.192.0.0/10', '193.0.0.0/8', '194.0.0.0/7', '196.0.0.0/6', '200.0.0.0/5', '208.0.0.0/4',
];

class RoutingPolicy {
  const RoutingPolicy({this.blockIpv6Leaks = true, this.excludeLan = false});
  final bool blockIpv6Leaks;
  final bool excludeLan;
}

/// Applies the user's routing choices to a server-issued config.
TunnelConfig applyRouting(TunnelConfig c, RoutingPolicy p) {
  var allowed = [...c.allowedIps];

  if (p.excludeLan && allowed.contains('0.0.0.0/0')) {
    allowed.remove('0.0.0.0/0');
    allowed.insertAll(0, publicIpv4Ranges);
    // The tunnel's own DNS resolver usually sits in private space; keep it
    // reachable through the tunnel or DNS would leak to the local network.
    for (final dns in c.dns.where((d) => !d.contains(':'))) {
      final host = '$dns/32';
      if (!allowed.contains(host)) allowed.add(host);
    }
  }

  final hasV6Address = c.addresses.any((a) => a.contains(':'));
  if (p.blockIpv6Leaks) {
    // Capturing ::/0 without a v6 address blackholes IPv6 instead of
    // letting it leave outside the tunnel.
    if (!allowed.contains('::/0')) allowed.add('::/0');
  } else if (!hasV6Address) {
    allowed = allowed.where((a) => a != '::/0').toList();
  }

  return TunnelConfig(
    serverId: c.serverId,
    addresses: c.addresses,
    dns: c.dns,
    serverPublicKey: c.serverPublicKey,
    endpoint: c.endpoint,
    allowedIps: allowed,
    presharedKey: c.presharedKey,
    persistentKeepalive: c.persistentKeepalive,
    mtu: c.mtu,
  );
}
