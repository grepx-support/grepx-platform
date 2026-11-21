// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

import '../net/api.dart';
import '../net/session.dart';
import '../notify/notice.dart';

/// What a product gives the shared app: its brand, its tabs, and (optionally) what is worth a notification.
/// Everything else - look, shell, sign-in, notifications, charts - comes from this package.
class Product {
  const Product({
    required this.key,
    required this.name,
    required this.logo,
    required this.color,
    required this.tabs,
    this.notices,
    this.staffRoles,
    this.tagline = '',
    this.afterSignIn,
  });
  final String key;
  final String name;
  final String logo;
  final Color color;
  final String tagline;
  final List<AppTab> Function(Api api, Session session) tabs;

  /// What the user should hear about now (a booking tomorrow, an order out of stock, a new job) - read from the
  /// product's own API; the app shows a badge, a banner and a phone notification for each new one.
  final Future<List<Notice>> Function(Api api, Session session)? notices;

  /// Runs right after a sign-in, before the tabs appear - to load the user's profile, permissions or business into
  /// the session (session.save / setJson). If it fails, the sign-in is undone and the reason shown.
  final Future<void> Function(Api api, Session session)? afterSignIn;

  /// Roles that see the staff tabs (default: volunteer, staff, admin, manager, owner, dispatcher, driver).
  final Set<String>? staffRoles;
}

class AppTab {
  const AppTab({required this.label, required this.icon, required this.build, this.activeIcon, this.audience = Audience.everyone});
  final String label;
  final IconData icon;
  final IconData? activeIcon;
  final WidgetBuilder build;
  final Audience audience;

  bool visible(Session s) => switch (audience) {
        Audience.everyone => true,
        Audience.signedIn => s.signedIn,
        Audience.staff => s.isStaff,
      };
}

enum Audience { everyone, signedIn, staff }
