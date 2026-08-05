import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/plan_setup_sheet.dart';
import '../widgets/predict_card.dart';

const _mods = [
  ('ziliao', '资料'),
  ('shuliang', '数量'),
  ('yanyu', '言语'),
  ('panduan', '判断'),
  ('changshi', '常识'),
];

/// 统计页：复刻 pages/stats/stats.vue 全量功能。
/// 账号卡 + KPI + 日历入口 + 预测分 + 今日待办 + 雷达 + 错题分布 + 高频题型 +
/// 错因分布 + 近7日 + 成长轨迹（分模块）+ 申论统计 + 练习记录/速度 + 考点地图 +
/// AI 教练 + 勋章 + 备份恢复。
class StatsPage extends StatefulWidget {
  const StatsPage({super.key});

  @override
  State<StatsPage> createState() => _StatsPageState();
}

class _StatsPageState extends State<StatsPage> {
  Map<String, dynamic>? growth;
  Map<String, dynamic>? profile;
  Map<String, dynamic>? reco;
  Map<String, dynamic>? slStats;
  Map<String, dynamic> checkin = {};
  List<Map<String, dynamic>> byModule = [];
  List<Map<String, dynamic>> byType = [];
  List<Map<String, dynamic>> byReason = [];
  Map<String, dynamic> subProgress = {};
  int dueCount = 0;
  int mistakeCount = 0;
  int masteredCount = 0;
  bool loading = true;
  String? error;
  String gwMod = '';
  bool modOpen = false;
  bool typeOpen = false;
  bool showAllHist = false;
  bool coachLoading = false;
  String coachAdvice = Store.instance.coachAdvice;
  String backupCode = Store.instance.backupCode;
  bool bkLoading = false;
  List<dynamic> history = Store.instance.practiceHistory;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      history = Store.instance.practiceHistory;
    });
    try {
      final r = await Future.wait([
        Api.growth(),
        Api.reviewDue().catchError((_) => <String, dynamic>{'total': 0}),
        Api.mistakes().catchError((_) => const <dynamic>[]),
        Api.stats().catchError((_) => <String, dynamic>{}),
        Api.checkinSummary().catchError((_) => <String, dynamic>{}),
        Api.recommend().catchError((_) => <String, dynamic>{}),
        Api.shenlunStats().catchError((_) => <String, dynamic>{}),
        Api.submoduleProgress().catchError((_) => <String, dynamic>{}),
      ]);
      final pf = await Api.profile().catchError((_) => null);
      final mk = (r[2] as List<dynamic>)
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      final st = r[3] as Map<String, dynamic>;
      List<Map<String, dynamic>> asList(dynamic v) => (v as List<dynamic>? ?? [])
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      setState(() {
        growth = r[0] as Map<String, dynamic>;
        dueCount = ((r[1] as Map<String, dynamic>)['total'] ?? 0) as int;
        mistakeCount = mk.length;
        masteredCount = mk.where((m) => m['mastered'] == 1 || m['mastered'] == true).length;
        byModule = asList(st['by_module']);
        byType = asList(st['by_type']);
        byReason = asList(st['by_reason']);
        checkin = r[4] as Map<String, dynamic>;
        reco = r[5] as Map<String, dynamic>;
        slStats = r[6] as Map<String, dynamic>;
        subProgress = r[7] as Map<String, dynamic>;
        profile = pf;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  // ---------- 派生数据 ----------

  Map<String, Map<String, int>> get _days {
    final raw = Map<String, dynamic>.from(checkin['days'] as Map? ?? {});
    return raw.map((k, v) {
      final m = Map<String, dynamic>.from(v as Map);
      return MapEntry(k, {
        'n': ((m['n'] ?? 0) as num).toInt(),
        'correct': ((m['correct'] ?? 0) as num).toInt(),
      });
    });
  }

  int get streak => ((checkin['streak'] ?? 0) as num).toInt();

  /// 各模块累计正确率（growth 汇总）。
  Map<String, List<int>> get _byModuleAcc {
    final out = <String, List<int>>{};
    for (final w in (growth?['weeks'] as List<dynamic>? ?? [])) {
      final mods = (w as Map)['modules'] as Map? ?? {};
      mods.forEach((k, v) {
        final cur = out.putIfAbsent(k.toString(), () => [0, 0]);
        cur[0] += (((v as Map)['n'] ?? 0) as num).toInt();
        cur[1] += ((v['c'] ?? 0) as num).toInt();
      });
    }
    return out;
  }

  List<({String key, String name, int pct, int n})> get axes {
    final acc = _byModuleAcc;
    return [
      for (final (key, name) in _mods)
        (
          key: key,
          name: name,
          pct: (acc[key]?[0] ?? 0) > 0
              ? (acc[key]![1] * 100 / acc[key]![0]).round()
              : 0,
          n: acc[key]?[0] ?? 0,
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('学习统计'),
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/calendar'),
            icon: const Icon(LucideIcons.calendarDays, size: 16),
            label: const Text('学习日历'),
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(error!, style: const TextStyle(color: KgColors.t3)),
                      const SizedBox(height: 12),
                      FilledButton(
                          style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
                          onPressed: _load,
                          child: const Text('重试')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _accountCard(),
                      const SizedBox(height: 16),
                      _kpiRow(),
                      const SizedBox(height: 16),
                      const PredictCard(),
                      const SizedBox(height: 16),
                      _todoCard(),
                      const SizedBox(height: 16),
                      _radarCard(),
                      const SizedBox(height: 16),
                      _mistakeDistCard(),
                      const SizedBox(height: 16),
                      _topTypesCard(),
                      const SizedBox(height: 16),
                      _reasonCard(),
                      const SizedBox(height: 16),
                      _weekTrendCard(),
                      const SizedBox(height: 16),
                      _growthCard(),
                      const SizedBox(height: 16),
                      _shenlunCard(),
                      const SizedBox(height: 16),
                      _historyCard(),
                      const SizedBox(height: 16),
                      _speedCard(),
                      const SizedBox(height: 16),
                      _kpMapCard(),
                      const SizedBox(height: 16),
                      _profileCard(),
                      const SizedBox(height: 16),
                      _coachCard(),
                      const SizedBox(height: 16),
                      _medalsCard(),
                      const SizedBox(height: 16),
                      _backupCard(),
                    ],
                  ),
                ),
    );
  }

  // ---------- 账号 ----------

  Widget _accountCard() {
    final u = Store.instance.authUser;
    return Card(
      child: ListTile(
        leading: Icon(u == null ? LucideIcons.userX : LucideIcons.userCheck,
            color: u == null ? KgColors.t4 : KgColors.brand),
        title: Text(
            u == null ? '未登录 · 数据仅在本机' : (u['nickname'] ?? u['phone'] ?? '已登录').toString(),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        subtitle: Text(u == null ? '登录后多端同步做题记录与错题本' : '已登录，数据多端同步',
            style: const TextStyle(fontSize: 12, color: KgColors.t3)),
        trailing: u == null
            ? FilledButton(
                style: FilledButton.styleFrom(
                    minimumSize: const Size(72, 34),
                    padding: const EdgeInsets.symmetric(horizontal: 14)),
                onPressed: () async {
                  await context.push('/login');
                  _load();
                },
                child: const Text('登录', style: TextStyle(fontSize: 13)),
              )
            : TextButton(
                onPressed: _logout,
                child: const Text('退出', style: TextStyle(fontSize: 13, color: KgColors.t3)),
              ),
      ),
    );
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('退出后本机回到匿名模式，账号数据仍保留在云端'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('退出')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.authLogout();
    } catch (_) {}
    Store.instance.clearAuth();
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('已退出登录')));
    }
    _load();
  }

  // ---------- KPI ----------

  Widget _kpiRow() {
    final total = Map<String, dynamic>.from(growth?['total'] as Map? ?? {});
    final n = ((total['n'] ?? 0) as num).toInt();
    final c = ((total['c'] ?? 0) as num).toInt();
    final acc = n > 0 ? (c * 100 / n).round() : 0;
    return Row(
      children: [
        _kpi('累计做题', '$n', LucideIcons.edit3),
        const SizedBox(width: 10),
        _kpi('总正确率', '$acc%', LucideIcons.target),
        const SizedBox(width: 10),
        _kpi('连续打卡', '$streak 天', LucideIcons.flame),
        const SizedBox(width: 10),
        _kpi('错题待复习', '$dueCount', LucideIcons.alarmClock),
      ],
    );
  }

  Widget _kpi(String label, String value, IconData icon) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14),
          child: Column(
            children: [
              Icon(icon, size: 16, color: KgColors.brand),
              const SizedBox(height: 6),
              Text(value,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 10, color: KgColors.t3)),
            ],
          ),
        ),
      ),
    );
  }

  // ---------- 今日待办 ----------

  Widget _todoCard() {
    final tasks = <({String title, String sub, VoidCallback go})>[];
    if (dueCount > 0) {
      tasks.add((
        title: '错题复习 · $dueCount 道到期',
        sub: '按遗忘曲线复习，连对可斩题',
        go: () => context.push('/practice?mode=review'),
      ));
    }
    final weak = (reco?['items'] as List<dynamic>? ?? []);
    for (final w in weak.take(2)) {
      final m = Map<String, dynamic>.from(w as Map);
      final key = (m['module'] ?? '').toString();
      final sub = (m['submodule'] ?? '').toString();
      final acc = ((m['acc'] ?? 0) as num) * 100;
      tasks.add((
        title: '弱项突破 · ${sub.isNotEmpty ? sub : moduleName(key)}',
        sub: '${(m['reason'] ?? '').toString().isNotEmpty ? m['reason'] : '正确率 ${acc.round()}%'}，建议专项 10 题',
        go: () => context.push('/practice?module=$key'),
      ));
    }
    if (tasks.isEmpty) return const SizedBox.shrink();
    return _section('今日待办', LucideIcons.listChecks, [
      for (final t in tasks)
        ListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(t.title,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          subtitle: Text(t.sub, style: const TextStyle(fontSize: 11, color: KgColors.t3)),
          trailing: const Icon(LucideIcons.chevronRight, size: 16, color: KgColors.t4),
          onTap: () async {
            t.go();
          },
        ),
    ]);
  }

  // ---------- 五模块雷达 ----------

  Widget _radarCard() {
    final data = axes;
    final has = data.any((a) => a.pct > 0);
    final weak = data.where((a) => a.pct > 0).toList()
      ..sort((a, b) => a.pct.compareTo(b.pct));
    return _section('五模块能力雷达', LucideIcons.radar, [
      if (!has)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Center(
              child: Text('刷几组题后生成你的能力雷达',
                  style: TextStyle(color: KgColors.t3, fontSize: 13))),
        )
      else ...[
        Center(
          child: SizedBox(
            width: 220,
            height: 200,
            child: CustomPaint(
              painter: _RadarPainter(
                values: [for (final a in data) a.pct / 100],
                labels: [for (final a in data) '${a.name} ${a.pct}%'],
                color: KgColors.brand,
              ),
            ),
          ),
        ),
        if (weak.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text('最薄弱：${weak.first.name}（${weak.first.pct}%）',
                    style: const TextStyle(fontSize: 12, color: KgColors.t3)),
              ),
              TextButton(
                onPressed: () => context.push('/practice?module=${weak.first.key}'),
                child: const Text('去突破', style: TextStyle(fontSize: 13)),
              ),
            ],
          ),
        ],
      ],
    ]);
  }

  // ---------- 错题模块分布 ----------

  Widget _mistakeDistCard() {
    if (byModule.isEmpty) return const SizedBox.shrink();
    final total = byModule.fold<int>(0, (s, m) => s + ((m['n'] ?? 0) as num).toInt());
    final shown = modOpen ? byModule : byModule.take(3).toList();
    return _section('错题模块分布', LucideIcons.pieChart, [
      for (final m in shown)
        _distBar((m['module'] ?? '').toString(), ((m['n'] ?? 0) as num).toInt(), total),
      if (byModule.length > 3)
        Center(
          child: TextButton(
            onPressed: () => setState(() => modOpen = !modOpen),
            child: Text(modOpen ? '收起' : '展开全部 ${byModule.length} 项',
                style: const TextStyle(fontSize: 12)),
          ),
        ),
    ]);
  }

  Widget _distBar(String name, int n, int total) {
    final pct = total > 0 ? n / total : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(name, style: const TextStyle(fontSize: 13)),
              const Spacer(),
              Text('$n 题 · ${(pct * 100).round()}%',
                  style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            ],
          ),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: KgColors.fill,
              valueColor: const AlwaysStoppedAnimation(KgColors.brand),
            ),
          ),
        ],
      ),
    );
  }

  // ---------- 高频错题型 ----------

  Widget _topTypesCard() {
    if (byType.isEmpty) return const SizedBox.shrink();
    final shown = typeOpen ? byType.take(10).toList() : byType.take(5).toList();
    return _section('高频错题型 TOP10', LucideIcons.flame, [
      for (var i = 0; i < shown.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              SizedBox(
                width: 22,
                child: Text('${i + 1}',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: i < 3 ? KgColors.error : KgColors.t4)),
              ),
              Expanded(
                child: Text(_typeName((shown[i]['question_type'] ?? '').toString()),
                    style: const TextStyle(fontSize: 13),
                    overflow: TextOverflow.ellipsis),
              ),
              Text('${shown[i]['n']} 次', style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            ],
          ),
        ),
      if (byType.length > 5)
        Center(
          child: TextButton(
            onPressed: () => setState(() => typeOpen = !typeOpen),
            child: Text(typeOpen ? '收起' : '展开 TOP10', style: const TextStyle(fontSize: 12)),
          ),
        ),
    ]);
  }

  String _typeName(String t) {
    if (t.isEmpty) return '未分类';
    return t.replaceFirst(
        RegExp('^(数量关系|数学运算|资料分析|言语理解(与表达)?|判断推理|逻辑判断|常识判断|常识)[-－·：:]'), '');
  }

  // ---------- 错因分布 ----------

  Widget _reasonCard() {
    if (byReason.isEmpty) return const SizedBox.shrink();
    final total = byReason.fold<int>(0, (s, r) => s + ((r['n'] ?? 0) as num).toInt());
    return _section('错因分布', LucideIcons.searchX, [
      for (final r in byReason)
        _distBar((r['error_reason'] ?? '未标注').toString(),
            ((r['n'] ?? 0) as num).toInt(), total),
    ]);
  }

  // ---------- 近 7 日正确率 ----------

  Widget _weekTrendCard() {
    final days = _days;
    final now = DateTime.now();
    final rows = <({String label, int done, int pct})>[];
    for (var i = 6; i >= 0; i--) {
      final d = now.subtract(Duration(days: i));
      final key =
          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
      final v = days[key];
      final done = v?['n'] ?? 0;
      rows.add((
        label: i == 0 ? '今天' : '${d.month}/${d.day}',
        done: done,
        pct: done > 0 ? ((v?['correct'] ?? 0) * 100 / done).round() : 0,
      ));
    }
    if (!rows.any((r) => r.done > 0)) return const SizedBox.shrink();
    return _section('近 7 日正确率', LucideIcons.activity, [
      SizedBox(
        height: 110,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final r in rows) ...[
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(r.done > 0 ? '${r.pct}%' : '-',
                        style: const TextStyle(fontSize: 10, color: KgColors.t3)),
                    const SizedBox(height: 4),
                    Container(
                      height: 70 * (r.done > 0 ? r.pct / 100 : 0) + 3,
                      decoration: BoxDecoration(
                        gradient: kBrandGradient,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(r.label, style: const TextStyle(fontSize: 9, color: KgColors.t4)),
                  ],
                ),
              ),
              const SizedBox(width: 6),
            ],
          ],
        ),
      ),
    ]);
  }

  // ---------- 成长轨迹（周，分模块） ----------

  Widget _growthCard() {
    final weeks = (growth?['weeks'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final seen = <String>{};
    for (final w in weeks) {
      seen.addAll(((w['modules'] as Map?) ?? {}).keys.map((k) => k.toString()));
    }
    final rows = weeks.length > 8 ? weeks.sublist(weeks.length - 8) : weeks;
    final data = rows.map((w) {
      final src = gwMod.isEmpty
          ? w
          : Map<String, dynamic>.from(
              ((w['modules'] as Map?) ?? {})[gwMod] as Map? ?? {'n': 0, 'c': 0});
      final n = ((src['n'] ?? 0) as num).toInt();
      final c = ((src['c'] ?? 0) as num).toInt();
      return (
        week: (w['week'] ?? '').toString(),
        n: n,
        pct: n > 0 ? (c * 100 / n).round() : 0,
      );
    }).toList();
    final delta = data.length >= 2 ? data[data.length - 1].pct - data[data.length - 2].pct : null;
    return _section('成长轨迹', LucideIcons.trendingUp, [
      if (seen.isNotEmpty)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _gwChip('', '整体'),
              for (final (key, name) in _mods)
                if (seen.contains(key)) _gwChip(key, name),
            ],
          ),
        ),
      const SizedBox(height: 12),
      if (data.isEmpty)
        const Center(
            child: Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Text('还没有作答数据，去刷一组题吧',
              style: TextStyle(color: KgColors.t3, fontSize: 13)),
        ))
      else ...[
        SizedBox(
          height: 110,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final d in data) ...[
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(d.n > 0 ? '${d.pct}%' : '-',
                          style: const TextStyle(fontSize: 10, color: KgColors.t3)),
                      const SizedBox(height: 4),
                      Container(
                        height: 70 * (d.n > 0 ? d.pct / 100 : 0) + 3,
                        decoration: BoxDecoration(
                          gradient: kBrandGradient,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(d.week.split('-').last,
                          style: const TextStyle(fontSize: 9, color: KgColors.t4)),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
        ),
        if (delta != null) ...[
          const SizedBox(height: 6),
          Text(
            delta >= 0 ? '周环比 +$delta%' : '周环比 $delta%',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: delta >= 0 ? KgColors.success : KgColors.error),
          ),
        ],
      ],
    ]);
  }

  Widget _gwChip(String key, String name) {
    final on = gwMod == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(name, style: const TextStyle(fontSize: 12)),
        selected: on,
        onSelected: (_) => setState(() => gwMod = key),
        visualDensity: VisualDensity.compact,
      ),
    );
  }

  // ---------- 申论学习统计 ----------

  Widget _shenlunCard() {
    final s = slStats;
    if (s == null || ((s['total'] ?? 0) as num) == 0) return const SizedBox.shrink();
    final byType = (s['by_type'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final issues = (s['issues'] as List<dynamic>? ?? []);
    return _section('申论学习统计', LucideIcons.penTool, [
      Row(
        children: [
          Text('批改 ${s['total']} 次', style: const TextStyle(fontSize: 13)),
          const Spacer(),
          TextButton(
            onPressed: () => context.push('/shenlun?tab=r'),
            child: const Text('作答记录 ›', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
      for (final t in byType.take(5))
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: [
              Expanded(
                child: Text((t['qtype'] ?? '').toString(),
                    style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
              ),
              Text('${t['n']} 次',
                  style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            ],
          ),
        ),
      if (issues.isNotEmpty) ...[
        const SizedBox(height: 4),
        const Text('近期问题点', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final it in issues.take(8))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: KgColors.errorBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                    (it is Map ? (it['text'] ?? '') : it).toString(),
                    style: const TextStyle(fontSize: 11, color: KgColors.error)),
              ),
          ],
        ),
      ],
    ]);
  }

  // ---------- 练习记录 ----------

  Widget _historyCard() {
    if (history.isEmpty) return const SizedBox.shrink();
    final shown = showAllHist ? history.take(30).toList() : history.take(5).toList();
    return _section('练习记录', LucideIcons.history, [
      for (final h0 in shown)
        Builder(builder: (context) {
          final h = Map<String, dynamic>.from(h0 as Map);
          final n = ((h['n'] ?? 0) as num).toInt();
          final c = ((h['correct'] ?? 0) as num).toInt();
          final pct = n > 0 ? (c * 100 / n).round() : 0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                      '${moduleName((h['module'] ?? '').toString().isEmpty ? null : h['module'].toString())} · $c/$n',
                      style: const TextStyle(fontSize: 13)),
                ),
                Text('$pct%',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: pct >= 60 ? KgColors.success : KgColors.error)),
                const SizedBox(width: 10),
                Text(_fmtHist(((h['t'] ?? 0) as num).toInt()),
                    style: const TextStyle(fontSize: 11, color: KgColors.t4)),
              ],
            ),
          );
        }),
      if (history.length > 5)
        Center(
          child: TextButton(
            onPressed: () => setState(() => showAllHist = !showAllHist),
            child: Text(showAllHist ? '收起' : '查看更多', style: const TextStyle(fontSize: 12)),
          ),
        ),
    ]);
  }

  String _fmtHist(int t) {
    if (t <= 0) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(t);
    String p(int x) => x < 10 ? '0$x' : '$x';
    return '${d.month}/${d.day} ${p(d.hour)}:${p(d.minute)}';
  }

  // ---------- 做题速度趋势 ----------

  Widget _speedCard() {
    final data = history
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((h) => ((h['n'] ?? 0) as num) > 0 && ((h['secs'] ?? 0) as num) > 0)
        .take(14)
        .toList()
        .reversed
        .map((h) => (((h['secs'] as num) / (h['n'] as num)).round()))
        .toList();
    if (data.isEmpty) return const SizedBox.shrink();
    final avg = (data.reduce((a, b) => a + b) / data.length).round();
    final maxV = data.reduce(math.max);
    return _section('做题速度趋势', LucideIcons.timer, [
      Text('近 ${data.length} 组 · 平均每题 $avg 秒',
          style: const TextStyle(fontSize: 12, color: KgColors.t3)),
      const SizedBox(height: 10),
      SizedBox(
        height: 90,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            for (final v in data) ...[
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text('$v', style: const TextStyle(fontSize: 9, color: KgColors.t4)),
                    const SizedBox(height: 3),
                    Container(
                      height: 60 * (maxV > 0 ? v / maxV : 0) + 3,
                      decoration: BoxDecoration(
                        color: v > avg ? KgColors.warning : KgColors.brand,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
            ],
          ],
        ),
      ),
    ]);
  }

  // ---------- 考点地图 ----------

  Widget _kpMapCard() {
    final groups = <String, List<({String sub, int done, int pct})>>{};
    subProgress.forEach((sub, v) {
      final m = Map<String, dynamic>.from(v as Map);
      final n = ((m['n'] ?? 0) as num).toInt();
      if (n < 3) return;
      final c = ((m['c'] ?? 0) as num).toInt();
      groups.putIfAbsent('all', () => []).add((sub: sub, done: n, pct: (c * 100 / n).round()));
    });
    final subs = groups['all'] ?? [];
    if (subs.isEmpty) return const SizedBox.shrink();
    subs.sort((a, b) => a.pct.compareTo(b.pct));
    return _section('考点地图', LucideIcons.map, [
      const Text('各题型掌握度（≥3 题），点弱项直接去练',
          style: TextStyle(fontSize: 11, color: KgColors.t4)),
      const SizedBox(height: 10),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final s in subs)
            InkWell(
              onTap: () => context.push('/practice'),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: s.pct < 60
                      ? KgColors.errorBg
                      : s.pct <= 80
                          ? KgColors.warningBg
                          : KgColors.successBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('${s.sub} ${s.pct}%',
                    style: TextStyle(
                        fontSize: 12,
                        color: s.pct < 60
                            ? KgColors.error
                            : s.pct <= 80
                                ? KgColors.warning
                                : KgColors.success)),
              ),
            ),
        ],
      ),
    ]);
  }

  // ---------- 报考画像 ----------

  Widget _profileCard() {
    final pf = profile;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () async {
          final saved = await showPlanSetupSheet(context, profile: pf);
          if (saved != null) setState(() => profile = saved);
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(LucideIcons.target, color: KgColors.brand),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('报考画像', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(
                      pf == null
                          ? '未设置：填写考试类型/日期/目标分，解锁每日学习计划'
                          : '${pf['exam_type'] ?? ''}${(pf['target_region'] ?? '').toString().isNotEmpty ? ' · ${pf['target_region']}' : ''} · ${pf['exam_date'] ?? ''} · 目标 ${pf['target_score'] ?? ''}+ · 每天 ${pf['daily_minutes'] ?? ''} 分钟',
                      style: const TextStyle(fontSize: 12, color: KgColors.t3),
                    ),
                  ],
                ),
              ),
              const Icon(LucideIcons.chevronRight, size: 18, color: KgColors.t4),
            ],
          ),
        ),
      ),
    );
  }

  // ---------- AI 学习教练 ----------

  Widget _coachCard() {
    return _section('AI 学习教练', LucideIcons.sparkles, [
      if (coachAdvice.isNotEmpty) ...[
        Text(_stripMd(coachAdvice), style: const TextStyle(fontSize: 13, height: 1.7)),
        const SizedBox(height: 10),
      ] else
        const Padding(
          padding: EdgeInsets.only(bottom: 10),
          child: Text('根据你的做题数据生成个性化学习建议（约 10 秒）',
              style: TextStyle(fontSize: 12, color: KgColors.t3)),
        ),
      FilledButton.tonal(
        onPressed: coachLoading ? null : _getCoach,
        child: Text(coachLoading ? '生成中…' : (coachAdvice.isEmpty ? '生成学习建议' : '重新生成')),
      ),
    ]);
  }

  String _stripMd(String s) {
    return s
        .replaceAll(RegExp(r'^#+\s*', multiLine: true), '')
        .replaceAll(RegExp(r'\*\*(.+?)\*\*'), r'$1')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .trim();
  }

  Future<void> _getCoach() async {
    if (Store.instance.accessCode.isEmpty) {
      final ok = await _promptAccessCode();
      if (!ok) return;
    }
    setState(() => coachLoading = true);
    try {
      final total = Map<String, dynamic>.from(growth?['total'] as Map? ?? {});
      final n = ((total['n'] ?? 0) as num).toInt();
      final c = ((total['c'] ?? 0) as num).toInt();
      final byMod = <String, dynamic>{};
      _byModuleAcc.forEach((k, v) {
        byMod[moduleName(k)] = {
          '已做': v[0],
          '正确率': v[0] > 0 ? '${(v[1] * 100 / v[0]).round()}%' : '无',
        };
      });
      final statsData = {
        '累计刷题': n,
        '总正确率': n > 0 ? '${(c * 100 / n).round()}%' : '0%',
        '连续打卡天数': streak,
        '各模块': byMod,
        '错题模块分布': byModule.map((m) => '${m['module']}×${m['n']}').join('、'),
        '错因分布': byReason.map((r) => '${r['error_reason']}×${r['n']}').join('、'),
        '高频错题型TOP5':
            byType.take(5).map((t) => '${_typeName((t['question_type'] ?? '').toString())}×${t['n']}').join('、'),
        '近10次练习': history
            .take(10)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .map((h) =>
                '${moduleName((h['module'] ?? '').toString().isEmpty ? null : h['module'].toString())} ${h['correct']}/${h['n']}')
            .toList(),
      };
      final advice = await Api.coach(statsData);
      Store.instance.coachAdvice = advice;
      setState(() => coachAdvice = advice);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('生成失败：${Api.errMsg(e)}')));
      }
    }
    if (mounted) setState(() => coachLoading = false);
  }

  Future<bool> _promptAccessCode() async {
    final ctrl = TextEditingController(text: Store.instance.accessCode);
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('输入访问码'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'AI 功能需要访问码'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim()),
              child: const Text('确定')),
        ],
      ),
    );
    if (code == null || code.isEmpty) return false;
    Store.instance.accessCode = code;
    return true;
  }

  // ---------- 成就勋章 ----------

  Widget _medalsCard() {
    final total = Map<String, dynamic>.from(growth?['total'] as Map? ?? {});
    final done = ((total['n'] ?? 0) as num).toInt();
    final best = Store.instance.bestStreak;
    final medals = <({IconData icon, String name, int cur, int target, String unit})>[
      (icon: LucideIcons.sprout, name: '初战告捷', cur: done, target: 10, unit: '题'),
      (icon: LucideIcons.dumbbell, name: '小有所成', cur: done, target: 100, unit: '题'),
      (icon: LucideIcons.trophy, name: '刷题大师', cur: done, target: 500, unit: '题'),
      (icon: LucideIcons.flame, name: '三日不辍', cur: streak, target: 3, unit: '天'),
      (icon: LucideIcons.zap, name: '七日连环', cur: streak, target: 7, unit: '天'),
      (icon: LucideIcons.target, name: '十连对', cur: best, target: 10, unit: '连对'),
      (icon: LucideIcons.swords, name: '斩题十道', cur: masteredCount, target: 10, unit: '道'),
      (icon: LucideIcons.crown, name: '百题斩', cur: masteredCount, target: 100, unit: '道'),
    ];
    return _section('成就勋章', LucideIcons.medal, [
      GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        childAspectRatio: .78,
        children: [
          for (final m in medals)
            Column(
              children: [
                Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: CircularProgressIndicator(
                        value: m.cur >= m.target ? 1 : m.cur / m.target,
                        strokeWidth: 3,
                        backgroundColor: KgColors.fill,
                        valueColor: AlwaysStoppedAnimation(
                            m.cur >= m.target ? KgColors.warning : KgColors.t4),
                      ),
                    ),
                    Icon(m.icon,
                        size: 18,
                        color: m.cur >= m.target ? KgColors.warning : KgColors.t4),
                  ],
                ),
                const SizedBox(height: 6),
                Text(m.name,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: m.cur >= m.target ? KgColors.t1 : KgColors.t3)),
                Text('${math.min(m.cur, m.target)}/${m.target} ${m.unit}',
                    style: const TextStyle(fontSize: 9, color: KgColors.t4)),
              ],
            ),
        ],
      ),
    ]);
  }

  // ---------- 数据备份与迁移 ----------

  Widget _backupCard() {
    return _section('数据备份与迁移', LucideIcons.uploadCloud, [
      const Text('做题记录已随账号/匿名 ID 云端同步；此处备份本机偏好设置（目标/字号/练习记录等）',
          style: TextStyle(fontSize: 11, color: KgColors.t4)),
      const SizedBox(height: 10),
      if (backupCode.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            children: [
              Text('恢复码：$backupCode',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              InkWell(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: backupCode));
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('已复制恢复码')));
                },
                child: const Icon(LucideIcons.copy, size: 15, color: KgColors.brand),
              ),
            ],
          ),
        ),
      Row(
        children: [
          Expanded(
            child: FilledButton.tonal(
              onPressed: bkLoading ? null : _doBackup,
              child: Text(bkLoading ? '备份中…' : '备份到云端'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton(
              onPressed: _doRestore,
              child: const Text('用恢复码恢复'),
            ),
          ),
        ],
      ),
    ]);
  }

  Future<void> _doBackup() async {
    setState(() => bkLoading = true);
    try {
      final code = await Api.backupSave(Store.instance.backupData(),
          code: backupCode.isEmpty ? null : backupCode);
      Store.instance.backupCode = code;
      setState(() => backupCode = code);
      if (mounted) {
        await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('备份成功'),
            content: Text('恢复码：$code\n请记下或截图保存，在新设备输入即可恢复数据。'),
            actions: [
              FilledButton(onPressed: () => Navigator.pop(c), child: const Text('好的')),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('备份失败：${Api.errMsg(e)}')));
      }
    }
    if (mounted) setState(() => bkLoading = false);
  }

  Future<void> _doRestore() async {
    final ctrl = TextEditingController();
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('输入恢复码'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(hintText: '如：AB3D5F7H'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim().toUpperCase()),
              child: const Text('恢复')),
        ],
      ),
    );
    if (code == null || code.isEmpty) return;
    try {
      final data = await Api.backupGet(code);
      Store.instance.restoreBackup(data);
      Store.instance.backupCode = code;
      setState(() {
        backupCode = code;
        coachAdvice = Store.instance.coachAdvice;
        history = Store.instance.practiceHistory;
      });
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('恢复成功！')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('恢复失败：${Api.errMsg(e)}')));
      }
    }
  }

  // ---------- 通用卡片壳 ----------

  Widget _section(String title, IconData icon, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 16, color: KgColors.brand),
                const SizedBox(width: 6),
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// 五边形雷达图。
class _RadarPainter extends CustomPainter {
  _RadarPainter({required this.values, required this.labels, required this.color});

