// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

/// Dates and numbers as people say them - "Today", "Tomorrow", "Sat 23 Nov", "1.2K" - without a locale package.
abstract final class Fmt {
  static const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  static const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  /// '2026-11-23' or '2026-11-23T09:30' -> DateTime (local), or null.
  static DateTime? date(Object? text) => text == null ? null : DateTime.tryParse('$text');

  static DateTime today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  /// Whole days from today (0 today, 1 tomorrow, -1 yesterday).
  static int daysFromToday(Object? text) {
    final d = date(text);
    if (d == null) return 0;
    return DateTime(d.year, d.month, d.day).difference(today()).inDays;
  }

  /// "Today", "Tomorrow", "Sat 23 Nov" (with the year when it is not this year).
  static String day(Object? text) {
    final d = date(text);
    if (d == null) return '${text ?? ''}';
    final n = daysFromToday(text);
    if (n == 0) return 'Today';
    if (n == 1) return 'Tomorrow';
    if (n == -1) return 'Yesterday';
    return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}${d.year == DateTime.now().year ? '' : ' ${d.year}'}';
  }

  static String monthShort(Object? text) {
    final d = date(text);
    return d == null ? '' : months[d.month - 1].toUpperCase();
  }

  static String dayNumber(Object? text) => '${date(text)?.day ?? ''}';

  /// "09:30" from a time or a timestamp.
  static String time(Object? text) {
    final s = '${text ?? ''}';
    final m = RegExp(r'(\d{1,2}):(\d{2})').firstMatch(s);
    return m == null ? s : '${m.group(1)!.padLeft(2, '0')}:${m.group(2)}';
  }

  /// 1234 -> "1.2K", 2500000 -> "2.5M".
  static String compact(num? v) {
    if (v == null) return '–';
    final a = v.abs();
    if (a >= 1e9) return '${(v / 1e9).toStringAsFixed(1)}B';
    if (a >= 1e6) return '${(v / 1e6).toStringAsFixed(1)}M';
    if (a >= 1e4) return '${(v / 1e3).toStringAsFixed(0)}K';
    if (a >= 1e3) return '${(v / 1e3).toStringAsFixed(1)}K';
    return v % 1 == 0 ? '${v.toInt()}' : v.toStringAsFixed(1);
  }

  /// 12.5 -> "$12.50" (currency symbol given by the product).
  static String money(num? v, {String symbol = '\$'}) => v == null ? '–' : '$symbol${v.toStringAsFixed(2)}';

  static num number(Object? v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
}
