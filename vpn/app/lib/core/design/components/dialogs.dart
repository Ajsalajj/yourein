import 'package:flutter/material.dart';

import '../tokens.dart';
import '../typography.dart';
import 'buttons.dart';
import 'glass.dart';

/// Glass confirmation dialog. Returns true when confirmed.
Future<bool> showOConfirm(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = false,
  String cancelLabel = 'Cancel',
}) async {
  final result = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: cancelLabel,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    transitionDuration: OMotion.standard,
    pageBuilder: (context, _, _) => SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(OSpace.xl),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Material(
              type: MaterialType.transparency,
              child: GlassSurface(
                blur: true,
                strong: true,
                radius: ORadius.xl,
                elevation: OElevation.high,
                padding: const EdgeInsets.all(OSpace.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(header: true, child: Text(title, style: OType.title3, textAlign: TextAlign.center)),
                    const SizedBox(height: OSpace.xs),
                    Text(message, style: OType.subhead, textAlign: TextAlign.center),
                    const SizedBox(height: OSpace.xl),
                    OButton(
                      label: confirmLabel,
                      variant: destructive ? OButtonVariant.destructive : OButtonVariant.primary,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                    const SizedBox(height: OSpace.xs),
                    OButton(label: cancelLabel, variant: OButtonVariant.ghost, onPressed: () => Navigator.of(context).pop(false)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    transitionBuilder: (context, a, _, child) {
      final t = OMotion.enter.transform(a.value);
      return Opacity(opacity: a.value, child: Transform.scale(scale: 0.94 + 0.06 * t, child: child));
    },
  );
  return result ?? false;
}

void showOToast(BuildContext context, String message, {Color color = OColors.ice}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  messenger?.hideCurrentSnackBar();
  messenger?.showSnackBar(
    SnackBar(
      behavior: SnackBarBehavior.floating,
      backgroundColor: OColors.bgRaised,
      elevation: 0,
      margin: const EdgeInsets.fromLTRB(OSpace.gutter, 0, OSpace.gutter, 100),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(ORadius.md), side: BorderSide(color: color.withValues(alpha: 0.35))),
      content: Text(message, style: OType.callout),
    ),
  );
}
