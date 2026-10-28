import 'package:flutter/foundation.dart';

enum ServerTier { free, premium }

enum ServerAvailability { online, maintenance, offline }

/// A VPN gateway location as published by the Orvane backend inventory.
/// Nothing here is invented client-side: latency is measured on the device
/// separately (see LatencyProbe) and load comes from the gateway agent.
@immutable
class VpnServer {
  const VpnServer({
    required this.id,
    required this.name,
    required this.countryCode,
    required this.city,
    required this.tier,
    required this.availability,
    required this.probeHost,
    required this.probePort,
    this.loadPercent,
  });

  final String id;
  final String name;

  /// ISO 3166-1 alpha-2, upper case.
  final String countryCode;
  final String city;
  final ServerTier tier;
  final ServerAvailability availability;

  /// TCP endpoint the device can time a connection to for real latency.
  final String probeHost;
  final int probePort;

  /// Gateway-reported load, if the agent has reported recently.
  final int? loadPercent;

  bool get isPremium => tier == ServerTier.premium;
  bool get isOnline => availability == ServerAvailability.online;

  /// Regional-indicator emoji flag derived from the country code.
  String get flag {
    if (countryCode.length != 2) return '🏳';
    final cc = countryCode.toUpperCase();
    return String.fromCharCodes([0x1F1E6 + cc.codeUnitAt(0) - 65, 0x1F1E6 + cc.codeUnitAt(1) - 65]);
  }

  String get countryName => countryNames[countryCode.toUpperCase()] ?? countryCode.toUpperCase();

  factory VpnServer.fromJson(Map<String, dynamic> j) => VpnServer(
        id: j['id'] as String,
        name: j['name'] as String,
        countryCode: (j['countryCode'] as String).toUpperCase(),
        city: j['city'] as String,
        tier: j['tier'] == 'premium' ? ServerTier.premium : ServerTier.free,
        availability: switch (j['status']) {
          'online' => ServerAvailability.online,
          'maintenance' => ServerAvailability.maintenance,
          _ => ServerAvailability.offline,
        },
        probeHost: (j['probe'] as Map)['host'] as String,
        probePort: ((j['probe'] as Map)['port'] as num).toInt(),
        loadPercent: (j['loadPercent'] as num?)?.toInt(),
      );

  @override
  bool operator ==(Object other) => other is VpnServer && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// Display names for country codes the inventory may use. Unknown codes
/// fall back to the code itself.
const Map<String, String> countryNames = {
  'AE': 'United Arab Emirates', 'AR': 'Argentina', 'AT': 'Austria', 'AU': 'Australia',
  'BE': 'Belgium', 'BG': 'Bulgaria', 'BR': 'Brazil', 'CA': 'Canada', 'CH': 'Switzerland',
  'CL': 'Chile', 'CO': 'Colombia', 'CZ': 'Czechia', 'DE': 'Germany', 'DK': 'Denmark',
  'EE': 'Estonia', 'ES': 'Spain', 'FI': 'Finland', 'FR': 'France', 'GB': 'United Kingdom',
  'GR': 'Greece', 'HK': 'Hong Kong', 'HR': 'Croatia', 'HU': 'Hungary', 'ID': 'Indonesia',
  'IE': 'Ireland', 'IL': 'Israel', 'IN': 'India', 'IS': 'Iceland', 'IT': 'Italy', 'JP': 'Japan',
  'KR': 'South Korea', 'LT': 'Lithuania', 'LU': 'Luxembourg', 'LV': 'Latvia', 'MX': 'Mexico',
  'MY': 'Malaysia', 'NG': 'Nigeria', 'NL': 'Netherlands', 'NO': 'Norway', 'NZ': 'New Zealand',
  'PH': 'Philippines', 'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'RS': 'Serbia',
  'SA': 'Saudi Arabia', 'SE': 'Sweden', 'SG': 'Singapore', 'SI': 'Slovenia', 'SK': 'Slovakia',
  'TH': 'Thailand', 'TR': 'Türkiye', 'TW': 'Taiwan', 'UA': 'Ukraine', 'US': 'United States',
  'VN': 'Vietnam', 'ZA': 'South Africa',
};
