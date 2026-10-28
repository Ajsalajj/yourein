import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/design/tokens.dart';
import '../features/account/account_screen.dart';
import '../features/auth/auth_screen.dart';
import '../features/home/home_screen.dart';
import '../features/insights/insights_screen.dart';
import '../features/onboarding/onboarding_screen.dart';
import '../features/onboarding/splash_screen.dart';
import '../features/servers/locations_screen.dart';
import '../features/servers/server_detail_screen.dart';
import '../features/settings/privacy_screen.dart';
import '../features/settings/vpn_settings_screen.dart';
import '../features/subscription/premium_screen.dart';
import '../features/support/help_screen.dart';
import 'shell.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Pushed screens glide up and settle; the outgoing screen recedes slightly,
/// which reads as depth rather than a flat slide.
CustomTransitionPage<void> _page(GoRouterState state, Widget child) => CustomTransitionPage<void>(
      key: state.pageKey,
      child: child,
      transitionDuration: OMotion.emphasized,
      reverseTransitionDuration: OMotion.standard,
      transitionsBuilder: (context, a, secondary, child) {
        final t = OMotion.enter.transform(a.value);
        final back = OMotion.inOut.transform(secondary.value);
        return Opacity(
          opacity: a.value.clamp(0, 1),
          child: Transform.translate(
            offset: Offset(0, 28 * (1 - t)),
            child: Transform.scale(scale: 1 - 0.04 * back, child: child),
          ),
        );
      },
    );

/// Tab switches cross-fade quickly; tabs are siblings, not a hierarchy.
NoTransitionPage<void> _tab(GoRouterState state, Widget child) => NoTransitionPage<void>(key: state.pageKey, child: child);

GoRouter buildRouter() => GoRouter(
      navigatorKey: _rootKey,
      initialLocation: '/splash',
      routes: [
        GoRoute(path: '/splash', pageBuilder: (c, s) => _page(s, const SplashScreen())),
        GoRoute(path: '/onboarding', pageBuilder: (c, s) => _page(s, const OnboardingScreen())),
        GoRoute(path: '/auth', pageBuilder: (c, s) => _page(s, AuthScreen(next: s.uri.queryParameters['next']))),
        StatefulShellRoute(
          builder: (context, state, shell) => AppShell(shell: shell),
          navigatorContainerBuilder: (context, shell, children) => _FadingBranches(index: shell.currentIndex, children: children),
          branches: [
            StatefulShellBranch(routes: [GoRoute(path: '/home', pageBuilder: (c, s) => _tab(s, const HomeScreen()))]),
            StatefulShellBranch(routes: [GoRoute(path: '/locations', pageBuilder: (c, s) => _tab(s, const LocationsScreen()))]),
            StatefulShellBranch(routes: [GoRoute(path: '/insights', pageBuilder: (c, s) => _tab(s, const InsightsScreen()))]),
            StatefulShellBranch(routes: [GoRoute(path: '/account', pageBuilder: (c, s) => _tab(s, const AccountScreen()))]),
          ],
        ),
        GoRoute(
          path: '/locations/:id',
          parentNavigatorKey: _rootKey,
          pageBuilder: (c, s) => _page(s, ServerDetailScreen(serverId: s.pathParameters['id']!)),
        ),
        GoRoute(path: '/premium', parentNavigatorKey: _rootKey, pageBuilder: (c, s) => _page(s, const PremiumScreen())),
        GoRoute(path: '/settings/vpn', parentNavigatorKey: _rootKey, pageBuilder: (c, s) => _page(s, const VpnSettingsScreen())),
        GoRoute(path: '/settings/privacy', parentNavigatorKey: _rootKey, pageBuilder: (c, s) => _page(s, const PrivacyScreen())),
        GoRoute(path: '/help', parentNavigatorKey: _rootKey, pageBuilder: (c, s) => _page(s, const HelpScreen())),
      ],
    );

/// Keeps every tab alive (state and scroll position preserved) and
/// cross-fades between them. Hidden tabs have tickers muted.
class _FadingBranches extends StatelessWidget {
  const _FadingBranches({required this.index, required this.children});

  final int index;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        for (var i = 0; i < children.length; i++)
          IgnorePointer(
            ignoring: i != index,
            // The fade must sit outside TickerMode: a muted ticker would
            // freeze the fade-out and leave the old tab half visible.
            child: AnimatedOpacity(
              opacity: i == index ? 1 : 0,
              duration: OMotion.quick,
              curve: OMotion.inOut,
              child: TickerMode(
                enabled: i == index,
                child: ExcludeSemantics(excluding: i != index, child: children[i]),
              ),
            ),
          ),
      ],
    );
  }
}
