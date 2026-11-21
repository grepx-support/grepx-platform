// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// Charts drawn by hand (no chart package): an activity ring, a sparkline and a bar chart. Each animates in.

/// An Apple-Watch-style ring: progress 0..1 around a track, rounded ends, a centre label.
class Ring extends StatelessWidget {
  const Ring({super.key, required this.progress, required this.color, this.size = 120, this.stroke = 14, this.center});
  final double progress;
  final Color color;
  final double size;
  final double stroke;
  final Widget? center;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: progress.clamp(0, 1).toDouble()),
        duration: Motion.slow,
        curve: Motion.ease,
        builder: (context, value, child) => SizedBox(
          width: size,
          height: size,
          child: CustomPaint(painter: _RingPainter(value, color, stroke), child: Center(child: child)),
        ),
        child: center,
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.value, this.color, this.stroke);
  final double value;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    final track = Paint()
      ..color = color.withValues(alpha: 0.18)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(arc, 0, math.pi * 2, false, track);
    if (value <= 0) return;
    final sweep = math.pi * 2 * value;
    final paint = Paint()
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        colors: [color.withValues(alpha: 0.75), color],
        transform: const GradientRotation(-math.pi / 2),
      ).createShader(arc)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = stroke;
    canvas.drawArc(arc, -math.pi / 2, sweep, false, paint);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.value != value || old.color != color;
}

/// A small line chart with a soft fill, for a trend inside a card.
class Sparkline extends StatelessWidget {
  const Sparkline({super.key, required this.values, this.color, this.height = 48});
  final List<num> values;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Motion.slow,
        curve: Motion.ease,
        builder: (context, t, _) => SizedBox(
          height: height,
          width: double.infinity,
          child: CustomPaint(painter: _SparkPainter(values.map((v) => v.toDouble()).toList(), color ?? context.brand, t)),
        ),
      );
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color, this.t);
  final List<double> values;
  final Color color;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final lo = values.reduce(math.min), hi = values.reduce(math.max);
    final span = (hi - lo).abs() < 1e-9 ? 1.0 : hi - lo;
    final points = [
      for (var i = 0; i < values.length; i++)
        Offset(size.width * i / (values.length - 1), size.height - (values[i] - lo) / span * size.height * 0.9 * t - size.height * 0.05),
    ];
    final line = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final a = points[i - 1], b = points[i];
      final mid = (a.dx + b.dx) / 2;
      line.cubicTo(mid, a.dy, mid, b.dy, b.dx, b.dy);
    }
    final fill = Path.from(line)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(
      fill,
      Paint()..shader = LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)]).createShader(Offset.zero & size),
    );
    canvas.drawPath(line, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round);
    canvas.drawCircle(points.last, 3.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_SparkPainter old) => old.t != t || old.values != values || old.color != color;
}

/// Bars with labels underneath and the value on top; the highlighted one in full colour.
class BarChart extends StatelessWidget {
  const BarChart({super.key, required this.values, required this.labels, this.color, this.height = 160, this.highlight, this.format});
  final List<num> values;
  final List<String> labels;
  final Color? color;
  final double height;
  final int? highlight;
  final String Function(num)? format;

  @override
  Widget build(BuildContext context) {
    final top = values.isEmpty ? 1.0 : values.map((v) => v.toDouble()).reduce(math.max);
    final c = color ?? context.brand;
    return SizedBox(
      height: height,
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (var i = 0; i < values.length; i++)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text(format?.call(values[i]) ?? '${values[i]}', style: TextStyle(fontSize: 11, color: context.secondaryText)),
                const SizedBox(height: 4),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: top <= 0 ? 0 : values[i] / top),
                  duration: Motion.slow,
                  curve: Motion.ease,
                  builder: (context, f, _) => Container(
                    height: math.max(4, (height - 44) * f),
                    decoration: BoxDecoration(
                      color: (highlight == null || highlight == i) ? c : c.withValues(alpha: 0.35),
                      borderRadius: Corner.all(6),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(labels.length > i ? labels[i] : '', maxLines: 1, overflow: TextOverflow.clip, style: TextStyle(fontSize: 11, color: context.secondaryText)),
              ]),
            ),
          ),
      ]),
    );
  }
}
