// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

import '../design/tokens.dart';
import 'pressable.dart';

/// A rounded card on the grouped background - the building block of every screen.
class SoftCard extends StatelessWidget {
  const SoftCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(Gap.l), this.color, this.gradient});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final Color? color;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? context.cardColor) : null,
        gradient: gradient,
        borderRadius: Corner.all(Corner.card),
        boxShadow: context.dark
            ? null
            : [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 18, offset: const Offset(0, 6))],
      ),
      child: child,
    );
    return onTap == null ? box : Pressable(onTap: onTap, child: box);
  }
}

/// "UPCOMING DRIVES   See all" above a group.
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, Gap.xl, 4, Gap.s),
        child: Row(children: [
          Expanded(child: Text(title, style: context.text.titleLarge)),
          if (action != null) Pressable(onTap: onAction, child: Text(action!, style: TextStyle(color: context.brand, fontSize: 15, fontWeight: FontWeight.w600))),
        ]),
      );
}

/// An inset grouped list, like iOS Settings: rows separated by hairlines inside one rounded card.
class GroupedList extends StatelessWidget {
  const GroupedList({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SoftCard(
        padding: EdgeInsets.zero,
        child: Column(children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i < children.length - 1) Padding(padding: const EdgeInsets.only(left: 56), child: Divider(color: context.separator)),
          ],
        ]),
      );
}

/// One row of a grouped list: coloured icon tile, title, subtitle, value and chevron.
class RowItem extends StatelessWidget {
  const RowItem({super.key, required this.title, this.subtitle, this.icon, this.iconColor, this.value, this.trailing, this.onTap});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color? iconColor;
  final String? value;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Pressable(
        onTap: onTap,
        scale: 0.99,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.l, vertical: Gap.m),
          child: Row(children: [
            if (icon != null) ...[IconTile(icon!, color: iconColor ?? context.brand), const SizedBox(width: Gap.m)],
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
                if (subtitle != null && subtitle!.isNotEmpty)
                  Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: TextStyle(fontSize: 13, color: context.secondaryText))),
              ]),
            ),
            if (value != null) Text(value!, style: TextStyle(color: context.secondaryText)),
            if (trailing != null) trailing!,
            if (onTap != null && trailing == null) Icon(Icons.chevron_right_rounded, color: context.secondaryText),
          ]),
        ),
      );
}

/// The small rounded colour square with a white symbol, as in iOS Settings.
class IconTile extends StatelessWidget {
  const IconTile(this.icon, {super.key, required this.color, this.size = 30});
  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: color, borderRadius: Corner.all(size * 0.28)),
        child: Icon(icon, color: Colors.white, size: size * 0.62),
      );
}
