import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/application/auth_controller.dart';
import 'config/app_config.dart';
import 'net/api_client.dart';

final appConfigProvider = Provider<AppConfig>((ref) => AppConfig.fromEnvironment());

/// The Orvane API client, or null when the build has no API address.
final apiClientProvider = Provider<ApiClient?>((ref) {
  final config = ref.watch(appConfigProvider);
  if (!config.hasApi) return null;
  final auth = ref.read(authControllerProvider.notifier);
  final client = ApiClient(
    baseUrl: config.apiBaseUrl,
    accessToken: auth.accessToken,
    onUnauthorized: () async => (await auth.forceRefresh()) != null,
  );
  ref.onDispose(client.close);
  return client;
});
