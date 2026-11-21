// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The signed-in user (token, role, name), kept on the device. Products decide who counts as staff.
class Session extends ChangeNotifier {
  Session(this.prefs, {this.staffRoles = const {'volunteer', 'staff', 'admin', 'manager', 'owner', 'dispatcher', 'driver'}});
  final SharedPreferences prefs;
  final Set<String> staffRoles;

  static Future<Session> load({Set<String>? staffRoles}) async {
    final prefs = await SharedPreferences.getInstance();
    return staffRoles == null ? Session(prefs) : Session(prefs, staffRoles: staffRoles);
  }

  String? get token => prefs.getString('token');
  String get role => prefs.getString('role') ?? 'guest';
  String? get userId => prefs.getString('user_id');
  String get name => prefs.getString('name') ?? '';
  bool get signedIn => token != null;
  bool get isStaff => staffRoles.contains(role);

  /// Permissions, for products that hand out pages by permission (kitchen: 'closing', 'orders'... or '*').
  List<String> get perms => prefs.getStringList('perms') ?? const [];
  bool can(String perm) => perms.contains(perm) || perms.contains('*');

  /// Anything else a product keeps about the user (its business, locations...), as JSON.
  dynamic json(String key) {
    final s = prefs.getString('json.$key');
    return s == null ? null : jsonDecode(s);
  }

  Future<void> setJson(String key, Object? value) => prefs.setString('json.$key', jsonEncode(value));

  Future<void> save(Map<String, dynamic> s, {bool notify = true}) async {
    await prefs.setString('token', '${s['token']}');
    await prefs.setString('role', '${s['role'] ?? 'member'}');
    await prefs.setString('user_id', '${s['user_id'] ?? ''}');
    if (s['name'] != null) await prefs.setString('name', '${s['name']}');
    if (s['perms'] is List) await prefs.setStringList('perms', [for (final p in s['perms'] as List) '$p']);
    if (notify) notifyListeners();
  }

  /// After a product changed what it keeps (perms, its JSON): tell the screens.
  void changed() => notifyListeners();

  Future<void> clear() async {
    for (final k in prefs.getKeys().where((k) => k.startsWith('json.')).toList()) {
      await prefs.remove(k);
    }
    for (final k in ['token', 'role', 'user_id', 'name', 'perms']) {
      await prefs.remove(k);
    }
    notifyListeners();
  }
}
