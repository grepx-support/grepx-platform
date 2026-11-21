// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';

/// Telling the user what happened: an iOS-style banner that drops in from the top (success, problem, a new
/// notification), and `attempt` - run an action, show the banner, keep the trace id of a failure.

enum BannerKind { success, error, info }

/// The banners need an overlay that sits above every page: GrepxApp sets this key on its navigator.
final bannerNavigator = GlobalKey<NavigatorState>();

OverlayEntry? _current;
Timer? _timer;

void showBanner(String title, {String? text, BannerKind kind = BannerKind.info, IconData? icon, VoidCallback? onTap, Duration hold = const Duration(seconds: 3)}) {
  final overlay = bannerNavigator.currentState?.overlay;
  if (overlay == null) return;
  _timer?.cancel();
  _current?.remove();
  switch (kind) {
    case BannerKind.success:
      HapticFeedback.mediumImpact();
    case BannerKind.error:
      HapticFeedback.heavyImpact();
    case BannerKind.info:
      HapticFeedback.lightImpact();
  }
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (context) => _Banner(
      title: title,
      text: text,
      kind: kind,
      icon: icon,
      onTap: () {
        entry.remove();
        if (identical(_current, entry)) _current = null;
        onTap?.call();
      },
    ),
  );
  _current = entry;
  overlay.insert(entry);
  _timer = Timer(hold, () {
    if (identical(_current, entry)) {
      entry.remove();
      _current = null;
    }
  });
}

class _Banner extends StatelessWidget {
  const _Banner({required this.title, required this.kind, required this.onTap, this.text, this.icon});
  final String title;
  final String? text;
  final BannerKind kind;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = switch (kind) { BannerKind.success => SystemColors.green, BannerKind.error => SystemColors.red, BannerKind.info => context.brand };
    final symbol = icon ?? switch (kind) { BannerKind.success => Icons.check_circle_rounded, BannerKind.error => Icons.error_rounded, BannerKind.info => Icons.notifications_rounded };
    return Positioned(
      left: 10,
      right: 10,
      top: MediaQuery.of(context).padding.top + 6,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: -1, end: 0),
        duration: Motion.normal,
        curve: Motion.spring,
        builder: (context, y, child) => FractionalTranslation(translation: Offset(0, y), child: child),
        child: Material(
          color: Colors.transparent,
          child: GestureDetector(
            onTap: onTap,
            onVerticalDragEnd: (_) => onTap(),
            child: ClipRRect(
              borderRadius: Corner.all(Corner.card),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: Gap.l, vertical: Gap.m),
                  decoration: BoxDecoration(
                    color: (context.dark ? const Color(0xFF2C2C2E) : Colors.white).withValues(alpha: 0.82),
                    borderRadius: Corner.all(Corner.card),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.15), blurRadius: 24, offset: const Offset(0, 8))],
                  ),
                  child: Row(children: [
                    Icon(symbol, color: color, size: 28),
                    const SizedBox(width: Gap.m),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                        if (text != null) Text(text!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: context.secondaryText, fontSize: 13)),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Run an action; on success optionally say so, on failure show why (with the trace id). Returns null on failure.
Future<T?> attempt<T>(BuildContext context, Future<T> Function() action, {String? done}) async {
  try {
    final result = await action();
    if (done != null) showBanner(done, kind: BannerKind.success);
    return result;
  } catch (e) {
    showBanner('That did not work', text: '$e', kind: BannerKind.error, hold: const Duration(seconds: 5));
    return null;
  }
}

/// An action sheet asking to confirm something - "Cancel my booking?" - returns true when confirmed.
Future<bool> confirmSheet(BuildContext context, {required String title, String? text, required String ok, bool destructive = false}) async {
  final answer = await showModalBottomSheet<bool>(
    context: context,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.l, 0, Gap.l, Gap.l),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title, textAlign: TextAlign.center, style: context.text.titleLarge),
          if (text != null) Padding(padding: const EdgeInsets.only(top: Gap.s), child: Text(text, textAlign: TextAlign.center, style: TextStyle(color: context.secondaryText))),
          const SizedBox(height: Gap.xl),
          FilledButton(
            style: destructive ? FilledButton.styleFrom(backgroundColor: SystemColors.red) : null,
            onPressed: () => Navigator.pop(context, true),
            child: Text(ok),
          ),
          const SizedBox(height: Gap.s),
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Not now')),
        ]),
      ),
    ),
  );
  return answer ?? false;
}
