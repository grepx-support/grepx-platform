// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app/scope.dart';
import '../design/tokens.dart';
import '../net/api.dart';
import '../widgets/bits.dart';
import '../widgets/cards.dart';
import '../widgets/feedback.dart';
import '../widgets/loads.dart';
import '../widgets/page.dart';
import '../widgets/states.dart';

/// The shared task board (task-service): filter by state, swipe a task right to finish it, tap for its states.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> with LoadsData {
  static const states = {'todo': 'To do', 'in_progress': 'Doing', 'blocked': 'Blocked', 'done': 'Done'};
  String filter = 'todo';

  @override
  Future<dynamic> load(Api api) => api.get('/tasks');

  Future<void> _set(Map t, String state) async {
    final api = AppScope.of(context).api;
    await attempt(context, () => api.post('/tasks/${t['id']}/status', {'state': state}), done: state == 'done' ? 'Done ✓' : null);
    await reload();
  }

  @override
  Widget build(BuildContext context) => AsyncView<dynamic>(
        future: data,
        onRetry: reload,
        builder: (context, data) {
          final all = (data as List).cast<Map>();
          final shown = all.where((t) => t['state'] == filter).toList();
          return LargeTitlePage(
            title: 'Tasks',
            onRefresh: reload,
            children: [
              Segments<String>(
                value: filter,
                options: {for (final e in states.entries) e.key: '${e.value} ${all.where((t) => t['state'] == e.key).length}'},
                onChanged: (v) => setState(() => filter = v),
              ),
              const SizedBox(height: Gap.l),
              if (shown.isEmpty) EmptyState(icon: Icons.task_alt_rounded, title: filter == 'done' ? 'Nothing finished yet' : 'Nothing here', text: 'Pull down to refresh.'),
              for (final t in shown)
                Padding(
                  padding: const EdgeInsets.only(bottom: Gap.s),
                  child: Dismissible(
                    key: ValueKey(t['id']),
                    direction: t['state'] == 'done' ? DismissDirection.none : DismissDirection.startToEnd,
                    confirmDismiss: (_) async {
                      HapticFeedback.mediumImpact();
                      await _set(t, 'done');
                      return false;
                    },
                    background: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: Gap.xl),
                      decoration: BoxDecoration(color: SystemColors.green, borderRadius: Corner.all(Corner.card)),
                      child: const Icon(Icons.check_rounded, color: Colors.white, size: 30),
                    ),
                    child: SoftCard(
                      onTap: () => _pick(t),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${t['title']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text('${t['ref_label'] ?? 'General'} · ${(t['due_at'] ?? '').toString().replaceAll('T', ' ')}', style: TextStyle(color: context.secondaryText, fontSize: 13)),
                          ]),
                        ),
                        if (t['important'] == true) const Padding(padding: EdgeInsets.only(right: 8), child: Icon(Icons.local_fire_department_rounded, color: SystemColors.orange)),
                        StatusPill(states[t['state']] ?? '${t['state']}', color: StatusPill.colorFor('${t['state']}')),
                      ]),
                    ),
                  ),
                ),
            ],
          );
        },
      );

  void _pick(Map t) => showModalBottomSheet(
        context: context,
        builder: (sheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Gap.l, 0, Gap.l, Gap.l),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('${t['title']}', style: sheet.text.titleLarge),
              const SizedBox(height: Gap.l),
              GroupedList(children: [
                for (final e in states.entries)
                  RowItem(
                    title: e.value,
                    trailing: t['state'] == e.key ? Icon(Icons.check_rounded, color: sheet.brand) : null,
                    onTap: () {
                      Navigator.pop(sheet);
                      _set(t, e.key);
                    },
                  ),
              ]),
            ]),
          ),
        ),
      );
}
