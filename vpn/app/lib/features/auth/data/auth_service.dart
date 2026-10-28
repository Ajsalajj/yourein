import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

@immutable
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.userId,
    required this.email,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime expiresAt;
  final String userId;
  final String email;

  bool get expiresSoon => DateTime.now().isAfter(expiresAt.subtract(const Duration(seconds: 60)));

  factory AuthSession.fromGoTrue(Map<String, dynamic> j) {
    final user = j['user'] as Map<String, dynamic>;
    final expiresAt = j['expires_at'] is num
        ? DateTime.fromMillisecondsSinceEpoch((j['expires_at'] as num).toInt() * 1000)
        : DateTime.now().add(Duration(seconds: (j['expires_in'] as num?)?.toInt() ?? 3600));
    return AuthSession(
      accessToken: j['access_token'] as String,
      refreshToken: j['refresh_token'] as String,
      expiresAt: expiresAt,
      userId: user['id'] as String,
      email: (user['email'] as String?) ?? '',
    );
  }

  Map<String, Object> toJson() => {
        'access_token': accessToken,
        'refresh_token': refreshToken,
        'expires_at': expiresAt.millisecondsSinceEpoch ~/ 1000,
        'user': {'id': userId, 'email': email},
      };
}

class AuthException implements Exception {
  const AuthException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => 'AuthException($code)';
}

/// Result of sign-up: either a live session, or "check your email" when the
/// project requires email confirmation.
sealed class SignUpResult {}

class SignedUp extends SignUpResult {
  SignedUp(this.session);
  final AuthSession session;
}

class ConfirmationRequired extends SignUpResult {}

/// Talks to Supabase Auth (GoTrue) over REST and persists the session in
/// Android Keystore-backed secure storage.
class AuthService {
  AuthService({
    required this.supabaseUrl,
    required this.anonKey,
    FlutterSecureStorage? storage,
    http.Client? client,
  })  : _storage = storage ?? const FlutterSecureStorage(),
        _http = client ?? http.Client();

  final String supabaseUrl;
  final String anonKey;
  final FlutterSecureStorage _storage;
  final http.Client _http;

  static const _key = 'orvane.session.v1';

  Future<AuthSession?> restore() async {
    try {
      final raw = await _storage.read(key: _key);
      if (raw == null) return null;
      return AuthSession.fromGoTrue(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      // Corrupt or undecryptable (e.g. keystore reset after restore): start clean.
      await _storage.delete(key: _key);
      return null;
    }
  }

  Future<void> _persist(AuthSession? s) =>
      s == null ? _storage.delete(key: _key) : _storage.write(key: _key, value: jsonEncode(s.toJson()));

  Future<Map<String, dynamic>> _post(String path, Map<String, Object?> body, {String? bearer}) async {
    final http.Response res;
    try {
      res = await _http
          .post(
            Uri.parse('$supabaseUrl/auth/v1$path'),
            headers: {
              'apikey': anonKey,
              'content-type': 'application/json',
              if (bearer != null) 'authorization': 'Bearer $bearer',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));
    } on Object {
      throw const AuthException('network', 'Can’t reach the sign-in service. Check your connection.');
    }
    final decoded = res.body.isEmpty ? <String, dynamic>{} : (jsonDecode(res.body) as Map<String, dynamic>);
    if (res.statusCode >= 200 && res.statusCode < 300) return decoded;
    final code = (decoded['error_code'] ?? decoded['error'] ?? 'http_${res.statusCode}').toString();
    throw AuthException(code, _friendly(code, res.statusCode));
  }

  static String _friendly(String code, int status) => switch (code) {
        'invalid_credentials' || 'invalid_grant' => 'That email and password don’t match.',
        'email_not_confirmed' => 'Confirm your email first — we sent you a link.',
        'user_already_exists' || 'email_exists' => 'An account with this email already exists.',
        'weak_password' => 'Choose a stronger password (at least 8 characters).',
        'over_request_rate_limit' || 'over_email_send_rate_limit' => 'Too many attempts. Wait a minute and try again.',
        'signup_disabled' => 'New sign-ups are currently closed.',
        _ => status >= 500 ? 'The sign-in service is having trouble. Try again shortly.' : 'Something went wrong. Try again.',
      };

  Future<AuthSession> signIn(String email, String password) async {
    final j = await _post('/token?grant_type=password', {'email': email.trim(), 'password': password});
    final s = AuthSession.fromGoTrue(j);
    await _persist(s);
    return s;
  }

  Future<SignUpResult> signUp(String email, String password) async {
    final j = await _post('/signup', {'email': email.trim(), 'password': password});
    if (j['access_token'] == null) return ConfirmationRequired();
    final s = AuthSession.fromGoTrue(j);
    await _persist(s);
    return SignedUp(s);
  }

  Future<AuthSession> refresh(AuthSession s) async {
    final j = await _post('/token?grant_type=refresh_token', {'refresh_token': s.refreshToken});
    final next = AuthSession.fromGoTrue(j);
    await _persist(next);
    return next;
  }

  Future<void> sendPasswordReset(String email) => _post('/recover', {'email': email.trim()});

  Future<void> signOut(AuthSession? s) async {
    if (s != null) {
      try {
        await _post('/logout', {}, bearer: s.accessToken);
      } on AuthException {
        // Local sign-out must succeed even if the server call fails.
      }
    }
    await _persist(null);
  }

  /// Drops the local session only (used after account deletion).
  Future<void> clearLocal() => _persist(null);
}
