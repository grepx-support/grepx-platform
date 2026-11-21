// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../net/api.dart';

/// Loading, empty and failed - the three states every screen has, done once.

/// A shimmering grey block, laid out like the content that is coming (no spinners).
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = 10});
  final double height;
  final double? width;
  final double radius;

  /// A card-shaped placeholder list, for a screen that is loading.
  static Widget list({int count = 4}) => Padding(
        padding: Gap.page,
        child: Column(children: [
          for (var i = 0; i < count; i++)
            const Padding(padding: EdgeInsets.only(bottom: Gap.m), child: Skeleton(height: 96, radius: Corner.card)),
        ]),
      );

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController shimmer = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();

  @override
  void dispose() {
    shimmer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.dark ? const Color(0xFF2C2C2E) : const Color(0xFFE5E5EA);
    final light = context.dark ? const Color(0xFF3A3A3C) : const Color(0xFFF2F2F7);
    return AnimatedBuilder(
      animation: shimmer,
      builder: (context, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: Corner.all(widget.radius),
          gradient: LinearGradient(
            begin: Alignment(-1 + 3 * shimmer.value - 1, 0),
            end: Alignment(1 + 3 * shimmer.value - 1, 0),
            colors: [base, light, base],
          ),
        ),
      ),
    );
  }
}

/// A big friendly symbol, a line of text and maybe one button.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.text, this.action, this.onAction});
  final IconData icon;
  final String title;
  final String? text;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.xxl, vertical: 56),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(color: context.brand.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(icon, size: 40, color: context.brand),
          ),
          const SizedBox(height: Gap.l),
          Text(title, textAlign: TextAlign.center, style: context.text.titleLarge),
          if (text != null) ...[
            const SizedBox(height: Gap.s),
            Text(text!, textAlign: TextAlign.center, style: TextStyle(color: context.secondaryText, fontSize: 15)),
          ],
          if (action != null) ...[const SizedBox(height: Gap.l), FilledButton(onPressed: onAction, child: Text(action!))],
        ]),
      );
}

/// Loads a future: a skeleton while waiting, a calm message with "Try again" when it fails, then the content.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.future, required this.builder, this.onRetry, this.loading});
  final Future<T> future;
  final Widget Function(BuildContext, T) builder;
  final VoidCallback? onRetry;
  final Widget? loading;

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) {
            final e = snap.error;
            final offline = e is ApiError && e.offline;
            return EmptyState(
              icon: offline ? Icons.wifi_off_rounded : Icons.cloud_off_rounded,
              title: offline ? "You're offline" : 'Could not load this',
              text: '$e',
              action: onRetry == null ? null : 'Try again',
              onAction: onRetry,
            );
          }
          if (snap.connectionState != ConnectionState.done) return loading ?? Skeleton.list();
          return AnimatedSwitcher(duration: Motion.normal, child: KeyedSubtree(key: const ValueKey('data'), child: builder(context, snap.data as T)));
        },
      );
}
