import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../vpn/application/vpn_controller.dart';
import '../vpn/domain/vpn_models.dart';

class ThroughputSample {
  const ThroughputSample(this.rx, this.tx);
  final double rx; // bytes/s
  final double tx;
}

/// Rolling window of measured transfer rates for the current session, kept
/// in memory only. Cleared when the session ends.
class ThroughputHistory extends Notifier<List<ThroughputSample>> {
  static const window = 60;

  @override
  List<ThroughputSample> build() {
    ref.listen(vpnControllerProvider, (prev, next) {
      final live = next.phase == VpnPhase.connected || next.phase == VpnPhase.reconnecting;
      if (!live) {
        if (state.isNotEmpty) state = const [];
        return;
      }
      if (next.rxRate == null || next.txRate == null) return;
      if (prev?.stats == next.stats) return; // only on a new poll
      final s = [...state, ThroughputSample(next.rxRate!, next.txRate!)];
      state = s.length > window ? s.sublist(s.length - window) : s;
    });
    return const [];
  }
}

final throughputHistoryProvider = NotifierProvider<ThroughputHistory, List<ThroughputSample>>(ThroughputHistory.new);
