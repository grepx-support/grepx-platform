// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';

/// A line chart you can touch (fl_chart, MIT): drag a finger along it to read each point, with a haptic tick.
class TrendChart extends StatelessWidget {
  const TrendChart({super.key, required this.values, required this.labels, this.color, this.height = 180, this.format});
  final List<num> values;
  final List<String> labels;
  final Color? color;
  final double height;
  final String Function(num)? format;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.brand;
    if (values.length < 2) return SizedBox(height: height);
    final spots = [for (var i = 0; i < values.length; i++) FlSpot(i.toDouble(), values[i].toDouble())];
    return SizedBox(
      height: height,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (_) => FlLine(color: context.separator, strokeWidth: 0.5),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 24,
                interval: (values.length / 4).ceilToDouble().clamp(1, double.infinity).toDouble(),
                getTitlesWidget: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= labels.length) return const SizedBox.shrink();
                  return Padding(padding: const EdgeInsets.only(top: 6), child: Text(labels[i], style: TextStyle(fontSize: 11, color: context.secondaryText)));
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchCallback: (event, response) {
              if (event is FlPanUpdateEvent || event is FlTapDownEvent) HapticFeedback.selectionClick();
            },
            touchTooltipData: LineTouchTooltipData(
              getTooltipColor: (_) => context.dark ? const Color(0xFF2C2C2E) : Colors.white,
              getTooltipItems: (touched) => [
                for (final t in touched)
                  LineTooltipItem(
                    '${format?.call(t.y) ?? t.y.toStringAsFixed(0)}\n',
                    TextStyle(color: c, fontWeight: FontWeight.w700),
                    children: [TextSpan(text: labels.length > t.x.toInt() ? labels[t.x.toInt()] : '', style: TextStyle(color: context.secondaryText, fontSize: 11, fontWeight: FontWeight.w400))],
                  ),
              ],
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              preventCurveOverShooting: true,
              color: c,
              barWidth: 3,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [c.withValues(alpha: 0.3), c.withValues(alpha: 0)]),
              ),
            ),
          ],
        ),
        duration: Motion.slow,
      ),
    );
  }
}
