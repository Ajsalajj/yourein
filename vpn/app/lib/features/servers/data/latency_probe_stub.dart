/// Browsers can't open raw sockets, so latency is unavailable there.
Future<Duration?> measureLatency(String host, int port, Duration timeout) async => null;
