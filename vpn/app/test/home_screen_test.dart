import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:orvane/core/design/theme.dart';
import 'package:orvane/core/motion/tilt.dart';
import 'package:orvane/features/home/home_screen.dart';
import 'package:orvane/features/servers/application/server_providers.dart';
import 'package:orvane/features/vpn/application/vpn_controller.dart';
import 'package:orvane/features/vpn/data/vpn_engine.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('without a VPN engine the sphere reports an error, never "Protected"', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        vpnEngineProvider.overrideWithValue(const UnsupportedVpnEngine()),
      ],
      child: MaterialApp(
        theme: buildOrvaneTheme(),
        home: const MediaQuery(
          // Reduced motion keeps the test deterministic (no endless tickers).
          data: MediaQueryData(disableAnimations: true, size: Size(390, 844)),
          child: TiltScope(child: Scaffold(body: HomeScreen())),
        ),
      ),
    ));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Tap to connect'), findsOneWidget);
    expect(find.text('Not protected'), findsOneWidget);
    expect(find.text('Locations unavailable'), findsOneWidget, reason: 'no API configured in tests');

    await tester.tap(find.bySemanticsLabel('Connect VPN'));
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('VPN unavailable on this device'), findsOneWidget);
    expect(find.text('Protected'), findsNothing);
    expect(find.text('Not connected'), findsOneWidget);
  });
}
