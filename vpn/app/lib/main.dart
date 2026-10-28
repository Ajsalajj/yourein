import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/design/components/ambient_background.dart';
import 'core/design/theme.dart';
import 'core/motion/tilt.dart';
import 'features/home/home_screen.dart';
import 'features/servers/application/server_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
    child: MaterialApp(
      theme: buildOrvaneTheme(),
      home: const TiltScope(child: Scaffold(body: AmbientBackground(child: HomeScreen()))),
    ),
  ));
}
