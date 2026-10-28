import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../servers/application/server_providers.dart';

/// User preferences. Each one maps to real behaviour; there are no
/// decorative toggles.
@immutable
class AppSettings {
  const AppSettings({
    this.reduceMotion = false,
    this.haptics = true,
    this.connectOnLaunch = false,
    this.blockIpv6Leaks = true,
    this.excludeLan = false,
    this.onboardingDone = false,
  });

  /// Disables parallax, floating and ambient animation in addition to the
  /// system "remove animations" setting.
  final bool reduceMotion;
  final bool haptics;

  /// Starts a connection to the selected location when the app opens.
  final bool connectOnLaunch;

  /// Routes all IPv6 into the tunnel even when the server has no IPv6
  /// address, so IPv6 traffic can't bypass the VPN.
  final bool blockIpv6Leaks;

  /// Lets local-network traffic (printers, casting) bypass the tunnel.
  final bool excludeLan;
  final bool onboardingDone;

  AppSettings copyWith({
    bool? reduceMotion,
    bool? haptics,
    bool? connectOnLaunch,
    bool? blockIpv6Leaks,
    bool? excludeLan,
    bool? onboardingDone,
  }) =>
      AppSettings(
        reduceMotion: reduceMotion ?? this.reduceMotion,
        haptics: haptics ?? this.haptics,
        connectOnLaunch: connectOnLaunch ?? this.connectOnLaunch,
        blockIpv6Leaks: blockIpv6Leaks ?? this.blockIpv6Leaks,
        excludeLan: excludeLan ?? this.excludeLan,
        onboardingDone: onboardingDone ?? this.onboardingDone,
      );
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _p = 'settings.';

  @override
  AppSettings build() {
    final prefs = ref.watch(sharedPrefsProvider);
    bool b(String k, bool d) => prefs.getBool('$_p$k') ?? d;
    return AppSettings(
      reduceMotion: b('reduceMotion', false),
      haptics: b('haptics', true),
      connectOnLaunch: b('connectOnLaunch', false),
      blockIpv6Leaks: b('blockIpv6Leaks', true),
      excludeLan: b('excludeLan', false),
      onboardingDone: b('onboardingDone', false),
    );
  }

  void _set(String key, bool v, AppSettings next) {
    state = next;
    ref.read(sharedPrefsProvider).setBool('$_p$key', v);
  }

  void setReduceMotion(bool v) => _set('reduceMotion', v, state.copyWith(reduceMotion: v));
  void setHaptics(bool v) => _set('haptics', v, state.copyWith(haptics: v));
  void setConnectOnLaunch(bool v) => _set('connectOnLaunch', v, state.copyWith(connectOnLaunch: v));
  void setBlockIpv6Leaks(bool v) => _set('blockIpv6Leaks', v, state.copyWith(blockIpv6Leaks: v));
  void setExcludeLan(bool v) => _set('excludeLan', v, state.copyWith(excludeLan: v));
  void completeOnboarding() => _set('onboardingDone', true, state.copyWith(onboardingDone: true));
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);
