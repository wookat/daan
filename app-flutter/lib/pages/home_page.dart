import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/plan_setup_sheet.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  Map<String, dynamic>? profile;
  Map<String, dynamic>? plan;
  bool planLoaded = false;
  bool guideHidden = Store.instance.planGuideHide;

  /// module key -> [做题数, 答对数]，用于专项练习行内的刷题量/正确率
  Map<String, List<int>> moduleStats = {};

  @override
  void initState() {
    super.initState();
    _loadPlan();
    _loadModuleStats();
  }

  Future<void> _loadPlan() async {
    try {
      final pf = await Api.profile();
      if (!mounted) return;
      setState(() => profile = pf);
      if (pf != null) {
        final p = await Api.planToday();
        if (mounted) setState(() => plan = p);
      }
    } catch (_) {/* 计划加载失败不阻断首页 */}
    if (mounted) setState(() => planLoaded = true);
  }

  Future<void> _loadModuleStats() async {
    try {
      final g = await Api.growth();
      final acc = <String, List<int>>{};
      for (final w in (g['weeks'] as List<dynamic>? ?? [])) {
        final mods = (w as Map)['modules'] as Map? ?? {};
        mods.forEach((k, v) {
          final cur = acc.putIfAbsent(k.toString(), () => [0, 0]);
          cur[0] += ((v as Map)['n'] ?? 0) as int;
          cur[1] += (v['c'] ?? 0) as int;
        });
      }
      if (mounted) setState(() => moduleStats = acc);
    } catch (_) {/* 统计拉取失败时模块行退化为无进度展示 */}
  }

  Future<void> _openSetup() async {
    final pf = await showPlanSetupSheet(context, profile: profile);
    if (pf != null) {
      setState(() => profile = pf);
      _loadPlan();
    }
  }

  @override
  Widget build(BuildContext context) {
    final goal = ref.watch(dailyGoalProvider);
    final today = ref.watch(todayCountProvider);
    final pct = (today / goal).clamp(0.0, 1.0);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // 搜索入口
            InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: () => context.push('/search'),
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Theme.of(context).cardTheme.color ?? Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: context.kg.border),
                ),
                child: Row(
                  children: [
                    Icon(LucideIcons.search, size: 16, color: context.kg.t4),
                    const SizedBox(width: 8),
                    Text('题号 / 题干关键词 / 考点名',
                        style: TextStyle(fontSize: 13, color: context.kg.t4)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            // 今日目标 Hero
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: kBrandGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('今日目标',
                      style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(
                    '今日已练 $today/$goal 题${today >= goal ? ' · 已达成' : ''}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 6,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: KgColors.brandDeep,
                      ),
                      onPressed: () => context.push('/practice'),
                      child: Text(today >= goal ? '再练一组' : '继续目标'),
                    ),
                  ),
                ],
              ),
            ),
            // 学习计划：引导卡 / 今日计划卡
            if (planLoaded && profile == null && !guideHidden) ...[
              const SizedBox(height: 14),
              _guideCard(),
            ],
            if (profile != null && plan != null) ...[
              const SizedBox(height: 14),
              _planCard(),
            ],
            const SizedBox(height: 20),
            const _SectionTitle('专项练习'),
            const SizedBox(height: 10),
            Card(
              child: Column(
                children: [
                  for (final e in kModuleNames.entries) _moduleRow(e.key, e.value),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const _SectionTitle('更多练习'),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                _entry(context, LucideIcons.timer, '模考', '/exam/list'),
                _entry(context, LucideIcons.repeat, '错题重练', '/practice?mode=redo'),
                _entry(context, LucideIcons.penTool, '申论', '/shenlun'),
                _entry(context, LucideIcons.newspaper, '时政每日练', '/shizheng'),
                _entry(context, LucideIcons.camera, '拍题讲解', '/ask'),
                _entry(context, LucideIcons.star, '收藏笔记', '/favorites'),
                _entry(context, LucideIcons.flame, '打卡海报', '/poster'),
                _entry(context, LucideIcons.fileDown, 'PDF导出', '/book'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// 专项练习行：图标 + 名称 + 刷题量/正确率 + 进度条 + 继续做题。
  /// 对标华图「刷题量: 2352/2868  正确率: 82%」，让用户在首页就能判断该练哪一块。
  Widget _moduleRow(String key, String label) {
    final kg = context.kg;
    final color = KgColors.moduleColors[key] ?? KgColors.brand;
    final stat = moduleStats[key];
    final done = stat?[0] ?? 0;
    final right = stat?[1] ?? 0;
    final acc = done > 0 ? (right * 100 / done).round() : null;
    return InkWell(
      onTap: () => context.push('/practice?module=$key'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_moduleIcon(key), size: 20, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    done == 0
                        ? '还没练过 · 从这里开始'
                        : '已练 $done 题 · 正确率 $acc%',
                    style: TextStyle(fontSize: 12, color: kg.t3),
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: acc == null ? 0 : acc / 100,
                      minHeight: 4,
                      backgroundColor: kg.fill,
                      valueColor: AlwaysStoppedAnimation(color),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: .10),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                done == 0 ? '开始做题' : '继续做题',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _guideCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.target, size: 18, color: KgColors.brand),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text('制定你的学习计划',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
                InkWell(
                  onTap: () {
                    Store.instance.planGuideHide = true;
                    setState(() => guideHidden = true);
                  },
                  child: Icon(LucideIcons.x, size: 16, color: context.kg.t4),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('30 秒设置考试信息，每天给你一份可执行的刷题计划',
                style: TextStyle(fontSize: 12.5, color: context.kg.t3)),
            const SizedBox(height: 12),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(42)),
              onPressed: _openSetup,
              child: const Text('开始设置（3 步）'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _planCard() {
    final p = plan!;
    final tasks = p['tasks'] as List<dynamic>? ?? [];
    final daysLeft = (p['days_left'] as num?)?.toInt();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.calendarCheck, size: 18, color: KgColors.brand),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text('今日计划',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
                if (daysLeft != null && daysLeft > 0)
                  Text('距考试 $daysLeft 天',
                      style: const TextStyle(fontSize: 12, color: KgColors.warning, fontWeight: FontWeight.w600)),
                const SizedBox(width: 8),
                InkWell(
                  onTap: _openSetup,
                  child: Icon(LucideIcons.settings2, size: 16, color: context.kg.t3),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (tasks.isEmpty)
              Text('今日暂无任务，去自由刷一组吧',
                  style: TextStyle(fontSize: 13, color: context.kg.t3))
            else
              for (final t in tasks) _taskRow(Map<String, dynamic>.from(t)),
          ],
        ),
      ),
    );
  }

  Widget _taskRow(Map<String, dynamic> t) {
    final done = t['done'] == true || t['done'] == 1;
    final module = (t['module'] ?? '').toString();
    return InkWell(
      onTap: done
          ? null
          : () => context.push(
              module.isNotEmpty ? '/practice?module=$module' : '/practice'),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(done ? LucideIcons.checkCircle2 : LucideIcons.circle,
                size: 16, color: done ? KgColors.success : context.kg.t4),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                (t['title'] ?? t['name'] ?? '').toString(),
                style: TextStyle(
                  fontSize: 13.5,
                  color: done ? context.kg.t3 : null,
                  decoration: done ? TextDecoration.lineThrough : null,
                ),
              ),
            ),
            if (!done)
              Icon(LucideIcons.chevronRight, size: 15, color: context.kg.t4),
          ],
        ),
      ),
    );
  }

  Widget _entry(BuildContext context, IconData icon, String label, String route) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push(route),
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: KgColors.brand),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  static IconData _moduleIcon(String key) => switch (key) {
        'ziliao' => LucideIcons.pieChart,
        'shuliang' => LucideIcons.calculator,
        'yanyu' => LucideIcons.languages,
        'panduan' => LucideIcons.puzzle,
        'changshi' => LucideIcons.lightbulb,
        _ => LucideIcons.pencil,
      };
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700));
}
