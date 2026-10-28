import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'tokens.dart';
import 'typography.dart';

/// The single app theme. Material is used only as plumbing (text fields,
/// scroll physics, routing); every visible component is Orvane's own, so
/// splash ripples and Material elevation tints are switched off.
ThemeData buildOrvaneTheme() {
  const scheme = ColorScheme.dark(
    primary: OColors.blue,
    onPrimary: OColors.text,
    secondary: OColors.ice,
    onSecondary: OColors.bg,
    surface: OColors.bgRaised,
    onSurface: OColors.text,
    error: OColors.error,
    onError: OColors.bg,
  );

  final textTheme = TextTheme(
    displayLarge: OType.display,
    headlineLarge: OType.title1,
    headlineMedium: OType.title2,
    titleLarge: OType.title3,
    titleMedium: OType.bodyStrong,
    bodyLarge: OType.body,
    bodyMedium: OType.callout,
    bodySmall: OType.footnote,
    labelLarge: OType.callout,
    labelMedium: OType.caption,
    labelSmall: OType.eyebrow,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: OColors.bg,
    canvasColor: OColors.bg,
    fontFamily: OType.family,
    textTheme: textTheme,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    splashColor: Colors.transparent,
    hoverColor: OColors.glassFill,
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: OColors.blue,
      selectionColor: Color(0x554F8CFF),
      selectionHandleColor: OColors.blue,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: OColors.glassFill,
      hintStyle: OType.body.copyWith(color: OColors.textFaint),
      labelStyle: OType.subhead,
      floatingLabelStyle: OType.caption.copyWith(color: OColors.ice),
      contentPadding: const EdgeInsets.symmetric(horizontal: OSpace.md, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ORadius.md),
        borderSide: const BorderSide(color: OColors.glassStroke),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ORadius.md),
        borderSide: const BorderSide(color: OColors.glassStroke),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ORadius.md),
        borderSide: const BorderSide(color: OColors.blue, width: 1.2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ORadius.md),
        borderSide: const BorderSide(color: OColors.error),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ORadius.md),
        borderSide: const BorderSide(color: OColors.error, width: 1.2),
      ),
      errorStyle: OType.caption.copyWith(color: OColors.error),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(OColors.text),
      trackColor: WidgetStateProperty.resolveWith(
        (s) => s.contains(WidgetState.selected) ? OColors.blue : const Color(0x33FFFFFF),
      ),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    dividerTheme: const DividerThemeData(color: OColors.hairline, thickness: 1, space: 1),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      systemOverlayStyle: SystemUiOverlayStyle.light,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(backgroundColor: OColors.bg),
      },
    ),
  );
}

/// Edge-to-edge, transparent system bars with light icons.
const SystemUiOverlayStyle orvaneSystemUi = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemNavigationBarColor: Colors.transparent,
  systemNavigationBarDividerColor: Colors.transparent,
  systemNavigationBarIconBrightness: Brightness.light,
  systemNavigationBarContrastEnforced: false,
);
