// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';

/// One thing worth telling the user. `id` must stay the same for the same event (so it is announced once):
/// e.g. 'booking:<registration id>:tomorrow', 'stock:<item>:low:<date>', 'job:<job id>:assigned'.
class Notice {
  const Notice({required this.id, required this.title, this.body = '', this.icon = Icons.notifications_rounded, this.color, this.at, this.open, this.link = ''});
  final String id;
  final String title;
  final String body;
  final IconData icon;
  final Color? color;
  final DateTime? at;

  /// What tapping it opens (a drive, an order, a job).
  final void Function(BuildContext context)? open;

  /// A page of the site it points to (from the server's messages); opened signed in when there is no `open`.
  final String link;
}
