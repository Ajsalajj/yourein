import 'package:flutter/animation.dart';
import 'package:flutter/painting.dart';

/// Orvane design tokens.
///
/// Every colour, distance, radius, duration and curve used by the UI comes
/// from here. Screens never hard-code visual values; if a value is missing,
/// add a token rather than a literal.
abstract final class OColors {
  // Surfaces
  static const Color bg = Color(0xFF070B13);
  static const Color bgRaised = Color(0xFF111827);
  static const Color bgDeep = Color(0xFF04070D);

  // Brand
  static const Color blue = Color(0xFF4F8CFF);
  static const Color ice = Color(0xFF93C5FD);
  static const Color blueDeep = Color(0xFF1E3A8A);

  // Text
  static const Color text = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textFaint = Color(0xFF5B6B82);

  // Semantic
  static const Color success = Color(0xFF34D399);
  static const Color error = Color(0xFFFB7185);
  static const Color warning = Color(0xFFFBBF24);

  // Glass
  static const Color glassFill = Color(0x14FFFFFF); // 8%
  static const Color glassFillStrong = Color(0x1FFFFFFF); // 12%
  static const Color glassStroke = Color(0x1AFFFFFF); // 10%
  static const Color glassHighlight = Color(0x33FFFFFF); // 20%
  static const Color hairline = Color(0x14FFFFFF);
}

/// 4-point spacing scale.
abstract final class OSpace {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;

  /// Horizontal page gutter.
  static const double gutter = 20;
}

abstract final class ORadius {
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 22;
  static const double xl = 28;
  static const double pill = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius tile = BorderRadius.all(Radius.circular(md));
  static const BorderRadius chip = BorderRadius.all(Radius.circular(pill));
}

/// Motion timing. Durations are deliberately few so the app has one rhythm.
abstract final class OMotion {
  static const Duration instant = Duration(milliseconds: 90);
  static const Duration quick = Duration(milliseconds: 180);
  static const Duration standard = Duration(milliseconds: 320);
  static const Duration emphasized = Duration(milliseconds: 520);
  static const Duration cinematic = Duration(milliseconds: 900);

  /// Decelerating ease used for most entrances.
  static const Curve enter = Cubic(0.16, 1, 0.3, 1);

  /// Gentle ease for exits.
  static const Curve exit = Cubic(0.7, 0, 0.84, 0);

  /// Symmetric ease for state cross-fades.
  static const Curve inOut = Cubic(0.65, 0, 0.35, 1);

  /// Slight overshoot for "magnetic" settles.
  static const Curve settle = Cubic(0.34, 1.36, 0.64, 1);
}

/// Elevation is expressed as layered, low-opacity shadows tinted towards the
/// background rather than black, which keeps dark UI from looking muddy.
abstract final class OElevation {
  static const List<BoxShadow> low = [
    BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 4)),
  ];

  static const List<BoxShadow> mid = [
    BoxShadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x59020617), blurRadius: 28, offset: Offset(0, 14)),
  ];

  static const List<BoxShadow> high = [
    BoxShadow(color: Color(0x4D000000), blurRadius: 10, offset: Offset(0, 4)),
    BoxShadow(color: Color(0x73020617), blurRadius: 48, offset: Offset(0, 24)),
  ];

  static List<BoxShadow> glow(Color color, {double strength = 1}) => [
        BoxShadow(
          color: color.withValues(alpha: 0.35 * strength),
          blurRadius: 24,
          spreadRadius: -4,
        ),
        BoxShadow(
          color: color.withValues(alpha: 0.18 * strength),
          blurRadius: 60,
          spreadRadius: -8,
        ),
      ];
}
