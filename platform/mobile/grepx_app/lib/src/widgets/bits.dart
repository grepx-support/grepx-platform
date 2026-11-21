// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import 'cards.dart';

/// Small pieces: a status pill, a number that counts up, a stat tile, the iOS segmented control.

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key, this.color});
  final String label;
  final Color? color;

  /// A sensible colour for common states (booked, done, late, cancelled...).
  static Color colorFor(String state) {
    final s = state.toLowerCase();
    if (['done', 'completed', 'delivered', 'donated', 'checked_in', 'confirmed', 'booked', 'ok', 'ready', 'approved', 'paid'].contains(s)) return SystemColors.green;
    if (['cancelled', 'failed', 'rejected', 'late', 'overdue', 'deferred', 'low', 'out'].contains(s)) return SystemColors.red;
    if (['pending', 'waiting', 'open', 'new', 'todo', 'assigned', 'scheduled'].contains(s)) return SystemColors.orange;
    return SystemColors.blue;
  }

  @override
  Widget build(BuildContext context) {
    final c = color ?? colorFor(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.14), borderRadius: Corner.all(20)),
      child: Text(label.replaceAll('_', ' '), style: TextStyle(color: c, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}

/// A number that rolls up to its value when it appears.
class CountUp extends StatelessWidget {
  const CountUp(this.value, {super.key, this.style, this.suffix = '', this.decimals = 0});
  final num value;
  final TextStyle? style;
  final String suffix;
  final int decimals;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: Motion.slow,
        curve: Motion.ease,
        builder: (context, v, _) => Text('${v.toStringAsFixed(decimals)}$suffix', style: style),
      );
}

/// A tile with a symbol, a big number and what it means.
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, required this.icon, this.color, this.suffix = '', this.onTap});
  final String label;
  final num value;
  final IconData icon;
  final Color? color;
  final String suffix;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.brand;
    return SoftCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, color: c, size: 20),
          const Spacer(),
          if (onTap != null) Icon(Icons.chevron_right_rounded, size: 18, color: context.secondaryText),
        ]),
        const SizedBox(height: Gap.m),
        CountUp(value, suffix: suffix, style: context.text.headlineMedium),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: context.secondaryText, fontSize: 13, fontWeight: FontWeight.w500)),
      ]),
    );
  }
}

/// Two stat tiles side by side, as many rows as needed.
class StatGrid extends StatelessWidget {
  const StatGrid({super.key, required this.tiles});
  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => Column(children: [
        for (var i = 0; i < tiles.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.m),
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: Gap.m),
                Expanded(child: i + 1 < tiles.length ? tiles[i + 1] : const SizedBox()),
              ]),
            ),
          ),
      ]);
}

/// The iOS sliding segmented control, with a haptic tick.
class Segments<T extends Object> extends StatelessWidget {
  const Segments({super.key, required this.value, required this.options, required this.onChanged});
  final T value;
  final Map<T, String> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        child: CupertinoSlidingSegmentedControl<T>(
          groupValue: value,
          thumbColor: context.dark ? const Color(0xFF636366) : Colors.white,
          backgroundColor: SystemColors.raised(Theme.of(context).brightness),
          children: {for (final e in options.entries) e.key: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(e.value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)))},
          onValueChanged: (v) {
            if (v == null) return;
            HapticFeedback.selectionClick();
            onChanged(v);
          },
        ),
      );
}
