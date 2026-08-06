import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';

/// 周学习报告：复刻 pkgA/stats/weekly-report.vue。
/// 头部概览 + 徽章 + 本周对比 + 掌握度变化 + 错因分布 + 模考回顾 + 下周行动 + 分享。
class WeeklyReportPage extends StatefulWidget {
  const WeeklyReportPage({super.key, this.week});

  final String? week;

  @override
  State<WeeklyReportPage> createState() => _WeeklyReportPageState();
}

class _WeeklyReportPageState extends State<WeeklyReportPage> {
  bool loading = true;
  String? error;
  bool empty = false;
  String range = '';
  Map<String, dynamic>? r;
  Map<String, dynamic>? nextEvent;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.weeklyReport(week: widget.week);
      if (d['status'] == 'empty') {
        setState(() {
          empty = true;
          range = (d['range'] ?? '') as String;
          loading = false;
        });
        return;
      }
      setState(() {
        r = d;
        loading = false;
      });
      final day = (d['range'] as String).substring(0, 10);
      try {
        await Api.weeklyReportRead(day);
      } catch (_) {}
      try {
        final ev = await Api.weeklyNextEvent();
        if (mounted) setState(() => nextEvent = ev);
      } catch (_) {}
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  int _pct(num? v) => ((v ?? 0) * 100).round();

  String _mins(num? s) => '${((s ?? 0) / 60).round()} 分钟';

