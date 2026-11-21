// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../app/scope.dart';

/// Every feature of the product inside the app: the same pages as the web, already signed in with the app's session.
/// Native tabs stay for the quick daily jobs; this covers everything else (AI chat, reports, setup...). Links that
/// leave the site (WhatsApp, phone calls, maps) open in their own apps; the camera works for scanning.
/// `WebScreen(path: '#/chat')` - the site and the sign-in come from the app.
class WebScreen extends StatefulWidget {
  const WebScreen({super.key, required this.path});


  /// The page, e.g. '#/repairs' or '#/chat'.
  final String path;

  @override
  State<WebScreen> createState() => _WebScreenState();
}

class _WebScreenState extends State<WebScreen> {
  WebViewController? _controller;
  int progress = 0;
  bool signedInPage = false;
  late String base;
  String? token, userId, role;

  WebViewController get controller => _controller!;
  Uri get home => Uri.parse('$base/${widget.path}');

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_controller != null) return;
    final scope = AppScope.of(context);
    base = scope.api.base;
    token = scope.session.token;
    userId = scope.session.userId;
    role = scope.session.role;
    _controller = WebViewController(onPermissionRequest: (request) => request.grant())      // camera for barcode / IMEI scanning
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onProgress: (p) => setState(() => progress = p),
        onPageFinished: (_) => _signIn(),
        onNavigationRequest: (request) {
          final uri = Uri.parse(request.url);
          final site = Uri.parse(base);
          if ((uri.scheme == 'http' || uri.scheme == 'https') && uri.host == site.host) return NavigationDecision.navigate;
          launchUrl(uri, mode: LaunchMode.externalApplication);           // wa.me, tel:, mailto:, maps...
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(home);
  }

  /// The web app keeps its login in localStorage 'session': put the app's token there once, then reload signed in.
  Future<void> _signIn() async {
    if (signedInPage || token == null) return;
    signedInPage = true;
    await controller.runJavaScript("localStorage.setItem('grepx.install.dismissed', '1')");        // already the app: no "install" offer
    final session = jsonEncode({'token': token, 'user_id': userId ?? '', 'role': role ?? 'staff'});
    final current = await controller.runJavaScriptReturningResult("localStorage.getItem('session') || ''");
    if (!current.toString().contains(token!)) {
      await controller.runJavaScript("localStorage.setItem('session', ${jsonEncode(session)}); location.reload();");
    }
  }

  @override
  void didUpdateWidget(WebScreen old) {
    super.didUpdateWidget(old);
    if (old.path != widget.path) controller.loadRequest(home);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop && await controller.canGoBack()) controller.goBack();       // Android back goes back a page first
      },
      child: Stack(children: [
        SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.only(bottom: 90), child: WebViewWidget(controller: controller))),
        if (progress < 100) SafeArea(child: LinearProgressIndicator(value: progress / 100, minHeight: 2.5, backgroundColor: Colors.transparent)),
      ]),
    );
  }
}
