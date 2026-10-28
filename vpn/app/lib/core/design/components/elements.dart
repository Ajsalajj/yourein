import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'glass.dart';
import 'pressable.dart';

/// Coloured dot + label. The dot pulses softly when [live] is set.
class StatusPill extends StatefulWidget {
  const StatusPill({super.key, required this.label, required this.color, this.live = false});

  final String label;
  final Color color;
  final bool live;

  @override
  State<StatusPill> createState() => _StatusPillState();
}

class _StatusPillState extends State<StatusPill> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void initState() {
    super.initState();
    _syncPulse();
  }

  @override
  void didUpdateWidget(StatusPill oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulse();
  }

  void _syncPulse() {
    if (widget.live && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.live) {
      _c.stop();
      _c.value = 0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return AnimatedContainer(
      duration: OMotion.standard,
      curve: OMotion.inOut,
      padding: const EdgeInsets.fromLTRB(10, 6, 12, 6),
      decoration: BoxDecoration(
        borderRadius: ORadius.chip,
        color: widget.color.withValues(alpha: 0.10),
        border: Border.all(color: widget.color.withValues(alpha: 0.26)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 14,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final t = reduce ? 0.0 : _c.value;
                return CustomPaint(
                  painter: _DotPainter(widget.color, t),
                );
              },
            ),
          ),
          const SizedBox(width: 6),
          AnimatedSwitcher(
            duration: OMotion.standard,
            child: Text(
              widget.label,
              key: ValueKey(widget.label),
              style: OType.caption.copyWith(color: widget.color, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }
}

class _DotPainter extends CustomPainter {
  _DotPainter(this.color, this.t);

  final Color color;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    if (t > 0) {
      canvas.drawCircle(c, 3 + 4 * t, Paint()..color = color.withValues(alpha: 0.35 * (1 - t)));
    }
    canvas.drawCircle(c, 3, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_DotPainter old) => old.t != t || old.color != color;
}

/// Small uppercase heading above a group of content.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: OSpace.sm, top: OSpace.xl),
      child: Row(
        children: [
          Expanded(child: Semantics(header: true, child: Text(text.toUpperCase(), style: OType.eyebrow))),
          ?trailing,
        ],
      ),
    );
  }
}

/// A row inside a grouped glass list (settings, profile, help).
class OListRow extends StatelessWidget {
  const OListRow({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.iconColor = OColors.ice,
    this.trailing,
    this.onTap,
    this.destructive = false,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color iconColor;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? OColors.error : OColors.text;
    final row = Padding(
      padding: const EdgeInsets.symmetric(horizontal: OSpace.md, vertical: 14),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                color: (destructive ? OColors.error : iconColor).withValues(alpha: 0.12),
              ),
              child: Icon(icon, size: 18, color: destructive ? OColors.error : iconColor),
            ),
            const SizedBox(width: OSpace.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: OType.callout.copyWith(color: color)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: OType.footnote),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing! else if (onTap != null) const Icon(Icons.chevron_right_rounded, color: OColors.textFaint, size: 22),
        ],
      ),
    );
    if (onTap == null) return MergeSemantics(child: row);
    return Pressable(onTap: onTap, pressedScale: 0.985, semanticLabel: title, semanticHint: subtitle, child: row);
  }
}

/// Glass group with hairline dividers between rows.
class OListGroup extends StatelessWidget {
  const OListGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) items.add(const Divider(indent: OSpace.md + 34 + OSpace.sm, height: 1));
      items.add(children[i]);
    }
    return GlassSurface(padding: EdgeInsets.zero, elevation: OElevation.low, child: Column(children: items));
  }
}

/// Inline notice used for errors, warnings and setup requirements.
class ONotice extends StatelessWidget {
  const ONotice({
    super.key,
    this.title,
    required this.message,
    this.color = OColors.error,
    this.icon = Icons.error_outline_rounded,
    this.actionLabel,
    this.onAction,
    this.onDismiss,
  });

  final String? title;
  final String message;
  final Color color;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      container: true,
      child: GlassSurface(
        tint: color,
        padding: const EdgeInsets.fromLTRB(OSpace.md, OSpace.md, OSpace.xs, OSpace.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, color: color, size: 20)),
            const SizedBox(width: OSpace.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (title != null) ...[
                    Text(title!, style: OType.callout.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                  ],
                  Text(message, style: title == null ? OType.callout.copyWith(color: OColors.textMuted) : OType.footnote),
                  if (actionLabel != null && onAction != null) ...[
                    const SizedBox(height: OSpace.sm),
                    OButton(
                      label: actionLabel!,
                      onPressed: onAction,
                      variant: OButtonVariant.secondary,
                      compact: true,
                      expand: false,
                    ),
                  ],
                ],
              ),
            ),
            if (onDismiss != null)
              OIconButton(
                icon: Icons.close_rounded,
                semanticLabel: 'Dismiss',
                onPressed: onDismiss,
                size: 32,
                color: OColors.textMuted,
              )
            else
              const SizedBox(width: OSpace.xs),
          ],
        ),
      ),
    );
  }
}

/// Centered illustration-free empty / unavailable state.
class OEmptyState extends StatelessWidget {
  const OEmptyState({super.key, required this.icon, required this.title, required this.message, this.action});

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: OSpace.xxl, vertical: OSpace.xxxl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: OColors.glassFill,
              border: Border.all(color: OColors.glassStroke),
            ),
            child: Icon(icon, color: OColors.ice, size: 28),
          ),
          const SizedBox(height: OSpace.lg),
          Text(title, style: OType.title3, textAlign: TextAlign.center),
          const SizedBox(height: OSpace.xs),
          Text(message, style: OType.subhead, textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: OSpace.xl), action!],
        ],
      ),
    );
  }
}
