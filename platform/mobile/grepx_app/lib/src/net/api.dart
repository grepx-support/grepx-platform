// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import 'session.dart';

/// The same /api/v1 the web uses. Every call carries an X-Trace-Id and errors keep it, so a problem seen on a
/// phone can be followed on the server (System > trace, Grafana, ./run.sh trace).
class Api {
  Api(this.base, this.session, {http.Client? client}) : _client = client ?? http.Client();
  final String base;
  final Session session;
  final http.Client _client;

  static String newTraceId() => List.generate(16, (_) => Random.secure().nextInt(16).toRadixString(16)).join();

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => _send('POST', path, body ?? const {});
  Future<dynamic> patch(String path, Map<String, dynamic> body) => _send('PATCH', path, body);
  Future<dynamic> put(String path, Map<String, dynamic> body) => _send('PUT', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Map<String, dynamic>? body]) async {
    final trace = newTraceId();
    final request = http.Request(method, Uri.parse('$base/api/v1$path'))
      ..headers.addAll({
        'X-Trace-Id': trace,
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        if (session.token != null) 'Authorization': 'Bearer ${session.token}',
      });
    if (body != null) request.body = jsonEncode(body);
    final http.Response response;
    try {
      response = await http.Response.fromStream(await _client.send(request).timeout(const Duration(seconds: 30)));
    } catch (_) {
      throw ApiError('No connection - check the internet and try again', 'OFFLINE', trace);
    }
    final data = response.body.isEmpty ? null : _decode(response);
    if (response.statusCode == 401 && session.signedIn) await session.clear();
    if (response.statusCode >= 400) {
      final detail = (data is Map && data['detail'] is Map) ? data['detail'] as Map : const {};
      throw ApiError(detail['message']?.toString() ?? 'Something went wrong', detail['reason']?.toString() ?? '', trace);
    }
    return data;
  }

  static dynamic _decode(http.Response r) {
    try {
      return jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      return null;
    }
  }
}

class ApiError implements Exception {
  ApiError(this.message, this.reason, this.trace);
  final String message;
  final String reason;
  final String trace;

  bool get offline => reason == 'OFFLINE';

  @override
  String toString() => '$message (trace ${trace.substring(0, 8)})';
}
