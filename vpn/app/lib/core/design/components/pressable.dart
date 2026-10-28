import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

enum PressHaptic { none, selection, light, medium }

/// Makes anything tappable with a physical press: it compresses while held
/// and springs back with a small overshoot on release. Semantics, focus and
/// keyboard activation are handled so custom controls stay accessible.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    required this.onTap,
    this.onLongPress,
    this.pressedScale = 0.965,
    this.haptic = PressHaptic.selection,
    this.semanticLabel,
    this.semanticHint,
    this.isButton = true,
    this.selected,
    this.onPressedChanged,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double pressedScale;
  final PressHaptic haptic;
  final String? semanticLabel;
  final String? semanticHint;
  final bool isButton;
  final bool? selected;
  final ValueChanged<bool>? onPressedChanged;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 1);
  static const _spring = SpringDescription(mass: 1, stiffness: 520, damping: 22);

  bool get _enabled => widget.onTap != null || widget.onLongPress != null;

  void _down() {
    if (!_enabled) return;
    widget.onPressedChanged?.call(true);
    _c.animateWith(SpringSimulation(_spring, _c.value, widget.pressedScale, _c.velocity));
  }

  void _up() {
    widget.onPressedChanged?.call(false);
    _c.animateWith(SpringSimulation(_spring, _c.value, 1, _c.velocity));
  }

  void _tap() {
    switch (widget.haptic) {
      case PressHaptic.none:
        break;
      case PressHaptic.selection:
        HapticFeedback.selectionClick();
      case PressHaptic.light:
        HapticFeedback.lightImpact();
      case PressHaptic.medium:
        HapticFeedback.mediumImpact();
    }
    widget.onTap?.call();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: widget.isButton,
      enabled: _enabled,
      selected: widget.selected,
      label: widget.semanticLabel,
      hint: widget.semanticHint,
      child: FocusableActionDetector(
        enabled: _enabled,
        actions: {
          ActivateIntent: CallbackAction<ActivateIntent>(onInvoke: (_) {
            _tap();
            return null;
          }),
        },
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _down(),
          onTapUp: (_) => _up(),
          onTapCancel: _up,
          onTap: widget.onTap == null ? null : _tap,
          onLongPress: widget.onLongPress,
          excludeFromSemantics: true,
          child: AnimatedBuilder(
            animation: _c,
            child: widget.child,
            builder: (context, child) => Transform.scale(scale: _c.value, child: child),
          ),
        ),
      ),
    );
  }
}
