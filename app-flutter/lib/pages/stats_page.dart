import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 统计：KPI 卡 + 近 8 周正确率曲线 + 模块正确率 +（能力预测分占位）
class StatsPage extends StatefulWidget {
  const StatsPage({super.key});

  @override
  State<StatsPage> createState() => _StatsPageState();
}

class _StatsPageState extends State<StatsPage> {
  Map<String, dynamic>? growth;
  Map<String, dynamic>? plan;
  int dueCount = 0;
  int mistakeCount = 0;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final r = await Future.wait([
        Api.growth(),
        Api.dailyPlan().catchError((_) => <String, dynamic>{}),
        Api.reviewDue().catchError((_) => <String, dynamic>{'total': 0}),
        Api.mistakes().catchError((_) => const <dynamic>[]),
      ]);
      setState(() {
        growth = r[0] as Map<String, dynamic>;
        plan = r[1] as Map<String, dynamic>;
        dueCount = ((r[2] as Map<String, dynamic>)['total'] ?? 0) as int;
        mistakeCount = (r[3] as List<dynamic>).length;
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
    return Scaffold(
      appBar: AppBar(title: const Text('学习统计')),
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
                      _kpiRow(),
                      const SizedBox(height: 16),
                      _trendCard(),
                      const SizedBox(height: 16),
                      _moduleCard(),
                      const SizedBox(height: 16),
                      _scoreCard(),
                    ],
                  ),
                ),
    );
  }

  Widget _kpiRow() {
    final total = Map<String, dynamic>.from(growth?['total'] as Map? ?? {});
    final n = (total['n'] ?? 0) as int;
    final c = (total['c'] ?? 0) as int;
    final acc = n > 0 ? (c * 100 / n).round() : 0;
    return Row(
      children: [
        _kpi('累计做题', '$n', LucideIcons.edit3),
        const SizedBox(width: 10),
        _kpi('总正确率', '$acc%', LucideIcons.target),
        const SizedBox(width: 10),
        _kpi('错题待复习', '$dueCount', LucideIcons.alarmClock),
        const SizedBox(width: 10),
        _kpi('错题总数', '$mistakeCount', LucideIcons.bookOpen),
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
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(label, style: const TextStyle(fontSize: 10, color: KgColors.t3)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _trendCard() {
    final weeks = (growth?['weeks'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('近 8 周正确率', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            if (weeks.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Center(
                    child: Text('还没有作答数据，去刷一组题吧',
                        style: TextStyle(color: KgColors.t3, fontSize: 13))),
              )
            else
              SizedBox(
                height: 120,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    for (final w in weeks) ...[
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text(
                              '${((w['n'] ?? 0) as int) > 0 ? ((w['c'] as int) * 100 ~/ (w['n'] as int)) : 0}%',
                              style: const TextStyle(fontSize: 10, color: KgColors.t3),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              height: 80 *
                                  (((w['n'] ?? 0) as int) > 0
                                      ? ((w['c'] as int) / (w['n'] as int))
                                      : 0.0) +
                                  4,
                              decoration: BoxDecoration(
                                gradient: kBrandGradient,
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              (w['week'] ?? '').toString().split('-').last,
                              style: const TextStyle(fontSize: 9, color: KgColors.t4),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _moduleCard() {
    final weeks = (growth?['weeks'] as List<dynamic>? ?? []);
    // 汇总各模块累计正确率
    final byModule = <String, List<int>>{};
    for (final w in weeks) {
      final mods = (w as Map)['modules'] as Map? ?? {};
      mods.forEach((k, v) {
        final key = k.toString();
        final cur = byModule.putIfAbsent(key, () => [0, 0]);
        cur[0] += ((v as Map)['n'] ?? 0) as int;
        cur[1] += (v['c'] ?? 0) as int;
      });
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('模块正确率', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            if (byModule.isEmpty)
              const Center(
                  child: Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: Text('暂无模块数据', style: TextStyle(color: KgColors.t3, fontSize: 13)),
              ))
            else
              for (final e in byModule.entries) _moduleBar(e.key, e.value[0], e.value[1]),
          ],
        ),
      ),
    );
  }

  Widget _moduleBar(String module, int n, int c) {
    final acc = n > 0 ? c / n : 0.0;
    final pct = (acc * 100).round();
    final warn = pct < 60;
    final color = warn ? KgColors.error : (KgColors.moduleColors[module] ?? KgColors.brand);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(moduleName(module), style: const TextStyle(fontSize: 13)),
              const Spacer(),
              Text('$pct% · $n 题',
                  style: TextStyle(
                      fontSize: 12,
                      color: warn ? KgColors.error : KgColors.t3,
                      fontWeight: warn ? FontWeight.w700 : FontWeight.w400)),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: acc,
              minHeight: 6,
              backgroundColor: KgColors.fill,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scoreCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(LucideIcons.gauge, color: KgColors.t4),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('能力预测分', style: TextStyle(fontWeight: FontWeight.w700)),
                  SizedBox(height: 4),
                  Text('后续批次上线：按模块正确率与做题速度预测行测分数',
                      style: TextStyle(fontSize: 12, color: KgColors.t3)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
