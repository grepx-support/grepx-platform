// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../app/actions.dart';
import '../design/tokens.dart';

/// A page the iOS way: a large bold title that shrinks into the bar as you scroll, pull down to refresh with the
/// iOS spinner, content that fades and rises in one item after another, and room at the bottom for the tab bar.
class LargeTitlePage extends StatelessWidget {
  const LargeTitlePage({super.key, required this.title, required this.children, this.onRefresh, this.actions = const [], this.subtitle, this.leading});
  final String title;
  final String? subtitle;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final List<Widget> actions;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    final top = !Navigator.of(context).canPop();                  // a tab, not a pushed page: bell + account
    return CustomScrollView(
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      slivers: [
        SliverAppBar.large(
          title: Text(title),
          leading: leading,
          automaticallyImplyLeading: leading == null && !top,
          actions: [...actions, if (top) const AppActions(), const SizedBox(width: Gap.m)],
          backgroundColor: SystemColors.background(Theme.of(context).brightness),
        ),
        if (onRefresh != null) CupertinoSliverRefreshControl(onRefresh: onRefresh),
        if (subtitle != null)
          SliverToBoxAdapter(
            child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, Gap.s), child: Text(subtitle!, style: TextStyle(color: context.secondaryText, fontSize: 15))),
          ),
        SliverPadding(
          padding: Gap.page,
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              for (var i = 0; i < children.length; i++)
                children[i].animate(delay: (40 * (i < 8 ? i : 8)).ms).fadeIn(duration: 320.ms).slideY(begin: 0.06, end: 0, curve: Curves.easeOutCubic),
            ]),
          ),
        ),
      ],
    );
  }
}

/// A pushed page (details): the same look, with the back chevron.
class DetailPage extends StatelessWidget {
  const DetailPage({super.key, required this.title, required this.children, this.onRefresh, this.actions = const [], this.bottom});
  final String title;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final List<Widget> actions;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: LargeTitlePage(title: title, onRefresh: onRefresh, actions: actions, children: children),
        bottomNavigationBar: bottom == null ? null : SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(Gap.l, Gap.s, Gap.l, Gap.s), child: bottom)),
      );
}

/// Push a page with the iOS slide (and swipe-back) on both platforms.
Future<T?> push<T>(BuildContext context, Widget page) => Navigator.of(context).push<T>(CupertinoPageRoute(builder: (_) => page));
