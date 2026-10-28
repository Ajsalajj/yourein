/// Build-time configuration, supplied with `--dart-define` (or
/// `--dart-define-from-file=config/<env>.json`). Nothing secret belongs here:
/// a Supabase anon key is public by design and every protected operation is
/// authorised server-side.
class AppConfig {
  const AppConfig({required this.apiBaseUrl, required this.supabaseUrl, required this.supabaseAnonKey});

  factory AppConfig.fromEnvironment() => const AppConfig(
        apiBaseUrl: String.fromEnvironment('ORVANE_API_URL'),
        supabaseUrl: String.fromEnvironment('SUPABASE_URL'),
        supabaseAnonKey: String.fromEnvironment('SUPABASE_ANON_KEY'),
      );

  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  bool get hasApi => apiBaseUrl.isNotEmpty;
  bool get hasAuth => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
}
