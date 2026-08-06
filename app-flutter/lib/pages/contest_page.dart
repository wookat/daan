import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';

/// 模考大赛：复刻 pkgA/exam/contest.vue。
/// 当前场次卡（未开始/进行中/已结束三态）+ 往期战绩 + 赛制说明。
class ContestPage extends StatefulWidget {
  const ContestPage({super.key});

  @override
  State<ContestPage> createState() => _ContestPageState();
}

class _ContestPageState extends State<ContestPage> {
  bool loading = true;
  String? error;
  Map<String, dynamic>? event;
  List<Map<String, dynamic>> past = [];
  bool rulesOpen = false;
  Timer? _timer;
  int nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!mounted) return;
      setState(() => nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000);
      final ev = event;
      if (ev != null &&
          ((ev['phase'] == 'upcoming' && nowSec >= (ev['open_at'] as num)) ||
              (ev['phase'] == 'running' && nowSec >= (ev['close_at'] as num)))) {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await Api.mockEvents();
      setState(() {
        event = (d['current'] ?? d['next']) is Map
            ? Map<String, dynamic>.from(d['current'] ?? d['next'])
            : null;
        past = ((d['past'] ?? []) as List<dynamic>)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        loading = false;
        error = null;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Future<void> _register() async {
    final ev = event!;
    try {
      await Api.mockRegister(ev['id'] as int);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('报名成功，周六见！')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _enter() async {
    final ev = event!;
    try {
      final d = await Api.mockEnter(ev['id'] as int);
      if (mounted) {
        context.push('/exam/run?paper_id=${d['paper_id']}&event_id=${ev['id']}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  String get _countdown {
    final ev = event!;
    final target =
        (ev['phase'] == 'upcoming' ? ev['open_at'] : ev['close_at']) as num;
    var s = (target - nowSec).toInt().clamp(0, 1 << 31);
    final d = s ~/ 86400;
    s %= 86400;
    final h = s ~/ 3600;
    final m = (s % 3600) ~/ 60;
    return '${d > 0 ? '$d 天 ' : ''}$h 时 $m 分';
  }

  String _fmtWindow(Map<String, dynamic> ev) {
    final o = DateTime.fromMillisecondsSinceEpoch(((ev['open_at'] as num) * 1000).toInt());
    final c = DateTime.fromMillisecondsSinceEpoch(((ev['close_at'] as num) * 1000).toInt());
    String p(int n) => n.toString().padLeft(2, '0');
    final close = c.hour == 0 ? '24:00' : '${p(c.hour)}:${p(c.minute)}';
    return '${o.month}月${o.day}日 ${p(o.hour)}:${p(o.minute)} - $close';
  }

  String _fmtDay(num t) {
    final d = DateTime.fromMillisecondsSinceEpoch((t * 1000).toInt());
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('模考大赛')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (event != null) _heroCard(cs) else _emptyCard(),
                      if (past.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        _pastCard(cs),
                      ],
                      const SizedBox(height: 16),
                      _rulesCard(cs),
                    ],
                  ),
                ),
    );
  }

  Widget _emptyCard() => const Card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Center(child: Text('暂无比赛场次')),
        ),
      );

  Widget _heroCard(ColorScheme cs) {
    final ev = event!;
    final phase = ev['phase'] as String;
    final phaseText = {'upcoming': '未开始', 'running': '进行中', 'ended': '已结束'}[phase] ?? '';
    final phaseColor = {
      'upcoming': Colors.orange,
      'running': Colors.green,
      'ended': Colors.grey,
    }[phase]!;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    ev['series'] == 'weekly' ? '每周六 · 全站同卷' : '专场比赛',
                    style: TextStyle(fontSize: 11, color: cs.primary),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: phaseColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(phaseText,
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600, color: phaseColor)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(ev['title'] ?? '',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(
              '${ev['paper_title'] ?? ''} · ${ev['n_questions']} 题 · ${ev['duration_min']} 分钟',
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 6),
            Text(
              '${_fmtWindow(ev)} · ${ev['registered']} 人报名 · ${ev['submitted']} 人交卷',
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 14),
            if (phase == 'upcoming') ...[
              Text('距开赛 $_countdown',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Colors.orange)),
              const SizedBox(height: 10),
              if (ev['my_state'] == '未报名')
                FilledButton(onPressed: _register, child: const Text('预约报名'))
              else
                const Chip(label: Text('已报名，开赛后可进入')),
            ] else if (phase == 'running') ...[
              Text('距截止 $_countdown',
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: Colors.orange)),
              const SizedBox(height: 10),
              if (ev['my_state'] == '已交卷') ...[
                Text('本场成绩 ${ev['my_score']} 分',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => context.push('/exam/contest/report/${ev['id']}'),
                  child: const Text('查看实时排名与报告'),
                ),
              ] else
                FilledButton(
                  onPressed: _enter,
                  child: Text(ev['my_state'] == '已报名' ? '进入考试' : '立即参赛'),
                ),
            ] else ...[
              if (ev['my_score'] != null) ...[
                Text(
                  '本场成绩 ${ev['my_score']} 分${ev['my_rank'] != null ? ' · 第 ${ev['my_rank']} 名' : ''}',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => context.push('/exam/contest/report/${ev['id']}'),
                  child: const Text('查看赛后报告'),
                ),
              ] else
                OutlinedButton(
                  onPressed: () => context.push('/exam/run?paper_id=${ev['paper_id']}'),
                  child: const Text('比赛已结束 · 作为普通试卷练习'),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _pastCard(ColorScheme cs) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('我的往期战绩',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (final p in past)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: Text(p['title'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(_fmtDay(p['close_at'] as num)),
                trailing: p['joined'] == true
                    ? Text(
                        '${p['score']} 分${p['rank'] != null ? ' · 第 ${p['rank']} 名' : ''}',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, color: cs.primary),
                      )
                    : Text('未参加', style: TextStyle(color: cs.onSurfaceVariant)),
                onTap: p['joined'] == true
                    ? () => context.push('/exam/contest/report/${p['id']}')
                    : null,
              ),
          ],
        ),
      ),
    );
  }

  Widget _rulesCard(ColorScheme cs) {
    const rules = [
      '每周六 09:00-24:00（东八区）全站同卷比赛，报名可选，开赛后随时进入。',
      '只有比赛窗口内交卷的成绩计入排名，且以首次交卷为准。',
      '交卷后即可看到成绩与实时排名，比赛结束后排名冻结并生成赛后报告。',
      '比赛结束后试卷转为普通试卷，可自由练习，不影响比赛榜单。',
      '参赛人数较少时，报告会同时展示历史同卷分数池作为参照。',
    ];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => setState(() => rulesOpen = !rulesOpen),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('赛制说明',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  Icon(rulesOpen ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                      size: 18, color: cs.onSurfaceVariant),
                ],
              ),
            ),
            if (rulesOpen) ...[
              const SizedBox(height: 10),
              for (var i = 0; i < rules.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('${i + 1}. ${rules[i]}',
                      style: TextStyle(
                          fontSize: 13, height: 1.6, color: cs.onSurfaceVariant)),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
