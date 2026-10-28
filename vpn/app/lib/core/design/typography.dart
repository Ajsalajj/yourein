import 'package:flutter/painting.dart';

import 'tokens.dart';

/// Type scale built on the bundled Inter variable font.
///
/// Inter ships as one variable file, so weight and optical size are set
/// through font variations as well as [FontWeight]; that keeps rendering
/// identical across Skia and Impeller. Large sizes use the display optical
/// size and tighter tracking, the way system UI fonts do.
abstract final class OType {
  static const String family = 'Inter';

  static TextStyle _style(
    double size,
    double weight, {
    double height = 1.3,
    double tracking = 0,
    Color color = OColors.text,
    bool tabular = false,
  }) {
    final opsz = size.clamp(14, 32).toDouble();
    return TextStyle(
      fontFamily: family,
      fontSize: size,
      fontWeight: FontWeight.values[((weight / 100).round() - 1).clamp(0, 8)],
      fontVariations: [FontVariation('wght', weight), FontVariation('opsz', opsz)],
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null,
      height: height,
      letterSpacing: tracking,
      color: color,
      leadingDistribution: TextLeadingDistribution.even,
    );
  }

  static final TextStyle display = _style(40, 640, height: 1.08, tracking: -1.2);
  static final TextStyle title1 = _style(28, 640, height: 1.15, tracking: -0.7);
  static final TextStyle title2 = _style(22, 620, height: 1.2, tracking: -0.45);
  static final TextStyle title3 = _style(18, 600, height: 1.25, tracking: -0.25);
  static final TextStyle body = _style(16, 430, height: 1.45, tracking: -0.1);
  static final TextStyle bodyStrong = _style(16, 560, height: 1.45, tracking: -0.15);
  static final TextStyle callout = _style(15, 500, height: 1.4, tracking: -0.1);
  static final TextStyle subhead = _style(14, 450, height: 1.4, color: OColors.textMuted);
  static final TextStyle footnote = _style(13, 450, height: 1.35, color: OColors.textMuted);
  static final TextStyle caption = _style(12, 520, height: 1.3, tracking: 0.1, color: OColors.textMuted);

  /// Small all-caps label used for section eyebrows.
  static final TextStyle eyebrow = _style(11, 620, height: 1.2, tracking: 1.4, color: OColors.textFaint);

  /// Monospaced-width digits for timers and counters so they don't jitter.
  static final TextStyle timer = _style(34, 560, height: 1.0, tracking: -0.8, tabular: true);
  static final TextStyle metric = _style(20, 600, height: 1.1, tracking: -0.4, tabular: true);
  static final TextStyle metricSmall = _style(15, 560, height: 1.1, tracking: -0.2, tabular: true);
}
