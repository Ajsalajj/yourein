import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/design/components/pressable.dart';
import '../core/design/theme.dart';
import '../core/motion/tilt.dart';
import '../features/servers/application/server_providers.dart';
import '../features/settings/app_settings.dart';
import '../features/subscription/billing.dart';
import '../features/vpn/application/vpn_controller.dart';
import 'router.dart';

class OrvaneApp extends ConsumerStatefulWidget {
  const OrvaneApp({super.key});

  @override
  ConsumerState<OrvaneApp> createState() => _OrvaneAppState();
}

class _OrvaneAppState extends ConsumerState<OrvaneApp> {
  final GoRouter _router = buildRouter();

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setSystemUIOverlayStyle(orvaneSystemUi);
    // Play redelivers unfinished purchases on the purchase stream; it must be
    // listened to from launch.
    ref.read(billingControllerProvider);
    _connectOnLaunch();
  }

  Future<void> _connectOnLaunch() async {
    if (!ref.read(settingsProvider).connectOnLaunch) return;
    try {
      await ref.read(serversProvider.future);
    } on Object {
      return;
    }
    final server = ref.read(selectedServerProvider);
    if (server != null && mounted) ref.read(vpnControllerProvider.notifier).connect(server);
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    OHaptics.enabled = settings.haptics;
    return MaterialApp.router(
      title: 'Orvane',
      debugShowCheckedModeBanner: false,
      theme: buildOrvaneTheme(),
      routerConfig: _router,
      builder: (context, child) => TiltScope(reduceMotion: settings.reduceMotion, child: child!),
    );
  }
}