  void _share() {
    final s = Map<String, dynamic>.from(r!['summary']);
    Share.share(
      '我的考公周报（${r!['range']}）：学习 ${s['days']} 天，刷题 ${s['n']} 道，'
      '正确率 ${_pct(s['acc'] as num?)}%。一起上岸！kaogong.zalize.com',
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('周学习报告')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : empty
                  ? _empty(cs)
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _hero(cs),
                        if ((r!['badges'] as List).isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _badges(cs),
                        ],
                        const SizedBox(height: 12),
                        _compareCard(cs),
                        if (_hasMastery) ...[
                          const SizedBox(height: 12),
                          _masteryCard(cs),
                        ],
                        if ((r!['reasons'] as List).isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _reasonsCard(cs),
                        ],
                        const SizedBox(height: 12),
                        _mockCard(cs),
                        if ((r!['actions'] as List).isNotEmpty) ...[
                          const SizedBox(height: 12),
                          _actionsCard(cs),
                        ],
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: _share,
                          icon: const Icon(Icons.ios_share, size: 18),
                          label: const Text('分享周报'),
                        ),
                      ],
                    ),
    );
  }

  bool get _hasMastery {
    final m = Map<String, dynamic>.from(r!['mastery']);
    return (m['up'] as List).isNotEmpty || (m['down'] as List).isNotEmpty;
  }

  Widget _empty(ColorScheme cs) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('上周没有学习记录',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Text(range, style: TextStyle(color: cs.onSurfaceVariant)),
              const SizedBox(height: 4),
              Text('本周刷起来，下周一就能看到你的专属周报',
                  style: TextStyle(color: cs.onSurfaceVariant)),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.push('/practice'),
                child: const Text('去刷题'),
              ),
            ],
          ),
        ),
      );

  Widget _hero(ColorScheme cs) {
    final s = Map<String, dynamic>.from(r!['summary']);
    final prev = Map<String, dynamic>.from(r!['prev']);
    final curAcc = (s['acc'] ?? 0) as num;
    final prevAcc = (prev['acc'] ?? 0) as num;
    final String trend;
    if ((prev['n'] ?? 0) == 0) {
      trend = '✦ 新开始';
    } else if (curAcc > prevAcc + 0.01) {
      trend = '↑ 进步';
    } else if (curAcc < prevAcc - 0.01) {
      trend = '↓ 回落';
    } else {
      trend = '→ 持平';
    }
    Widget num_(String v, String k) => Expanded(
          child: Column(
            children: [
              Text(v,
                  style: TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800, color: cs.onPrimary)),
              const SizedBox(height: 4),
              Text(k,
                  style: TextStyle(
                      fontSize: 11, color: cs.onPrimary.withValues(alpha: 0.8))),
            ],
          ),
        );
    return Card(
      color: cs.primary,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            Text(r!['range'] as String,
                style: TextStyle(
                    fontSize: 12, color: cs.onPrimary.withValues(alpha: 0.85))),
            const SizedBox(height: 14),
            Row(
              children: [
                num_('${s['days']}', '学习天数'),
                num_('${s['n']}', '刷题量'),
                num_('${_pct(curAcc)}%', '正确率'),
                num_(trend, '较上周'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badges(ColorScheme cs) {
    final badges = (r!['badges'] as List).map((e) => Map<String, dynamic>.from(e));
    return Row(
      children: [
        for (final b in badges)
          Expanded(
            child: Card(
              color: Colors.amber.withValues(alpha: 0.15),
              margin: const EdgeInsets.only(right: 8),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(b['title'] as String,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF92400E))),
                    const SizedBox(height: 4),
                    Text(b['desc'] as String,
                        style: const TextStyle(
                            fontSize: 10, color: Color(0xFFB45309))),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _compareCard(ColorScheme cs) {
    final c = Map<String, dynamic>.from(r!['compare']);
    Widget row(String k, String v, String p) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            children: [
              SizedBox(
                  width: 80,
                  child:
                      Text(k, style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant))),
              Expanded(
                  child: Text(v,
                      style:
                          const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
              Text(p, style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
            ],
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('本周 vs 上周',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            row('刷题量', '${c['n'][0]} 题', '上周 ${c['n'][1]}'),
            row('正确率', '${_pct(c['acc'][0] as num?)}%', '上周 ${_pct(c['acc'][1] as num?)}%'),
            row('学习时长', _mins(c['secs'][0] as num?), '上周 ${_mins(c['secs'][1] as num?)}'),
            row('学习天数', '${c['days'][0]} 天', '上周 ${c['days'][1]} 天'),
          ],
        ),
      ),
    );
  }

  Widget _masteryCard(ColorScheme cs) {
    final m = Map<String, dynamic>.from(r!['mastery']);
    Widget row(Map<String, dynamic> x, bool up) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              CircleAvatar(
                radius: 10,
                backgroundColor:
                    (up ? Colors.green : Colors.red).withValues(alpha: 0.12),
                child: Text(up ? '↑' : '↓',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: up ? Colors.green : Colors.red)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(x['submodule'] as String)),
              Text('${_pct(x['prev_acc'] as num?)}% → ${_pct(x['acc'] as num?)}%',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
            ],
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('考点掌握变化',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            for (final x in (m['up'] as List)) row(Map<String, dynamic>.from(x), true),
            for (final x in (m['down'] as List)) row(Map<String, dynamic>.from(x), false),
          ],
        ),
      ),
    );
  }

  Widget _reasonsCard(ColorScheme cs) {
    final reasons =
        (r!['reasons'] as List).map((e) => Map<String, dynamic>.from(e)).toList();
    final maxN = reasons.fold<int>(1, (m, x) {
      final n = (x['n'] as num).toInt();
      return n > m ? n : m;
    });
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('本周错因分布',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 10),
            for (final x in reasons)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    SizedBox(
                        width: 76,
                        child: Text(x['reason'] as String,
                            style: TextStyle(
                                fontSize: 12, color: cs.onSurfaceVariant))),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          value: (x['n'] as num) / maxN,
                          minHeight: 8,
                          color: Colors.red,
                          backgroundColor: Colors.red.withValues(alpha: 0.1),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text('${x['n']}（上周 ${x['prev_n']}）',
                        style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _mockCard(ColorScheme cs) {
    final mock = r!['mock'] is Map ? Map<String, dynamic>.from(r!['mock']) : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('模考回顾',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (mock != null) ...[
              Text('本周模考最高 ${mock['score']} 分（共 ${mock['n_exams']} 次）',
                  style: const TextStyle(fontSize: 14)),
              if (mock['event_title'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${mock['event_title']}：${mock['rank'] != null ? '第 ${mock['rank']} 名 · ' : ''}击败 ${mock['pct']}%',
                  style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
              ],
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => context.push('/exam/report/${mock['attempt_id']}'),
                child: const Text('查看成绩报告'),
              ),
            ] else ...[
              Text('本周未模考', style: TextStyle(color: cs.onSurfaceVariant)),
              if (nextEvent != null) ...[
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => context.push('/exam/contest'),
                  child: Text('下一场：${nextEvent!['title']}'),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _actionsCard(ColorScheme cs) {
    final actions =
        (r!['actions'] as List).map((e) => Map<String, dynamic>.from(e)).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('下周行动',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            for (final a in actions)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(a['title'] as String),
                trailing: Text('去完成 ›',
                    style: TextStyle(color: cs.primary, fontWeight: FontWeight.w600)),
                onTap: () => _goAction(a),
              ),
          ],
        ),
      ),
    );
  }

  void _goAction(Map<String, dynamic> a) {
    switch (a['type']) {
      case 'review':
        context.go('/book');
      case 'mock':
        context.push('/exam/contest');
      default:
        final url = (a['url'] ?? '') as String;
        final m = RegExp(r'tag3=([^&]+)').firstMatch(url);
        final tag3 = m != null ? Uri.decodeComponent(m.group(1)!) : null;
        context.push('/practice${tag3 != null ? '?tag3=${Uri.encodeComponent(tag3)}' : ''}');
    }
  }
}
