import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/design/components/ambient_background.dart';
import '../../core/design/components/brand.dart';
import '../../core/design/tokens.dart';
import '../../core/design/typography.dart';
import '../auth/application/auth_controller.dart';
import '../settings/app_settings.dart';

/// Brand moment while the session is restored from secure storage. It
/// leaves as soon as both the intro animation and the restore are done.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    final reduce = WidgetsBinding.instance.platformDispatcher.accessibilityFeatures.disableAnimations;
    final intro = reduce ? Future<void>.value() : _c.forward().orCancel.catchError((_) {});
    if (reduce) _c.value = 1;
    await Future.wait<Object?>([
      intro,
      ref.read(authControllerProvider.future).catchError((Object _) => null),
    ]);
    if (!mounted) return;
    final onboarded = ref.read(settingsProvider).onboardingDone;
    context.go(onboarded ? '/home' : '/onboarding');
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AmbientBackground(
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              final orb = OMotion.settle.transform(Interval(0, 0.55).transform(_c.value));
              final glow = Curves.easeOut.transform(Interval(0.2, 0.8).transform(_c.value));
              final word = OMotion.enter.transform(Interval(0.45, 1).transform(_c.value));
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: OElevation.glow(OColors.blue, strength: 1.4 * glow),
                    ),
                    child: Transform.scale(scale: 0.6 + 0.4 * orb, child: Opacity(opacity: orb.clamp(0, 1), child: const OrvaneMark(size: 88))),
                  ),
                  const SizedBox(height: OSpace.xl),
                  Opacity(
                    opacity: word,
                    child: Transform.translate(
                      offset: Offset(0, 10 * (1 - word)),
                      child: Column(
                        children: [
                          Text('Orvane', style: OType.display),
                          const SizedBox(height: 6),
                          Text('Private by design', style: OType.subhead),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
