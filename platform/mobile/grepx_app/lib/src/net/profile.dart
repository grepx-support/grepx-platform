// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'api.dart';
import 'session.dart';

/// Who is signed in, from the platform's /me (every product has it): name, role, permissions, business - kept in the
/// session. A product's afterSignIn can be just this; returns the whole /me for a product that needs more.
Future<Map<String, dynamic>> loadProfile(Api api, Session s) async {
  final me = Map<String, dynamic>.from(await api.get('/me') as Map);
  await s.save({
    'token': s.token,
    'role': me['role'] ?? s.role,
    'user_id': me['id'] ?? s.userId,
    'name': me['name'] ?? me['full_name'] ?? s.name,
    'perms': me['perms'] ?? const [],
  }, notify: false);
  await s.setJson('me', me);
  return me;
}
