// Design review harness — NOT part of the app.
//
// Renders screens in a chosen visual state so designers can review every
// state of the sphere and home screen in a browser:
//
//   flutter build web -t tool/design_gallery.dart --no-web-resources-cdn
//   open build/web/index.html?state=connected
//
// It pins the VPN controller to a fixed [VpnState]; nothing here connects
// to anything, and the app's real entry point (lib/main.dart) never imports
// this file.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:orvane/core/design/components/ambient_background.dart';
import 'package:orvane/core/design/theme.dart';
import 'package:orvane/core/motion/tilt.dart';
import 'package:orvane/features/home/home_screen.dart';
import 'package:orvane/features/servers/application/server_providers.dart';
import 'package:orvane/features/vpn/application/vpn_controller.dart';
import 'package:orvane/features/vpn/domain/vpn_models.dart';

class _PinnedVpn extends VpnController {
  _PinnedVpn(this.pinned);
  final VpnState pinned;
  @override
  VpnState build() => pinned;
}

VpnState _stateFor(String name) {
  final now = DateTime.now();
  return switch (name) {
    'connecting' => const VpnState(phase: VpnPhase.connecting, step: ConnectStep.starting),
    'connected' => VpnState(
        phase: VpnPhase.connected,
        connectedSince: now.subtract(const Duration(minutes: 12, seconds: 41)),
        stats: const TunnelStats(rxBytes: 0, txBytes: 0),
      ),
    'reconnecting' => const VpnState(phase: VpnPhase.reconnecting),
    'error' => const VpnState(phase: VpnPhase.error, error: VpnError(VpnErrorKind.handshakeTimeout)),
    _ => const VpnState(),
  };
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final state = Uri.base.queryParameters['state'] ?? 'disconnected';
  runApp(ProviderScope(
    overrides: [
      sharedPrefsProvider.overrideWithValue(prefs),
      vpnControllerProvider.overrideWith(() => _PinnedVpn(_stateFor(state))),
    ],
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildOrvaneTheme(),
      home: const TiltScope(child: Scaffold(body: AmbientBackground(child: HomeScreen()))),
    ),
  ));
}
