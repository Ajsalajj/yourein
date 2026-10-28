import 'latency_probe_stub.dart' if (dart.library.io) 'latency_probe_io.dart' as impl;

/// Measures round-trip latency to a server by timing a TCP connection to
/// its probe port. Returns null when it can't be measured (timeout,
/// unreachable, or a platform without sockets); callers show a dash rather
/// than a number in that case.
Future<Duration?> measureLatency(String host, int port, {Duration timeout = const Duration(seconds: 3)}) =>
    impl.measureLatency(host, port, timeout);
