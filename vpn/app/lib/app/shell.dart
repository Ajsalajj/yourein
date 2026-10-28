import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/design/components/ambient_background.dart';
import '../core/design/components/glass.dart';
import '../core/design/components/pressable.dart';
import '../core/design/tokens.dart';
import '../core/design/typography.dart';
import '../features/vpn/application/vpn_controller.dart';
import '../features/vpn/domain/vpn_models.dart';

/// Root of the four main tabs: one shared ambient backdrop (warming to
/// green when protected) and the floating navigation bar.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  static const tabs = [
    (Icons.power_settings_new_rounded, 'Connect'),
    (Icons.public_rounded, 'Locations'),
    (Icons.insights_rounded, 'Insights'),
    (Icons.person_rounded, 'Account'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final phase = ref.watch(vpnControllerProvider.select((s) => s.phase));
    final accent = switch (phase) {
      VpnPhase.connected => Color.lerp(OColors.blue, OColors.success, 0.35)!,
      VpnPhase.error => Color.lerp(OColors.blue, OColors.error, 0.4)!,
      _ => OColors.blue,
    };
    return Scaffold(
      extendBody: true,
      backgroundColor: OColors.bg,
      body: AmbientBackground(
        accent: accent,
        intensity: phase == VpnPhase.connected ? 1.25 : 1,
        child: shell,
      ),
      bottomNavigationBar: _FloatingNavBar(
        index: shell.currentIndex,
        onSelect: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
      ),
    );
  }
}

class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({required this.index, required this.onSelect});

  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(OSpace.gutter, 0, OSpace.gutter, bottom + OSpace.sm),
      child: Semantics(
        container: true,
        label: 'Main navigation',
        child: GlassSurface(
          blur: true,
          radius: ORadius.xl,
          padding: const EdgeInsets.all(6),
          elevation: OElevation.high,
          child: SizedBox(
            height: 60,
            child: LayoutBuilder(
              builder: (context, c) {
                final w = c.maxWidth / AppShell.tabs.length;
                return Stack(
                  children: [
                    // Sliding selection lozenge.
                    AnimatedPositioned(
                      duration: OMotion.emphasized,
                      curve: OMotion.settle,
                      left: w * index,
                      top: 0,
                      bottom: 0,
                      width: w,
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(ORadius.lg),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [OColors.blue.withValues(alpha: 0.26), OColors.blue.withValues(alpha: 0.12)],
                          ),
                          border: Border.all(color: OColors.blue.withValues(alpha: 0.32)),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        for (var i = 0; i < AppShell.tabs.length; i++)
                          Expanded(
                            child: Pressable(
                              onTap: () => onSelect(i),
                              pressedScale: 0.9,
                              semanticLabel: AppShell.tabs[i].$2,
                              selected: i == index,
                              child: _NavItem(icon: AppShell.tabs[i].$1, label: AppShell.tabs[i].$2, selected: i == index),
                            ),
                          ),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.label, required this.selected});

  final IconData icon;
  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final color = selected ? OColors.text : OColors.textMuted;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        AnimatedScale(
          scale: selected ? 1.08 : 1,
          duration: OMotion.standard,
          curve: OMotion.settle,
          child: Icon(icon, size: 22, color: selected ? OColors.ice : color),
        ),
        const SizedBox(height: 3),
        AnimatedDefaultTextStyle(
          duration: OMotion.quick,
          style: OType.caption.copyWith(color: color, fontSize: 11),
          child: Text(label, maxLines: 1),
        ),
      ],
    );
  }
}