  final List<double> values; // 0-1，五项
  final List<String> labels;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = math.min(size.width, size.height) / 2 - 28;
    Offset pt(int i, double ratio) {
      final ang = math.pi * 2 * i / 5 - math.pi / 2;
      return center + Offset(math.cos(ang), math.sin(ang)) * r * ratio;
    }

    final grid = Paint()
      ..color = color.withValues(alpha: .18)
      ..style = PaintingStyle.stroke;
    for (final ratio in const [.25, .5, .75, 1.0]) {
      final path = Path();
      for (var i = 0; i < 5; i++) {
        final p = pt(i, ratio);
        i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
      }
      path.close();
      canvas.drawPath(path, grid);
    }
    for (var i = 0; i < 5; i++) {
      canvas.drawLine(center, pt(i, 1), grid);
    }

    final poly = Path();
    for (var i = 0; i < 5; i++) {
      final p = pt(i, values[i].clamp(0.02, 1.0));
      i == 0 ? poly.moveTo(p.dx, p.dy) : poly.lineTo(p.dx, p.dy);
    }
    poly.close();
    canvas.drawPath(poly, Paint()..color = color.withValues(alpha: .25));
    canvas.drawPath(
        poly,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6);

    for (var i = 0; i < 5; i++) {
      final tp = TextPainter(
        text: TextSpan(
            text: labels[i],
            style: const TextStyle(fontSize: 10, color: KgColors.t3)),
        textDirection: TextDirection.ltr,
      )..layout();
      final p = pt(i, 1.18);
      tp.paint(canvas, p - Offset(tp.width / 2, tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _RadarPainter old) =>
      old.values != values || old.labels != labels;
}
