// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

/// The design tokens every screen uses - one place for spacing, corners, motion and the system colours,
/// so the whole app moves and reads like one product (the iOS feel on both iOS and Android).
abstract final class Gap {
  static const xs = 4.0, s = 8.0, m = 12.0, l = 16.0, xl = 24.0, xxl = 32.0;
  static const page = EdgeInsets.fromLTRB(16, 8, 16, 120);       // room for the floating tab bar
}

abstract final class Corner {
  static const card = 22.0, tile = 16.0, chip = 12.0, sheet = 28.0;
  static BorderRadius all(double r) => BorderRadius.circular(r);
}

abstract final class Motion {
  static const fast = Duration(milliseconds: 180), normal = Duration(milliseconds: 320), slow = Duration(milliseconds: 600);
  static const spring = Curves.easeOutBack, ease = Curves.easeOutCubic;
}

/// iOS system colours (light / dark), used for status and charts.
abstract final class SystemColors {
  static const green = Color(0xFF34C759), red = Color(0xFFFF3B30), orange = Color(0xFFFF9500), yellow = Color(0xFFFFCC00);
  static const blue = Color(0xFF0A84FF), indigo = Color(0xFF5E5CE6), purple = Color(0xFFBF5AF2), teal = Color(0xFF30B0C7);
  static const pink = Color(0xFFFF2D55), gray = Color(0xFF8E8E93);
  static const chart = [blue, green, orange, purple, teal, pink, indigo, yellow];

  static Color background(Brightness b) => b == Brightness.dark ? const Color(0xFF000000) : const Color(0xFFF2F2F7);
  static Color card(Brightness b) => b == Brightness.dark ? const Color(0xFF1C1C1E) : Colors.white;
  static Color raised(Brightness b) => b == Brightness.dark ? const Color(0xFF2C2C2E) : const Color(0xFFF2F2F7);
  static Color separator(Brightness b) => b == Brightness.dark ? const Color(0x33FFFFFF) : const Color(0x1F000000);
  static Color secondaryText(Brightness b) => b == Brightness.dark ? const Color(0x99EBEBF5) : const Color(0x993C3C43);
}

/// Shortcuts from any widget: context.brand, context.dark, context.secondaryText...
extension Look on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get text => Theme.of(this).textTheme;
  Color get brand => Theme.of(this).colorScheme.primary;
  bool get dark => Theme.of(this).brightness == Brightness.dark;
  Color get cardColor => SystemColors.card(Theme.of(this).brightness);
  Color get secondaryText => SystemColors.secondaryText(Theme.of(this).brightness);
  Color get separator => SystemColors.separator(Theme.of(this).brightness);
}
