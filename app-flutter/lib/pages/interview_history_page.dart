import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 面试练习记录，对照 frontend-uni/src/pkgA/interview/history.vue。
class InterviewHistoryPage extends StatefulWidget {
  const InterviewHistoryPage({super.key});

  @override
  State<InterviewHistoryPage> createState() => _InterviewHistoryPageState();
}

class _InterviewHistoryPageState extends State<InterviewHistoryPage> {
  List<dynamic> items = [];
  int total = 0;
  int? best;
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.interviewHistory(limit: 100);
      setState(() {
        items = d['items'] as List<dynamic>? ?? [];
        total = (d['total'] as num?)?.toInt() ?? 0;
        best = (d['best'] as num?)?.toInt();
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
    if (mounted) setState(() => loaded = true);
  }

  int? get avg {
    if (items.isEmpty) return null;
    final s = items.fold<num>(0, (a, i) => a + ((i['total'] as num?) ?? 0));
    return (s / items.length).round();
  }

  String _fmtTime(dynamic ts) {
    if (ts is! num) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts.toInt() * 1000);
    String p(int n) => n.toString().padLeft(2, '0');
    return '${d.month}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}';
  }

  String _fmtDur(int s) => "${s ~/ 60}'${(s % 60).toString().padLeft(2, '0')}\"";

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('练习记录')),
      body: !loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Row(
                  children: [
                    _stat('$total', '练习次数'),
                    const SizedBox(width: 10),
                    _stat(best == null ? '—' : '$best', '最高得分'),
                    const SizedBox(width: 10),
                    _stat(avg == null ? '—' : '$avg', '平均得分'),
                  ],
                ),
                const SizedBox(height: 16),
                if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 60),
                    child: Column(
                      children: [
                        const Icon(LucideIcons.mic, size: 40, color: KgColors.t4),
                        const SizedBox(height: 12),
                        const Text('还没有练习记录',
                            style: TextStyle(fontSize: 14, color: KgColors.t3)),
                        const SizedBox(height: 16),
                        FilledButton(
                          style: FilledButton.styleFrom(
                              minimumSize: const Size(160, 44)),
                          onPressed: () => context.pop(),
                          child: const Text('去练一题'),
                        ),
                      ],
                    ),
                  )
                else
                  for (final it in items) ...[
                    Card(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () => context
                            .push('/interview?session_id=${it['id']}'),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color:
                                          KgColors.brand.withValues(alpha: .1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                        (it['category'] ?? '').toString(),
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: KgColors.brand,
                                            fontWeight: FontWeight.w600)),
                                  ),
                                  const Spacer(),
                                  Text('${it['total'] ?? 0} 分',
                                      style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          color: ((it['total'] as num?) ?? 0) >=
                                                  80
                                              ? KgColors.success
                                              : null)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text((it['question_text'] ?? '').toString(),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 13.5, height: 1.6)),
                              const SizedBox(height: 8),
                              Text(
                                '${_fmtTime(it['created_at'])} · 作答 ${_fmtDur(((it['duration_sec'] as num?) ?? 0).toInt())}',
                                style: const TextStyle(
                                    fontSize: 11, color: KgColors.t3),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
              ],
            ),
    );
  }

  Widget _stat(String n, String t) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(
            children: [
              Text(n,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text(t, style: const TextStyle(fontSize: 11, color: KgColors.t3)),
            ],
          ),
        ),
      ),
    );
  }
}
