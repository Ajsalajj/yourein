import 'dart:io';

Future<Duration?> measureLatency(String host, int port, Duration timeout) async {
  try {
    // Resolve first so DNS time isn't counted as network latency.
    final addresses = await InternetAddress.lookup(host).timeout(timeout);
    if (addresses.isEmpty) return null;
    final sw = Stopwatch()..start();
    final socket = await Socket.connect(addresses.first, port, timeout: timeout);
    sw.stop();
    socket.destroy();
    return sw.elapsed;
  } on Object {
    return null;
  }
}
