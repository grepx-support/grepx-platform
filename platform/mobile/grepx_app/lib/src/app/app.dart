// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/theme.dart';
import '../net/api.dart';
import '../net/session.dart';
import '../notify/center.dart';
import '../widgets/feedback.dart';
import 'product.dart';
import 'scope.dart';
import 'shell.dart';

/// The site the app talks to, given at build time: --dart-define=API_BASE=https://your.domain.com
/// (an Android emulator against a local server: http://10.0.2.2:8851).
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'http://10.0.2.2:8851');

/// A product's whole main(): `void main() => runGrepx(bloodProduct);`
Future<void> runGrepx(Product product) async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, systemNavigationBarColor: Colors.transparent));
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  final session = await Session.load(staffRoles: product.staffRoles);
  final api = Api(apiBase, session);
  final notices = NoticeCenter(source: product.notices, api: api, session: session, prefs: session.prefs)..start();
  runApp(GrepxApp(product: product, api: api, session: session, notices: notices));
}

class GrepxApp extends StatelessWidget {
  const GrepxApp({super.key, required this.product, required this.api, required this.session, required this.notices});
  final Product product;
  final Api api;
  final Session session;
  final NoticeCenter notices;

  @override
  Widget build(BuildContext context) => AppScope(
        product: product,
        api: api,
        session: session,
        notices: notices,
        child: MaterialApp(
          title: product.name,
          debugShowCheckedModeBanner: false,
          navigatorKey: bannerNavigator,
          theme: AppTheme.build(product.color, Brightness.light),
          darkTheme: AppTheme.build(product.color, Brightness.dark),
          home: const Shell(),
        ),
      );
}
