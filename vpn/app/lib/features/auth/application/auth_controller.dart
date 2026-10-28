import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../data/auth_service.dart';

final authServiceProvider = Provider<AuthService?>((ref) {
  final config = ref.watch(appConfigProvider);
  if (!config.hasAuth) return null;
  return AuthService(supabaseUrl: config.supabaseUrl, anonKey: config.supabaseAnonKey);
});

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthSession?>(AuthController.new);

/// Holds the signed-in session and hands out fresh access tokens.
class AuthController extends AsyncNotifier<AuthSession?> {
  Future<AuthSession?>? _refreshing;

  AuthService? get _svc => ref.read(authServiceProvider);

  @override
  Future<AuthSession?> build() async {
    final svc = ref.watch(authServiceProvider);
    return svc?.restore();
  }

  AuthService _require() {
    final svc = _svc;
    if (svc == null) {
      throw const AuthException('not_configured', 'This build isn’t connected to an Orvane account service.');
    }
    return svc;
  }

  Future<void> signIn(String email, String password) async {
    final s = await _require().signIn(email, password);
    state = AsyncData(s);
  }

  /// Returns true when the user must confirm their email before signing in.
  Future<bool> signUp(String email, String password) async {
    final r = await _require().signUp(email, password);
    switch (r) {
      case SignedUp(:final session):
        state = AsyncData(session);
        return false;
      case ConfirmationRequired():
        return true;
    }
  }

  Future<void> sendPasswordReset(String email) => _require().sendPasswordReset(email);

  Future<void> signOut() async {
    await _svc?.signOut(state.value);
    state = const AsyncData(null);
  }

  Future<void> clearAfterAccountDeletion() async {
    await _svc?.clearLocal();
    state = const AsyncData(null);
  }

  /// A valid access token, refreshed first if it's about to expire.
  /// Concurrent callers share a single refresh request.
  Future<String?> accessToken() async {
    final s = await future;
    if (s == null) return null;
    if (!s.expiresSoon) return s.accessToken;
    return (await forceRefresh())?.accessToken;
  }

  Future<AuthSession?> forceRefresh() {
    return _refreshing ??= () async {
      try {
        final s = state.value;
        if (s == null) return null;
        final next = await _require().refresh(s);
        state = AsyncData(next);
        return next;
      } on AuthException catch (e) {
        // A rejected refresh token means the session is over.
        if (e.code != 'network') {
          await _svc?.clearLocal();
          state = const AsyncData(null);
        }
        return null;
      } finally {
        _refreshing = null;
      }
    }();
  }
}
