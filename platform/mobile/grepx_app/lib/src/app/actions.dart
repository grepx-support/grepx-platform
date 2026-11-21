// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../notify/notice.dart';
import '../screens/login_screen.dart';
import '../screens/web_screen.dart';
import '../widgets/cards.dart';
import '../widgets/feedback.dart';
import '../widgets/page.dart';
import '../widgets/pressable.dart';
import '../widgets/states.dart';
import 'scope.dart';

/// The two buttons at the top right of every tab: the bell (with its badge) and you.
class AppActions extends StatelessWidget {
  const AppActions({super.key});

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.maybeOf(context);
    if (scope == null) return const SizedBox.shrink();
    return Row(mainAxisSize: MainAxisSize.min, children: [
      ListenableBuilder(
          listenable: scope.notices,
        builder: (context, _) => _Round(
          icon: Icons.notifications_none_rounded,
          badge: scope.notices.unread,
          onTap: () => showNotices(context),
        ),
      ),
      const SizedBox(width: Gap.s),
      ListenableBuilder(
        listenable: scope.session,
        builder: (context, _) => _Round(
          icon: scope.session.signedIn ? Icons.person_rounded : Icons.login_rounded,
          filled: scope.session.signedIn,
          onTap: () => scope.session.signedIn ? showAccount(context) : push(context, const LoginScreen()),
        ),
      ),
    ]);
  }
}

class _Round extends StatelessWidget {
  const _Round({required this.icon, required this.onTap, this.badge = 0, this.filled = false});
  final IconData icon;
  final VoidCallback onTap;
  final int badge;
  final bool filled;

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        child: Stack(clipBehavior: Clip.none, children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: filled ? context.brand : context.cardColor, shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: filled ? Colors.white : context.brand),
          ),
          if (badge > 0)
            Positioned(
              right: -4,
              top: -4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                constraints: const BoxConstraints(minWidth: 18),
                decoration: BoxDecoration(color: SystemColors.red, borderRadius: Corner.all(10), border: Border.all(color: SystemColors.background(Theme.of(context).brightness), width: 2)),
                child: Text(badge > 9 ? '9+' : '$badge', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ),
        ]),
      );
}

/// The notification list, newest first; opening one marks it read and goes where it points.
Future<void> showNotices(BuildContext context) {
  final scope = AppScope.of(context);
  scope.notices.refresh();
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    builder: (sheet) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      maxChildSize: 0.95,
      builder: (sheet, scroll) => ListenableBuilder(
        listenable: scope.notices,
        builder: (sheet, _) {
          final items = [...scope.notices.items]..sort((a, b) => (b.at ?? DateTime(2000)).compareTo(a.at ?? DateTime(2000)));
          return ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(Gap.l, 0, Gap.l, Gap.xl), children: [
            Row(children: [
              Expanded(child: Text('Notifications', style: sheet.text.headlineSmall)),
              if (scope.notices.unread > 0) TextButton(onPressed: () => scope.notices.markRead(), child: const Text('Mark all read')),
            ]),
            const SizedBox(height: Gap.m),
            if (items.isEmpty) const EmptyState(icon: Icons.notifications_off_outlined, title: "You're all caught up", text: 'Reminders and changes show up here.'),
            for (final n in items)
              Padding(padding: const EdgeInsets.only(bottom: Gap.s), child: _NoticeRow(n, unread: !scope.notices.isRead(n), onTap: () {
                scope.notices.markRead(n);
                Navigator.pop(sheet);
                if (n.open != null) {
                  n.open!(context);
                } else if (n.link.isNotEmpty) {
                  push(context, Scaffold(appBar: AppBar(title: Text(n.title)), body: WebScreen(path: _hashPath(n.link))));
                }
              })),
          ]);
        },
      ),
    ),
  );
}

class _NoticeRow extends StatelessWidget {
  const _NoticeRow(this.n, {required this.unread, required this.onTap});
  final Notice n;
  final bool unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => SoftCard(
        onTap: onTap,
        padding: const EdgeInsets.all(Gap.m),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          IconTile(n.icon, color: n.color ?? context.brand, size: 36),
          const SizedBox(width: Gap.m),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(n.title, style: TextStyle(fontWeight: unread ? FontWeight.w700 : FontWeight.w500, fontSize: 15)),
              if (n.body.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(n.body, style: TextStyle(color: context.secondaryText, fontSize: 13))),
            ]),
          ),
          if (unread) Container(width: 9, height: 9, margin: const EdgeInsets.only(top: 6), decoration: BoxDecoration(color: context.brand, shape: BoxShape.circle)),
        ]),
      );
}

/// 'https://site/#/jobs/42' or '#/jobs/42' or '/jobs/42' -> '#/jobs/42'.
String _hashPath(String link) {
  final i = link.indexOf('#');
  if (i >= 0) return link.substring(i);
  final path = Uri.tryParse(link)?.path ?? link;
  return '#${path.startsWith('/') ? path : '/$path'}';
}

/// You: name, role, sign out.
Future<void> showAccount(BuildContext context) {
  final scope = AppScope.of(context);
  final s = scope.session;
  return showModalBottomSheet(
    context: context,
    builder: (sheet) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.l, 0, Gap.l, Gap.l),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: sheet.brand,
            child: Text((s.name.isNotEmpty ? s.name[0] : scope.product.logo).toUpperCase(), style: const TextStyle(fontSize: 30, color: Colors.white, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: Gap.m),
          Text(s.name.isNotEmpty ? s.name : 'Signed in', style: sheet.text.titleLarge),
          Text('${scope.product.name} · ${s.role}', style: TextStyle(color: sheet.secondaryText)),
          const SizedBox(height: Gap.xl),
          GroupedList(children: [
            RowItem(title: 'Notifications', icon: Icons.notifications_rounded, iconColor: SystemColors.red, onTap: () {
              Navigator.pop(sheet);
              showNotices(context);
            }),
            RowItem(title: 'Sign out', icon: Icons.logout_rounded, iconColor: SystemColors.gray, onTap: () async {
              Navigator.pop(sheet);
              if (await confirmSheet(context, title: 'Sign out?', ok: 'Sign out', destructive: true)) await s.clear();
            }),
          ]),
        ]),
      ),
    ),
  );
}
