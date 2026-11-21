// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';

/// "Slide to confirm" - for a step that must not happen by a stray tap (a driver's "Passenger on board"): drag the
/// knob to the end; it clicks at the end, then shows a spinner until the action finishes, and springs back if let go.
class SlideToConfirm extends StatefulWidget {
  const SlideToConfirm({super.key, required this.label, required this.onConfirm, this.color, this.icon = Icons.arrow_forward_rounded});
  final String label;
  final Future<void> Function() onConfirm;
  final Color? color;
  final IconData icon;

  @override
  State<SlideToConfirm> createState() => _SlideToConfirmState();
}

class _SlideToConfirmState extends State<SlideToConfirm> {
  double x = 0;
  bool busy = false;
  static const knob = 56.0, height = 64.0;

  @override
  Widget build(BuildContext context) {
    final c = widget.color ?? context.brand;
    return LayoutBuilder(builder: (context, box) {
      final end = box.maxWidth - knob - 8;
      final share = end <= 0 ? 0.0 : (x / end).clamp(0, 1).toDouble();
      return Container(
        height: height,
        decoration: BoxDecoration(color: c.withValues(alpha: 0.14), borderRadius: Corner.all(height / 2)),
        child: Stack(alignment: Alignment.centerLeft, children: [
          Positioned.fill(
            child: Center(
              child: Opacity(
                opacity: 1 - share,
                child: Text(widget.label, style: TextStyle(color: c, fontSize: 17, fontWeight: FontWeight.w700)),
              ),
            ),
          ),
          AnimatedPositioned(
            duration: x == 0 ? Motion.normal : Duration.zero,
            curve: Motion.spring,
            left: 4 + x,
            child: GestureDetector(
              onHorizontalDragUpdate: busy ? null : (d) => setState(() => x = (x + d.delta.dx).clamp(0, end).toDouble()),
              onHorizontalDragEnd: busy
                  ? null
                  : (_) async {
                      if (x < end * 0.9) {
                        setState(() => x = 0);
                        return;
                      }
                      HapticFeedback.heavyImpact();
                      setState(() {
                        x = end;
                        busy = true;
                      });
                      try {
                        await widget.onConfirm();
                      } finally {
                        if (mounted) {
                          setState(() {
                            busy = false;
                            x = 0;
                          });
                        }
                      }
                    },
              child: Container(
                width: knob,
                height: knob,
                decoration: BoxDecoration(color: c, shape: BoxShape.circle, boxShadow: [BoxShadow(color: c.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4))]),
                child: busy
                    ? const Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : Icon(widget.icon, color: Colors.white),
              ),
            ),
          ),
        ]),
      );
    });
  }
}
