import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../tokens.dart';
import '../typography.dart';
import 'ambient_background.dart';
import 'buttons.dart';

/// Standard scrolling page: large title that collapses into a compact,
/// blurred bar as content scrolls under it.
///
/// [standalone] pages (pushed over the shell) bring their own backdrop and
/// back button; tab pages sit on the shell's backdrop.
class OPage extends StatelessWidget {
  const OPage({
    super.key,
    required this.title,
    required this.slivers,
    this.subtitle,
    this.standalone = true,
    this.actions = const [],
    this.bottomInset = true,
  });

  final String title;
  final String? subtitle;
  final List<Widget> slivers;
  final bool standalone;
  final List<Widget> actions;

  /// Reserve space for the floating nav bar on tab pages.
  final bool bottomInset;

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    final scroll = CustomScrollView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        SliverPersistentHeader(
          pinned: true,
          delegate: _LargeTitleHeader(
            title: title,
            subtitle: subtitle,
            topPadding: padding.top,
            canPop: standalone && (GoRouter.maybeOf(context)?.canPop() ?? Navigator.of(context).canPop()),
            actions: actions,
          ),
        ),
        ...slivers.map((s) => SliverPadding(padding: const EdgeInsets.symmetric(horizontal: OSpace.gutter), sliver: s)),
        SliverToBoxAdapter(child: SizedBox(height: (bottomInset && !standalone ? 110 : OSpace.xxl) + padding.bottom)),
      ],
    );
    if (!standalone) return scroll;
    return Scaffold(backgroundColor: OColors.bg, body: AmbientBackground(child: scroll));
  }
}

class _LargeTitleHeader extends SliverPersistentHeaderDelegate {
  _LargeTitleHeader({
    required this.title,
    required this.subtitle,
    required this.topPadding,
    required this.canPop,
    required this.actions,
  });

  final String title;
  final String? subtitle;
  final double topPadding;
  final bool canPop;
  final List<Widget> actions;

  static const _bar = 56.0;
  double get _large => subtitle == null ? 64 : 88;

  @override
  double get minExtent => topPadding + _bar;

  @override
  double get maxExtent => topPadding + _bar + _large;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final t = (shrinkOffset / _large).clamp(0.0, 1.0);
    final compact = Curves.easeIn.transform(((t - 0.6) / 0.4).clamp(0.0, 1.0));
    return Stack(
      fit: StackFit.expand,
      children: [
        if (compact > 0)
          Opacity(
            opacity: compact,
            child: ClipRect(
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: OColors.bg.withValues(alpha: 0.6),
                    border: const Border(bottom: BorderSide(color: OColors.hairline)),
                  ),
                ),
              ),
            ),
          ),
        Positioned(
          top: topPadding,
          left: 0,
          right: 0,
          height: _bar,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: OSpace.md - 4),
            child: Row(
              children: [
                if (canPop)
                  OIconButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    semanticLabel: 'Back',
                    size: 40,
                    onPressed: () => Navigator.of(context).maybePop(),
                  )
                else
                  const SizedBox(width: 40),
                Expanded(
                  child: Opacity(
                    opacity: compact,
                    child: Text(title, style: OType.bodyStrong, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ),
                if (actions.isEmpty) const SizedBox(width: 40) else ...actions,
              ],
            ),
          ),
        ),
        Positioned(
          left: OSpace.gutter,
          right: OSpace.gutter,
          top: topPadding + _bar - shrinkOffset * 0.6,
          child: IgnorePointer(
            child: Opacity(
              opacity: 1 - t,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(header: true, child: Text(title, style: OType.title1)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(subtitle!, style: OType.subhead, maxLines: 2),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  bool shouldRebuild(_LargeTitleHeader old) =>
      old.title != title || old.subtitle != subtitle || old.topPadding != topPadding || old.canPop != canPop;
}

/// Toggle row used in settings screens: label, explanation, switch.
class OSwitchRow extends StatelessWidget {
  const OSwitchRow({
    super.key,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.icon,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: OSpace.md, vertical: 12),
        child: Row(
          children: [
            if (icon != null) ...[
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), color: OColors.ice.withValues(alpha: 0.12)),
                child: Icon(icon, size: 18, color: OColors.ice),
              ),
              const SizedBox(width: OSpace.sm),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: OType.callout),
                  const SizedBox(height: 2),
                  Text(subtitle, style: OType.footnote),
                ],
              ),
            ),
            const SizedBox(width: OSpace.xs),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      ),
    );
  }
}
