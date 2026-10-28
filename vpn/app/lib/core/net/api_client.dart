import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException(this.status, this.code, [this.message]);

  /// HTTP status, or 0 when the request never got a response.
  final int status;

  /// Stable machine-readable code from the backend (e.g. `device_limit`).
  final String code;
  final String? message;

  bool get isNetwork => status == 0;

  @override
  String toString() => 'ApiException($status, $code)';
}

/// Minimal JSON client for the Orvane API.
///
/// Attaches the current access token, retries once after a token refresh on
/// 401, and maps failures to [ApiException]. Request and response bodies are
/// never logged: they can contain account data and public keys.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.accessToken,
    this.onUnauthorized,
    http.Client? client,
    this.timeout = const Duration(seconds: 15),
  }) : _http = client ?? http.Client();

  final String baseUrl;
  final Future<String?> Function() accessToken;

  /// Called on a 401; return true if the token was refreshed and the request
  /// should be retried.
  final Future<bool> Function()? onUnauthorized;
  final Duration timeout;
  final http.Client _http;

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body, bool retried = false]) async {
    final uri = Uri.parse('$baseUrl$path');
    final token = await accessToken();
    final req = http.Request(method, uri)
      ..headers['accept'] = 'application/json'
      ..headers['x-client'] = 'orvane-android';
    if (token != null) req.headers['authorization'] = 'Bearer $token';
    if (body != null) {
      req.headers['content-type'] = 'application/json';
      req.body = jsonEncode(body);
    }

    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(timeout));
    } on TimeoutException {
      throw const ApiException(0, 'timeout');
    } on http.ClientException catch (e) {
      throw ApiException(0, 'network', e.message);
    }

    if (res.statusCode == 401 && !retried && onUnauthorized != null && await onUnauthorized!()) {
      return _send(method, path, body, true);
    }

    final decoded = res.body.isEmpty ? null : _tryJson(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return decoded;

    final err = decoded is Map ? decoded['error'] : null;
    throw ApiException(
      res.statusCode,
      err is Map ? (err['code'] as String? ?? 'http_${res.statusCode}') : 'http_${res.statusCode}',
      err is Map ? err['message'] as String? : null,
    );
  }

  static Object? _tryJson(String s) {
    try {
      return jsonDecode(s);
    } on FormatException {
      return null;
    }
  }

  void close() => _http.close();
}
