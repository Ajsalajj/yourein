import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'features/servers/application/server_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ProviderScope(
      // Failed loads surface to the user with a retry action instead of
      // being retried silently in the background.
      retry: (_, _) => null,
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const OrvaneApp(),
    ),
  );
}
