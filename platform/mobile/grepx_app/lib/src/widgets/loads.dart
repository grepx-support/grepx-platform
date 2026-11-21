// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/widgets.dart';

import '../app/scope.dart';
import '../net/api.dart';

/// A screen that loads its data from the API once (not again when the keyboard opens or the phone turns), and
/// again on pull-to-refresh or after a change:  `Future load(Api api) => api.get('/drives');` then `data`, `reload()`.
mixin LoadsData<W extends StatefulWidget> on State<W> {
  late Future<dynamic> data;
  bool _started = false;

  Future<dynamic> load(Api api);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    data = load(AppScope.of(context).api);
  }

  Future<void> reload() async {
    if (!mounted) return;
    final next = load(AppScope.of(context).api);
    setState(() => data = next);
    try {
      await next;
    } catch (_) {}
  }
}
