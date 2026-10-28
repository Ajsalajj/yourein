/// Human-readable formatting for measured values.
abstract final class Fmt {
  static String bytes(int? b) {
    if (b == null) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var v = b.toDouble();
    var u = 0;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u++;
    }
    final digits = u == 0 || v >= 100 ? 0 : (v >= 10 ? 1 : 2);
    return '${v.toStringAsFixed(digits)} ${units[u]}';
  }

  /// Bytes/second as bits/second, the unit people know from speed tests.
  static String rate(double? bytesPerSecond) {
    if (bytesPerSecond == null) return '—';
    var v = bytesPerSecond * 8;
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    var u = 0;
    while (v >= 1000 && u < units.length - 1) {
      v /= 1000;
      u++;
    }
    final digits = u == 0 || v >= 100 ? 0 : 1;
    return '${v.toStringAsFixed(digits)} ${units[u]}';
  }

  static String clock(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '${h.toString().padLeft(2, '0')}:$m:$s';
  }

  static String latency(Duration? d) => d == null ? '—' : '${d.inMilliseconds} ms';

  static String ago(DateTime? t, {DateTime? now}) {
    if (t == null) return 'never';
    final d = (now ?? DateTime.now()).difference(t);
    if (d.inSeconds < 5) return 'just now';
    if (d.inSeconds < 60) return '${d.inSeconds}s ago';
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return '${d.inDays}d ago';
  }

  static String date(DateTime d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${d.day} ${months[d.month - 1]} ${d.year}';
  }
}
