// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

import '../net/api.dart';
import '../net/session.dart';
import '../notify/center.dart';
import 'product.dart';

/// The app's shared things, reachable from any screen: AppScope.of(context).api, .session, .notices, .product.
class AppScope extends InheritedWidget {
  const AppScope({super.key, required this.product, required this.api, required this.session, required this.notices, required super.child});
  final Product product;
  final Api api;
  final Session session;
  final NoticeCenter notices;

  static AppScope of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>()!;
  static AppScope? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<AppScope>();

  @override
  bool updateShouldNotify(AppScope old) => false;          // the things inside notify their own listeners
}
