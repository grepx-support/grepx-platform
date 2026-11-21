// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'tokens.dart';

/// The app's theme from one brand colour: iOS-style grouped backgrounds, large bold titles, rounded cards,
/// soft fills instead of borders, iOS page transitions (swipe back) on Android too, and a matching dark mode.
abstract final class AppTheme {
  static ThemeData build(Color brand, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(seedColor: brand, brightness: brightness).copyWith(
      primary: brand,
      surface: SystemColors.card(brightness),
    );
    final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
    final text = base.textTheme.apply(
      bodyColor: brightness == Brightness.dark ? Colors.white : Colors.black,
      displayColor: brightness == Brightness.dark ? Colors.white : Colors.black,
    );
    return base.copyWith(
      scaffoldBackgroundColor: SystemColors.background(brightness),
      splashFactory: NoSplash.splashFactory,                          // iOS: no ink ripples, a press dims instead
      highlightColor: Colors.transparent,
      textTheme: text.copyWith(
        displaySmall: text.displaySmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -1.0),
        headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.8),
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.4),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600, letterSpacing: -0.2),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: SystemColors.background(brightness),
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        centerTitle: true,
        titleTextStyle: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      cardTheme: CardThemeData(
        color: SystemColors.card(brightness),
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: Corner.all(Corner.card)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 50),
          shape: RoundedRectangleBorder(borderRadius: Corner.all(14)),
          textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 50),
          shape: RoundedRectangleBorder(borderRadius: Corner.all(14)),
          side: BorderSide(color: SystemColors.separator(brightness)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SystemColors.raised(brightness),
        border: OutlineInputBorder(borderRadius: Corner.all(12), borderSide: BorderSide.none),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: Corner.all(Corner.chip)),
        side: BorderSide.none,
        backgroundColor: SystemColors.raised(brightness),
      ),
      dividerTheme: DividerThemeData(color: SystemColors.separator(brightness), thickness: 0.5, space: 0.5),
      snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: Corner.all(14))),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: SystemColors.background(brightness),
        showDragHandle: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Corner.sheet))),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      }),
      cupertinoOverrideTheme: CupertinoThemeData(primaryColor: brand, brightness: brightness),
    );
  }
}
