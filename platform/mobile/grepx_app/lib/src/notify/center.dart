// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../net/api.dart';
import '../net/session.dart';
import '../widgets/feedback.dart';
import 'notice.dart';
import 'phone.dart';

/// The notification centre: the server's messages to this person (the platform's inbox, /me/inbox - the same bell
/// as the web) and what the product finds worth telling, read every few minutes while the app is open and whenever
/// it comes back to the front. It remembers what was already announced and read, and announces each new one - a
/// banner when the app is in front, a phone notification when it is not. The bell's badge = unread.
class NoticeCenter extends ChangeNotifier with WidgetsBindingObserver {
  NoticeCenter({required this.source, required this.api, required this.session, required this.prefs, this.every = const Duration(minutes: 3)});
  final Future<List<Notice>> Function(Api, Session)? source;
  final Api api;
  final Session session;
  final SharedPreferences prefs;
  final Duration every;

  List<Notice> items = const [];
  Timer? _timer;
  bool _inFront = true;

  Set<String> get _seen => (prefs.getStringList('notice.seen') ?? const []).toSet();
  Set<String> get _read => (prefs.getStringList('notice.read') ?? const []).toSet();
  int get unread => items.where((n) => !_read.contains(n.id)).length;
  bool isRead(Notice n) => _read.contains(n.id);

  void start() {
    WidgetsBinding.instance.addObserver(this);
    session.addListener(refresh);
    PhoneNotifications.init();
    refresh();
    _timer = Timer.periodic(every, (_) => refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _inFront = state == AppLifecycleState.resumed;
    if (_inFront) refresh();
  }

  Future<void> refresh() async {
    final found = <Notice>[];
    var reached = false;
    if (source != null) {
      try {
        found.addAll(await source!(api, session));
        reached = true;
      } catch (_) {}
    }
    if (session.signedIn) {
      try {
        found.addAll(_inbox(await api.get('/me/inbox?limit=30')));
        reached = true;
      } catch (_) {}
    }
    if (!reached) return;                                // offline: keep what we have
    final seen = _seen;
    final fresh = found.where((n) => !seen.contains(n.id)).toList();
    items = found;
    notifyListeners();
    if (fresh.isEmpty) return;
    await prefs.setStringList('notice.seen', [...seen, ...fresh.map((n) => n.id)].take(500).toList());
    if (seen.isEmpty && fresh.length > 3) return;        // first launch: no flood of old news
    for (final n in fresh.take(3)) {
      if (_inFront) {
        showBanner(n.title, text: n.body, icon: n.icon);
      } else {
        await PhoneNotifications.show(n.id.hashCode & 0x7fffffff, n.title, n.body);
      }
    }
  }

  Future<void> markRead([Notice? one]) async {
    final ids = one == null ? items.map((n) => n.id) : [one.id];
    await prefs.setStringList('notice.read', {..._read, ...ids}.take(500).toList());
    notifyListeners();
    if (one == null && session.signedIn) api.post('/me/inbox/seen').catchError((_) => null);   // the web's bell too
  }

  /// The server's messages as notices; a link inside the site opens that page, signed in.
  static List<Notice> _inbox(dynamic body) => [
        for (final n in ((body is Map ? body['items'] : null) ?? const []) as List)
          Notice(
            id: 'inbox:${n['key']}',
            title: '${n['subject'] ?? ''}',
            body: '${n['body'] ?? ''}'.replaceAll(RegExp(r'<[^>]*>'), '').trim(),
            at: DateTime.tryParse('${n['at'] ?? ''}'),
            link: '${n['link'] ?? ''}',
          ),
      ];

  @override
  void dispose() {
    _timer?.cancel();
    session.removeListener(refresh);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
