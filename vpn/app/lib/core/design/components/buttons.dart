import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'pressable.dart';

enum OButtonVariant { primary, secondary, ghost, destructive }

/// The app's button. Labels are always explicit text; icon-only actions use
/// [OIconButton], which requires a semantic label.
class OButton extends StatelessWidget {
  const OButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = OButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = true,
    this.compact = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final OButtonVariant variant;
  final IconData? icon;
  final bool loading;
  final bool expand;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final height = compact ? 44.0 : 56.0;
    final (fg, decoration) = switch (variant) {
      OButtonVariant.primary => (
          OColors.text,
          BoxDecoration(
            borderRadius: BorderRadius.circular(ORadius.md),
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF5E97FF), Color(0xFF3B74F0)],
            ),
            border: Border.all(color: Colors.white.withValues(alpha: 0.16), width: 1),
            boxShadow: enabled ? OElevation.glow(OColors.blue, strength: 0.8) : null,
          ),
        ),
      OButtonVariant.secondary => (
          OColors.text,
          BoxDecoration(
            borderRadius: BorderRadius.circular(ORadius.md),
            color: OColors.glassFillStrong,
            border: Border.all(color: OColors.glassStroke),
          ),
        ),
      OButtonVariant.ghost => (OColors.ice, const BoxDecoration()),
      OButtonVariant.destructive => (
          OColors.error,
          BoxDecoration(
            borderRadius: BorderRadius.circular(ORadius.md),
            color: OColors.error.withValues(alpha: 0.10),
            border: Border.all(color: OColors.error.withValues(alpha: 0.28)),
          ),
        ),
    };

    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          OSpinner(size: 18, color: fg)
        else if (icon != null) ...[
          Icon(icon, size: 19, color: fg),
          const SizedBox(width: OSpace.xs),
        ],
        if (!loading) Flexible(child: Text(label, style: OType.bodyStrong.copyWith(color: fg), overflow: TextOverflow.ellipsis)),
      ],
    );

    return Pressable(
      onTap: enabled ? onPressed : null,
      semanticLabel: loading ? '$label, in progress' : label,
      haptic: variant == OButtonVariant.primary ? PressHaptic.light : PressHaptic.selection,
      child: AnimatedOpacity(
        duration: OMotion.quick,
        opacity: enabled || loading ? 1 : 0.42,
        child: Container(
          height: height,
          padding: const EdgeInsets.symmetric(horizontal: OSpace.lg),
          decoration: decoration,
          child: ExcludeSemantics(child: content),
        ),
      ),
    );
  }
}

/// Circular glass icon button. [semanticLabel] is mandatory so screen
/// readers never announce an unlabeled control.
class OIconButton extends StatelessWidget {
  const OIconButton({
    super.key,
    required this.icon,
    required this.semanticLabel,
    required this.onPressed,
    this.size = 44,
    this.color = OColors.text,
    this.active = false,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback? onPressed;
  final double size;
  final Color color;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onPressed,
      semanticLabel: semanticLabel,
      pressedScale: 0.92,
      child: AnimatedContainer(
        duration: OMotion.quick,
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? OColors.blue.withValues(alpha: 0.18) : OColors.glassFill,
          border: Border.all(color: active ? OColors.blue.withValues(alpha: 0.5) : OColors.glassStroke),
        ),
        child: Icon(icon, size: size * 0.45, color: active ? OColors.ice : color),
      ),
    );
  }
}

/// Sweep-gradient arc spinner, lighter and calmer than the Material one.
class OSpinner extends StatefulWidget {
  const OSpinner({super.key, this.size = 22, this.color = OColors.ice, this.strokeWidth = 2});

  final double size;
  final Color color;
  final double strokeWidth;

  @override
  State<OSpinner> createState() => _OSpinnerState();
}

class _OSpinnerState extends State<OSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading',
      child: SizedBox.square(
        dimension: widget.size,
        child: RepaintBoundary(
          child: CustomPaint(painter: _SpinnerPainter(_c, widget.color, widget.strokeWidth)),
        ),
      ),
    );
  }
}

class _SpinnerPainter extends CustomPainter {
  _SpinnerPainter(this.anim, this.color, this.stroke) : super(repaint: anim);

  final Animation<double> anim;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(stroke);
    final angle = anim.value * 2 * math.pi;
    canvas.save();
    canvas.translate(size.width / 2, size.height / 2);
    canvas.rotate(angle);
    canvas.translate(-size.width / 2, -size.height / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        colors: [color.withValues(alpha: 0), color],
        stops: const [0.15, 1],
      ).createShader(rect);
    canvas.drawArc(rect, 0.35, 2 * math.pi - 0.7, false, paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) => old.color != color;
}
