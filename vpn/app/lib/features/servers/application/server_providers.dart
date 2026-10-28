import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/net/api_client.dart';
import '../../../core/providers.dart';
import '../data/latency_probe.dart';
import '../domain/server.dart';

final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('Overridden in main() after SharedPreferences.getInstance()'),
);

class ServersUnavailable implements Exception {
  const ServersUnavailable(this.reason);
  final String reason;
}

/// Server inventory from the backend. There is deliberately no built-in or
/// fallback list: a location exists only if the backend publishes it.
final serversProvider = FutureProvider<List<VpnServer>>((ref) async {
  final api = ref.watch(apiClientProvider);
  if (api == null) throw const ServersUnavailable('not_configured');
  try {
    final data = await api.get('/v1/servers') as Map<String, dynamic>;
    final list = (data['servers'] as List).cast<Map<String, dynamic>>().map(VpnServer.fromJson).toList();
    list.sort((a, b) {
      final c = a.countryName.compareTo(b.countryName);
      return c != 0 ? c : a.city.compareTo(b.city);
    });
    return list;
  } on ApiException catch (e) {
    throw ServersUnavailable(e.isNetwork ? 'network' : e.code);
  }
}, retry: (_, _) => null);

/// Measured latency per server id. Values are only ever written from a real
/// probe; a missing entry means "not measured yet", null means "failed".
class LatencyNotifier extends Notifier<Map<String, Duration?>> {
  bool _running = false;

  @override
  Map<String, Duration?> build() => const {};

  Future<void> measureAll() async {
    if (_running) return;
    final servers = ref.read(serversProvider).value;
    if (servers == null || servers.isEmpty) return;
    _running = true;
    try {
      // Small batches: quick results without a burst of sockets.
      final online = servers.where((s) => s.isOnline).toList();
      for (var i = 0; i < online.length; i += 6) {
        final batch = online.skip(i).take(6);
        final results = await Future.wait(batch.map((s) async => MapEntry(s.id, await measureLatency(s.probeHost, s.probePort))));
        if (!ref.mounted) return;
        state = {...state, ...Map.fromEntries(results)};
      }
    } finally {
      _running = false;
    }
  }
}

final latencyProvider = NotifierProvider<LatencyNotifier, Map<String, Duration?>>(LatencyNotifier.new);

class FavoritesNotifier extends Notifier<Set<String>> {
  static const _key = 'servers.favorites';

  @override
  Set<String> build() => ref.watch(sharedPrefsProvider).getStringList(_key)?.toSet() ?? {};

  void toggle(String id) {
    final next = {...state};
    if (!next.remove(id)) next.add(id);
    state = next;
    ref.read(sharedPrefsProvider).setStringList(_key, next.toList());
  }
}

final favoritesProvider = NotifierProvider<FavoritesNotifier, Set<String>>(FavoritesNotifier.new);

class SelectedServerNotifier extends Notifier<String?> {
  static const _key = 'servers.selected';

  @override
  String? build() => ref.watch(sharedPrefsProvider).getString(_key);

  void select(String id) {
    state = id;
    ref.read(sharedPrefsProvider).setString(_key, id);
  }
}

final selectedServerIdProvider = NotifierProvider<SelectedServerNotifier, String?>(SelectedServerNotifier.new);

/// The chosen server, resolved against the live inventory.
final selectedServerProvider = Provider<VpnServer?>((ref) {
  final id = ref.watch(selectedServerIdProvider);
  final servers = ref.watch(serversProvider).value;
  if (id == null || servers == null) return null;
  for (final s in servers) {
    if (s.id == id) return s;
  }
  return null;
});

/// Lowest measured latency among online servers the user may use.
final fastestServerProvider = Provider.family<VpnServer?, bool>((ref, premium) {
  final servers = ref.watch(serversProvider).value ?? const [];
  final latency = ref.watch(latencyProvider);
  VpnServer? best;
  Duration? bestLatency;
  for (final s in servers) {
    if (!s.isOnline || (s.isPremium && !premium)) continue;
    final l = latency[s.id];
    if (l == null) continue;
    if (bestLatency == null || l < bestLatency) {
      best = s;
      bestLatency = l;
    }
  }
  return best;
});
