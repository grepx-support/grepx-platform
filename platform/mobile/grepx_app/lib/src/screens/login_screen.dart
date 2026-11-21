// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../app/scope.dart';
import '../design/tokens.dart';
import '../widgets/feedback.dart';

/// Sign in: the product's mark on a soft brand glow, two fields, one big button. `standalone` = the first page of
/// a staff-only product (nothing to go back to).
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.standalone = false});
  final bool standalone;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool remember = true, busy = false, hidden = true;

  Future<void> _signIn() async {
    final scope = AppScope.of(context);
    setState(() => busy = true);
    final s = await attempt(context, () => scope.api.post('/auth/login', {'email': email.text.trim(), 'password': password.text, 'remember': remember}));
    if (!mounted) return;
    setState(() => busy = false);
    if (s == null) return;
    final hook = scope.product.afterSignIn;
    await scope.session.save(Map<String, dynamic>.from(s as Map), notify: hook == null);
    if (hook != null) {
      try {
        await hook(scope.api, scope.session);
        scope.session.changed();
      } catch (e) {
        await scope.session.clear();
        showBanner('Could not load your account', text: '$e', kind: BannerKind.error);
        return;
      }
    }
    showBanner('Welcome back', kind: BannerKind.success);
    if (mounted && !widget.standalone && Navigator.canPop(context)) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final product = AppScope.of(context).product;
    return Scaffold(
      appBar: widget.standalone ? null : AppBar(backgroundColor: Colors.transparent),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(center: const Alignment(0, -1.1), radius: 1.2, colors: [product.color.withValues(alpha: 0.30), SystemColors.background(Theme.of(context).brightness)]),
        ),
        child: SafeArea(
          child: ListView(padding: const EdgeInsets.fromLTRB(24, 48, 24, 24), children: [
            Center(
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [product.color, Color.lerp(product.color, Colors.black, 0.25)!], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: Corner.all(28),
                  boxShadow: [BoxShadow(color: product.color.withValues(alpha: 0.4), blurRadius: 30, offset: const Offset(0, 12))],
                ),
                child: Center(child: Text(product.logo, style: const TextStyle(fontSize: 48))),
              ).animate().scale(begin: const Offset(0.6, 0.6), duration: 500.ms, curve: Curves.easeOutBack).fadeIn(),
            ),
            const SizedBox(height: Gap.xl),
            Text(product.name, textAlign: TextAlign.center, style: context.text.displaySmall),
            if (product.tagline.isNotEmpty)
              Padding(padding: const EdgeInsets.only(top: Gap.s), child: Text(product.tagline, textAlign: TextAlign.center, style: TextStyle(color: context.secondaryText, fontSize: 16))),
            const SizedBox(height: 40),
            TextField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(hintText: 'Email', prefixIcon: Icon(Icons.mail_outline_rounded)),
            ),
            const SizedBox(height: Gap.m),
            TextField(
              controller: password,
              obscureText: hidden,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _signIn(),
              decoration: InputDecoration(
                hintText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(icon: Icon(hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined), onPressed: () => setState(() => hidden = !hidden)),
              ),
            ),
            const SizedBox(height: Gap.s),
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: remember,
              onChanged: (v) => setState(() => remember = v),
              title: const Text('Keep me signed in'),
            ),
            const SizedBox(height: Gap.m),
            FilledButton(
              onPressed: busy ? null : _signIn,
              child: busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator.adaptive(strokeWidth: 2.4)) : const Text('Sign in'),
            ),
            TextButton(
              onPressed: () => attempt(context, () => AppScope.of(context).api.post('/auth/forgot', {'email': email.text.trim()}), done: 'If that email is registered, a link is on its way'),
              child: const Text('Forgot password?'),
            ),
          ].animate(interval: 40.ms).fadeIn(duration: 300.ms).slideY(begin: 0.08, end: 0)),
        ),
      ),
    );
  }
}
