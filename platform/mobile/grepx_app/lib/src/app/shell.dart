// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';
import '../screens/login_screen.dart';
import 'scope.dart';

/// The shell: the product's tabs behind a floating frosted-glass tab bar. Tabs keep their place when you switch
/// (each stays alive), the icon springs when picked, and a staff-only product starts at sign-in.
class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    return ListenableBuilder(
      listenable: scope.session,
      builder: (context, _) {
        final tabs = scope.product.tabs(scope.api, scope.session).where((t) => t.visible(scope.session)).toList();
        if (tabs.isEmpty) return const LoginScreen(standalone: true);           // staff-only product: sign in first
        if (index >= tabs.length) index = 0;
        return Scaffold(
          extendBody: true,
          body: IndexedStack(index: index, children: [for (final t in tabs) KeyedSubtree(key: ValueKey(t.label), child: Builder(builder: t.build))]),
          bottomNavigationBar: tabs.length < 2
              ? null
              : GlassTabBar(
                  index: index,
                  items: [for (final t in tabs) (t.icon, t.activeIcon ?? t.icon, t.label)],
                  onTap: (i) => setState(() => index = i),
                ),
        );
      },
    );
  }
}

/// A floating, rounded tab bar of frosted glass; the picked tab gets a soft pill and a little spring.
class GlassTabBar extends StatelessWidget {
  const GlassTabBar({super.key, required this.index, required this.items, required this.onTap});
  final int index;
  final List<(IconData, IconData, String)> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final brand = context.brand;
    return SafeArea(
      minimum: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: ClipRRect(
          borderRadius: Corner.all(30),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
            child: Container(
              height: 66,
              decoration: BoxDecoration(
                color: (context.dark ? const Color(0xFF1C1C1E) : Colors.white).withValues(alpha: 0.78),
                borderRadius: Corner.all(30),
                border: Border.all(color: context.separator, width: 0.5),
              ),
              child: Row(children: [
                for (var i = 0; i < items.length; i++)
                  Expanded(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () {
                        if (i != index) HapticFeedback.selectionClick();
                        onTap(i);
                      },
                      child: _TabItem(icon: i == index ? items[i].$2 : items[i].$1, label: items[i].$3, selected: i == index, color: brand),
                    ),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({required this.icon, required this.label, required this.selected, required this.color});
  final IconData icon;
  final String label;
  final bool selected;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = selected ? color : context.secondaryText;
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      AnimatedContainer(
        duration: Motion.normal,
        curve: Motion.ease,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        decoration: BoxDecoration(color: selected ? color.withValues(alpha: 0.14) : Colors.transparent, borderRadius: Corner.all(16)),
        child: AnimatedScale(scale: selected ? 1.12 : 1, duration: Motion.normal, curve: Motion.spring, child: Icon(icon, color: c, size: 24)),
      ),
      const SizedBox(height: 3),
      Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: c, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
    ]);
  }
}
