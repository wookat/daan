import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';

const _mods = {
  'changshi': '常识判断',
  'yanyu': '言语理解',
  'shuliang': '数量关系',
  'panduan': '判断推理',
  'ziliao': '资料分析',
};

/// 大赛赛后报告：复刻 pkgA/exam/contest-report.vue。
/// 总分排名 + 分布 + 目标差距 + 模块表现 + 弱项考点 + 历届曲线 + 行动入口。
class ContestReportPage extends StatefulWidget {
  const ContestReportPage({super.key, required this.eventId});

  final int eventId;

  @override
  State<ContestReportPage> createState() => _ContestReportPageState();
}

class _ContestReportPageState extends State<ContestReportPage> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? r;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.mockReport(widget.eventId);
      setState(() {
        r = d;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('大赛报告')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _hero(cs),
                    if (r!['small_sample'] == true) ...[
                      const SizedBox(height: 12),
                      _sampleTip(cs),
                    ],
                    const SizedBox(height: 12),
                    _distCard(cs),
                    if (r!['target_score'] != null || r!['top25_score'] != null) ...[
                      const SizedBox(height: 12),
                      _gapCard(cs),
                    ],
                    if ((r!['modules'] as List).isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _modulesCard(cs),
                    ],
                    if ((r!['weak_tags'] as List).isNotEmpty) ...[
                      const SizedBox(height: 12),
                      _weakCard(cs),
                    ],
                    if ((r!['history'] as List).length > 1) ...[
                      const SizedBox(height: 12),
                      _historyCard(cs),
                    ],
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () =>
                                context.push('/exam/report/${r!['attempt_id']}'),
                            child: const Text('逐题回顾'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () {
                              final tags = r!['weak_tags'] as List;
                              final tag3 = tags.isNotEmpty ? tags.first['tag3'] : null;
                              context.push(
                                  '/practice${tag3 != null ? '?tag3=${Uri.encodeComponent(tag3 as String)}&count=5' : ''}');
                            },
                            child: const Text('弱项练 5 题'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
    );
  }

  Widget _hero(ColorScheme cs) {
    final ev = Map<String, dynamic>.from(r!['event']);
    return Card(
      color: cs.primary,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text(
              '${ev['title']}${ev['phase'] == 'ended' ? '（排名已冻结）' : '（实时排名）'}',
              style: TextStyle(fontSize: 12, color: cs.onPrimary.withValues(alpha: 0.85)),
            ),
            const SizedBox(height: 8),
            Text('${r!['score']}',
                style: TextStyle(
                    fontSize: 44, fontWeight: FontWeight.w800, color: cs.onPrimary)),
            const SizedBox(height: 6),
            Text(
              '第 ${r!['rank']} 名 / ${r!['total']} 人 · 击败 ${r!['pct']}% · 全场平均 ${r!['avg']} 分',
              style: TextStyle(fontSize: 12, color: cs.onPrimary.withValues(alpha: 0.9)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sampleTip(ColorScheme cs) {
    final pool = Map<String, dynamic>.from(r!['history_pool'] ?? {});
    return Card(
      color: Colors.amber.withValues(alpha: 0.15),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Text(
          '本场参赛 ${r!['total']} 人，样本较少，排名仅供参考；历史同卷共 ${pool['n']} 人作答、平均 ${pool['avg']} 分（含比赛窗口外练习）。',
          style: const TextStyle(fontSize: 12, height: 1.6, color: Color(0xFF92400E)),
        ),
      ),
    );
  }

  Widget _distCard(ColorScheme cs) {
    final dist = (r!['distribution'] as List).map((e) => (e as num).toInt()).toList();
    final maxN = dist.fold<int>(1, (m, n) => n > m ? n : m);
    final myBucket = (r!['my_bucket'] as num?)?.toInt() ?? -1;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('分数分布',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            SizedBox(
              height: 90,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < dist.length; i++)
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Container(
                            height: dist[i] > 0 ? 12 + 60.0 * dist[i] / maxN : 2,
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            decoration: BoxDecoration(
                              color: i == myBucket ? cs.primary : cs.surfaceContainerHighest,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(3)),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('${i * 10}',
                              style: TextStyle(
                                  fontSize: 9, color: cs.onSurfaceVariant)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text('你在 ${myBucket * 10}-${myBucket * 10 + 10} 分段（高亮）',
                style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }

  Widget _gapCard(ColorScheme cs) {
    final target = r!['target_score'] as num?;
    final top25 = r!['top25_score'] as num?;
    final score = r!['score'] as num;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('距离目标',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (target != null)
              _gapRow('目标分 $target',
                  (r!['gap_to_target'] as num) <= 0 ? '已达标 🎉' : '还差 ${r!['gap_to_target']} 分',
                  ok: (r!['gap_to_target'] as num) <= 0),
            if (top25 != null)
              _gapRow('前 25% 分数线 $top25',
                  score >= top25 ? '已进入前 25%' : '还差 ${((top25 - score) * 10).round() / 10} 分',
                  ok: score >= top25),
          ],
        ),
      ),
    );
  }

  Widget _gapRow(String k, String v, {required bool ok}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: const TextStyle(fontSize: 14)),
            Text(v,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: ok ? Colors.green : Colors.orange)),
          ],
        ),
      );

  Widget _modulesCard(ColorScheme cs) {
    final mods = (r!['modules'] as List).map((e) => Map<String, dynamic>.from(e));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('模块表现',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (final m in mods)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 70,
                      child: Text(_mods[m['module']] ?? m['module'] as String,
                          style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: (m['n'] ?? 0) > 0
                                  ? (m['correct'] as num) / (m['n'] as num)
                                  : 0,
                              minHeight: 7,
                              backgroundColor: cs.primaryContainer,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '答对 ${m['correct']}/${m['n']}'
                            '${m['avg_correct'] != null ? ' · 全场平均 ${m['avg_correct']}' : ''}'
                            ' · 用时 ${((m['secs'] ?? 0) as num) ~/ 60} 分 · 建议 ${((m['rec_secs'] ?? 0) as num) ~/ 60} 分',
                            style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _weakCard(ColorScheme cs) {
    final tags = (r!['weak_tags'] as List).map((e) => Map<String, dynamic>.from(e));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('本卷薄弱考点',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            for (final t in tags)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text((t['name'] ?? t['tag3']) as String),
                subtitle: Text('错 ${t['wrong']}/${t['n']} 题',
                    style: const TextStyle(color: Colors.red)),
                trailing: Text('去练 ›',
                    style: TextStyle(color: cs.primary, fontWeight: FontWeight.w600)),
                onTap: () => context.push(
                    '/practice?tag3=${Uri.encodeComponent(t['tag3'] as String)}'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _historyCard(ColorScheme cs) {
    final hist = (r!['history'] as List).map((e) => Map<String, dynamic>.from(e)).toList();
    final eventId = (r!['event'] as Map)['id'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('历届大赛成绩',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 14),
            SizedBox(
              height: 120,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < hist.length; i++)
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text('${hist[i]['score']}',
                              style: TextStyle(
                                  fontSize: 10, color: cs.onSurfaceVariant)),
                          const SizedBox(height: 2),
                          Container(
                            height: 8 + ((hist[i]['score'] as num).toDouble()).clamp(0, 100) * 0.8,
                            margin: const EdgeInsets.symmetric(horizontal: 6),
                            constraints: const BoxConstraints(maxWidth: 26),
                            decoration: BoxDecoration(
                              color: hist[i]['id'] == eventId
                                  ? cs.primary
                                  : cs.primaryContainer,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(4)),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('${i + 1}',
                              style: TextStyle(
                                  fontSize: 10, color: cs.onSurfaceVariant)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text('同系列最近 ${hist.length} 场成绩（分）',
                style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}
