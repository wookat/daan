import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/export_sheet.dart';
import '../widgets/plan_setup_sheet.dart';

/// 「学习计划」入口触发信号：其它页跳回首页时自动弹出 setup（IndexedStack 常驻）。
final ValueNotifier<int> homeSetupTick = ValueNotifier(0);

/// 首页：复刻 pages/home/home.vue。
/// 搜索 + 今日目标 Hero（打卡海报/连续打卡）+ 学习计划 + 断卡提示 + 公告 +
/// 时政每日一练 + 专项练习（进度/二级题型）+ 混合刷题 + 智能弱项 +
/// 更多练习（模考/申论/错题/拍题/PK/迷你模考/真题卷）+ 练习设置。
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  Map<String, dynamic>? profile;
  Map<String, dynamic>? plan;
  Map<String, dynamic>? daily; // /api/daily_plan：主攻模块 focus + 考点级弱项 weak
  bool planLoaded = false;
  bool guideHidden = Store.instance.planGuideHide;
  List<Map<String, dynamic>> counts = [];
  Map<String, dynamic>? announce;
  Map<String, dynamic> moduleStats = Store.instance.moduleStats;

  @override
  void initState() {
    super.initState();
    _loadPlan();
    _loadCounts();
    _loadAnnounce();
    homeSetupTick.addListener(_onSetupTick);
  }

  @override
  void dispose() {
    homeSetupTick.removeListener(_onSetupTick);
    super.dispose();
  }

  void _onSetupTick() {
    if (mounted) _openSetup();
  }

  /// 连续打卡天数（同 home.vue dailyStreak：从今天/昨天起向前数 dailyPlan.days）。
  int get dailyStreak {
    final days = Store.instance.dailyPlanDays['days'] as Map;
    var n = 0;
    var d = DateTime.now();
    String key(DateTime x) =>
        '${x.year}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
    if (days[key(d)] != true) d = d.subtract(const Duration(days: 1));
    while (days[key(d)] == true) {
      n++;
      d = d.subtract(const Duration(days: 1));
    }
    return n;
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
      final d = await Api.dailyPlan();
      if (mounted) setState(() => daily = d);
    } catch (_) {/* 计划加载失败不阻断首页 */}
    if (mounted) setState(() => planLoaded = true);
  }

  Future<void> _loadCounts() async {
    try {
      final d = await Api.questions(limit: 1, adaptive: false);
      if (mounted) {
        setState(() => counts = (d['counts'] as List<dynamic>? ?? [])
            .map((e) => Map<String, dynamic>.from(e))
            .toList());
      }
    } catch (_) {/* 非关键路径 */}
  }

  Future<void> _loadAnnounce() async {
    try {
      final item = await Api.announcement();
      if (item != null &&
          Store.instance.annDismissed != '${item['id']}' &&
          mounted) {
        setState(() => announce = item);
      }
    } catch (_) {/* 非关键路径 */}
  }

  Future<void> _openSetup() async {
    final pf = await showPlanSetupSheet(context, profile: profile);
    if (pf != null) {
      setState(() => profile = pf);
      _loadPlan();
    }
  }

  // ---------- 本地统计派生 ----------

  Map<String, dynamic> _modStat(String m) =>
      Map<String, dynamic>.from(moduleStats[m] as Map? ?? {});

  String? get weakModule {
    String? worst;
    var worstAcc = 1.0;
    moduleStats.forEach((m, v) {
      final s = Map<String, dynamic>.from(v as Map);
      final done = ((s['done'] ?? 0) as num).toInt();
      if (done < 5) return;
      final acc = ((s['correct'] ?? 0) as num).toInt() / done;
      if (acc < 0.8 && acc < worstAcc) {
        worstAcc = acc;
        worst = m;
      }
    });
    return worst;
  }

  /// 断卡风险：昨天未练/未达标且今天还没达标时提醒（复刻 streakRisk）。
  ({String title, String sub})? get streakRisk {
    final goal = Store.instance.dailyGoal;
    if (Store.instance.todayCount >= goal) return null;
    final now = DateTime.now();
    final yN = Store.instance.dayCount(now.subtract(const Duration(days: 1)));
    if (yN == 0) {
      if (Store.instance.dayCount(now.subtract(const Duration(days: 2))) == 0) {
        return null;
      }
      return (
        title: '昨天没打卡，连续记录中断了',
        sub: '今天练 $goal 题，重新出发不掉队'
      );
    }
    if (yN < goal) {
      return (
        title: '昨天只练了 $yN/$goal 题，未达标',
        sub: '今天补上进度，守住你的连续打卡'
      );
    }
    return null;
  }

  bool get szTodayDone {
    final days = Map<String, dynamic>.from(
        Store.instance.szDaily['days'] as Map? ?? {});
    return days[DateTime.now().toIso8601String().substring(0, 10)] != null;
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
                    Text('搜题目 / 考点 / 试卷，支持题号',
                        style: TextStyle(fontSize: 13, color: context.kg.t4)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            _hero(today, goal, pct),
            if (streakRisk != null) ...[
              const SizedBox(height: 14),
              _riskCard(streakRisk!),
            ],
            // 学习计划：引导卡 / 今日计划卡
            if (planLoaded && profile == null && !guideHidden) ...[
              const SizedBox(height: 14),
              _guideCard(),
            ],
            if (profile != null && plan != null) ...[
              const SizedBox(height: 14),
              _planCard(),
            ],
            if (announce != null) ...[
              const SizedBox(height: 14),
              _announceCard(),
            ],
            const SizedBox(height: 14),
            _szCard(),
            const SizedBox(height: 20),
            Row(
              children: [
                const _SectionTitle('专项练习'),
                const Spacer(),
                InkWell(
                  onTap: _openSettings,
                  child: const Text('练习设置 ›',
                      style: TextStyle(fontSize: 13, color: KgColors.brand)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Card(
              child: Column(
                children: [
                  for (final e in kModuleNames.entries) _moduleRow(e.key, e.value),
                  // 混合刷题
                  ListTile(
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: KgColors.brand.withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(LucideIcons.shuffle,
                          size: 20, color: KgColors.brand),
                    ),
                    title: const Text('混合刷题',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    subtitle: Text('全部模块随机 · 每组 ${Store.instance.groupSize} 题',
                        style: TextStyle(fontSize: 12, color: context.kg.t3)),
                    trailing: Icon(LucideIcons.chevronRight,
                        size: 18, color: context.kg.t4),
                    onTap: () => context.push('/practice'),
                  ),
                ],
              ),
            ),
            if (weakModule != null) ...[
              const SizedBox(height: 10),
              _smartCard(weakModule!),
            ],
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
                _entry(context, LucideIcons.fileText, '全真模考', '/exam/list'),
                _entry(context, LucideIcons.penTool, '申论专区', '/shenlun'),
                _entry(context, LucideIcons.rotateCcw, '错题重练', '/practice?mode=redo'),
                _entry(context, LucideIcons.camera, '拍题讲解', '/ask'),
                _entry(context, LucideIcons.swords, '答题 PK', '/pk'),
                _entry(context, LucideIcons.zap, '迷你模考', '/exam/run?mini=1'),
                _paperEntry(context),
                _entry(context, LucideIcons.star, '收藏笔记', '/favorites'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero(int today, int goal, double pct) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: kBrandGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '今日已练 $today/$goal 题${today >= goal ? ' · 已达成' : ''}',
                  style: const TextStyle(
                      color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
              if (today < goal && dailyStreak > 0)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.flame,
                          size: 13, color: Colors.white),
                      const SizedBox(width: 4),
                      Text('连续打卡 $dailyStreak 天',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 11)),
                    ],
                  ),
                ),
              if (today >= goal)
                InkWell(
                  onTap: () => context.push('/poster'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Row(
                      children: [
                        Icon(LucideIcons.partyPopper, size: 13, color: Colors.white),
                        SizedBox(width: 4),
                        Text('生成打卡海报 ›',
                            style: TextStyle(color: Colors.white, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
            ],
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
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: KgColors.brandDeep,
                  ),
                  onPressed: () => context.push('/practice'),
                  child: Text(today >= goal ? '再练一组 ›' : '继续目标 ›'),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white54),
                ),
                onPressed: _openSetup,
                child: const Text('今日计划'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _riskCard(({String title, String sub}) risk) {
    return Card(
      color: context.kg.warningBg,
      child: ListTile(
        leading: const Icon(LucideIcons.flame, size: 22, color: KgColors.warning),
        title: Text(risk.title,
            style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: KgColors.warning)),
        subtitle: Text(risk.sub,
            style: const TextStyle(fontSize: 12, color: KgColors.warning)),
        trailing: const Text('去刷题 ›',
            style: TextStyle(fontSize: 13, color: KgColors.warning)),
        onTap: () => context.push('/practice'),
      ),
    );
  }

  Widget _announceCard() {
    final a = announce!;
    return Card(
      color: const Color(0xFFEFF8FF),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(LucideIcons.megaphone, size: 16, color: Color(0xFF0369A1)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text((a['title'] ?? '').toString(),
                      style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0369A1))),
                  if ((a['body'] ?? '').toString().isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text((a['body'] ?? '').toString(),
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF0369A1))),
                  ],
                ],
              ),
            ),
            InkWell(
              onTap: () {
                Store.instance.annDismissed = '${a['id']}';
                setState(() => announce = null);
              },
              child: const Icon(LucideIcons.x, size: 16, color: Color(0xFF0369A1)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _szCard() {
    final done = szTodayDone;
    return Card(
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: context.kg.warningBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Icon(LucideIcons.newspaper, size: 22, color: KgColors.warning),
        ),
        title: Row(
          children: [
            const Text('时政每日一练',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: done ? context.kg.successBg : context.kg.warningBg,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(done ? '已完成' : '今日更新',
                  style: TextStyle(
                      fontSize: 10,
                      color: done ? KgColors.success : KgColors.warning)),
            ),
          ],
        ),
        subtitle: Text('每日 10 题 · 近半年国内时政热点 · 全站同题',
            style: TextStyle(fontSize: 12, color: context.kg.t3)),
        trailing: Text(done ? '回顾 ›' : '去练习 ›',
            style: const TextStyle(fontSize: 13, color: KgColors.brand)),
        onTap: () => context.push('/shizheng'),
      ),
    );
  }

  /// 专项练习行：图标 + 名称 + 已刷/正确率 + 模块色进度条 + 开始/继续做题胶囊，
  /// 对标华图专项练习的「刷题量/正确率 + 继续做题」。
  Widget _moduleRow(String key, String name) {
    final kg = context.kg;
    final color = KgColors.moduleColors[key] ?? KgColors.brand;
    final c = counts.firstWhere((e) => e['module'] == key,
        orElse: () => <String, dynamic>{});
    final total = ((c['n'] ?? 0) as num).toInt();
    final s = _modStat(key);
    final done = ((s['done'] ?? 0) as num).toInt();
    final correct = ((s['correct'] ?? 0) as num).toInt();
    final acc = done > 0 ? (correct * 100 / done).round() : null;
    final sub = done == 0
        ? (total > 0 ? '$total 题 · 从这里开始' : '从这里开始')
        : '已刷 $done/$total · 正确率 $acc%';
    return InkWell(
      onTap: () => _openModule(key, name),
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
                  Text(name,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(sub, style: TextStyle(fontSize: 12, color: kg.t3)),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: total > 0 ? (done / total).clamp(0.0, 1.0) : 0,
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
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w600, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 点模块：有多个二级题型时弹选择 sheet，否则直接开练。
  Future<void> _openModule(String module, String name) async {
    List<Map<String, dynamic>> subs = [];
    try {
      subs = (await Api.submodules(module))
          .map((e) => Map<String, dynamic>.from(e))
          .where((s) => (s['submodule'] ?? '').toString().isNotEmpty)
          .toList();
    } catch (_) {/* 取不到就直接开练 */}
    if (!mounted) return;
    if (subs.length < 2) {
      context.push('/practice?module=$module');
      return;
    }
    Map<String, dynamic> prog = {};
    try {
      prog = await Api.submoduleProgress(module: module);
    } catch (_) {/* 非关键路径 */}
    if (!mounted) return;
    final total = counts.firstWhere((e) => e['module'] == module,
        orElse: () => <String, dynamic>{})['n'];
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => SafeArea(
        child: ConstrainedBox(
          constraints:
              BoxConstraints(maxHeight: MediaQuery.of(c).size.height * .7),
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            children: [
              Text('$name · 选择题型',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('全部随机',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                trailing: Text('${total ?? '-'} 题',
                    style: TextStyle(fontSize: 12, color: context.kg.t3)),
                onTap: () {
                  Navigator.pop(c);
                  context.push('/practice?module=$module');
                },
              ),
              for (final s in subs)
                Builder(builder: (context) {
                  final sub = (s['submodule'] ?? '').toString();
                  final p = prog[sub] is Map
                      ? Map<String, dynamic>.from(prog[sub] as Map)
                      : null;
                  final pn = ((p?['n'] ?? 0) as num).toInt();
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(sub, style: const TextStyle(fontSize: 14)),
                    subtitle: pn > 0
                        ? Text(
                            '已做 $pn 题 · 正确率 ${(((p?['c'] ?? 0) as num) * 100 / pn).round()}%',
                            style: TextStyle(
                                fontSize: 11, color: context.kg.t4))
                        : null,
                    trailing: Text('${s['n']} 题',
                        style:
                            TextStyle(fontSize: 12, color: context.kg.t3)),
                    onTap: () {
                      Navigator.pop(c);
                      context.push(
                          '/practice?module=$module&submodule=${Uri.encodeComponent(sub)}');
                    },
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _smartCard(String module) {
    return Card(
      child: ListTile(
        leading: const Icon(LucideIcons.brainCircuit, color: KgColors.brand),
        title: const Text('智能刷题：攻克薄弱项',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        subtitle: Text('你的${moduleName(module)}正确率较低，建议专项练习',
            style: TextStyle(fontSize: 12, color: context.kg.t3)),
        trailing: const Text('去练 ›',
            style: TextStyle(fontSize: 13, color: KgColors.brand)),
        onTap: () => _openModule(module, moduleName(module)),
      ),
    );
  }

  /// 练习设置 sheet：每日目标 / 选题来源（题库/真题+年份地区）/ 每组题量。
  Future<void> _openSettings() async {
    Map<String, dynamic> filters = {};
    if (Store.instance.realMode) {
      try {
        filters = await Api.realFilters();
      } catch (_) {/* 非关键路径 */}
    }
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          final st = Store.instance;
          Future<void> ensureFilters() async {
            if (filters.isNotEmpty) return;
            try {
              filters = await Api.realFilters();
              setSheet(() {});
            } catch (_) {/* 非关键路径 */}
          }

          final years = (filters['years'] as List<dynamic>? ?? []);
          final regions = (filters['regions'] as List<dynamic>? ?? []);
          Widget chips(String label, String? sub, List<Widget> items) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    if (sub != null)
                      Text(sub,
                          style: TextStyle(
                              fontSize: 11, color: context.kg.t4)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: items),
                  ],
                ),
              );
          ChoiceChip chip(String label, bool on, VoidCallback tap) => ChoiceChip(
                label: Text(label, style: const TextStyle(fontSize: 12)),
                selected: on,
                onSelected: (_) => tap(),
                visualDensity: VisualDensity.compact,
              );
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('练习设置',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 14),
                  chips('每日目标', '今天合计要练的题数', [
                    for (final g in const [20, 50, 100])
                      chip('$g 题', st.dailyGoal == g, () {
                        ref.read(dailyGoalProvider.notifier).set(g);
                        setSheet(() {});
                      }),
                  ]),
                  chips('选题来源', null, [
                    chip('题库模式', !st.realMode, () {
                      st.realMode = false;
                      setSheet(() {});
                    }),
                    chip('真题模式', st.realMode, () {
                      st.realMode = true;
                      setSheet(() {});
                      ensureFilters();
                    }),
                  ]),
                  if (st.realMode && years.isNotEmpty)
                    chips('真题年份', null, [
                      chip('全部', st.realYear == null, () {
                        st.realYear = null;
                        setSheet(() {});
                      }),
                      for (final y in years)
                        chip('${(y as Map)['y']}',
                            st.realYear == ((y)['y'] as num).toInt(), () {
                          st.realYear = ((y)['y'] as num).toInt();
                          setSheet(() {});
                        }),
                    ]),
                  if (st.realMode && regions.isNotEmpty)
                    chips('真题地区', null, [
                      chip('全部', st.realRegion.isEmpty, () {
                        st.realRegion = '';
                        setSheet(() {});
                      }),
                      for (final r in regions)
                        chip('${(r as Map)['r']}',
                            st.realRegion == '${(r)['r']}', () {
                          st.realRegion = '${(r)['r']}';
                          setSheet(() {});
                        }),
                    ]),
                  chips('每组题量', '单次练习连做几道', [
                    for (final n in const [10, 20, 30, 50])
                      chip('$n', st.groupSize == n, () {
                        st.groupSize = n;
                        setSheet(() {});
                      }),
                  ]),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                    onPressed: () {
                      Navigator.pop(c);
                      context.push('/practice');
                    },
                    child: const Text('按以上设置开始练习（混合模块）'),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(46)),
                    onPressed: () async {
                      Navigator.pop(c);
                      await _exportPaper();
                    },
                    child: const Text('按以上设置导出练习卷 PDF'),
                  ),
                  const SizedBox(height: 8),
                  Text('以上设置同样作用于模块列表；模考与真题卷不受影响',
                      style: TextStyle(fontSize: 11, color: context.kg.t4)),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (mounted) setState(() {});
  }

  /// 按当前练习设置抽题导出练习卷 PDF（复刻 exportPaper）。
  Future<void> _exportPaper() async {
    final st = Store.instance;
    List<int> ids;
    try {
      final d = await Api.questions(
        limit: st.groupSize,
        adaptive: false,
        real: st.realMode,
        year: st.realMode ? st.realYear : null,
        region: st.realMode ? st.realRegion : null,
      );
      ids = [
        for (final q in (d['items'] as List<dynamic>? ?? []))
          if ((q as Map)['id'] is num) (q['id'] as num).toInt(),
      ];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('导出失败：${Api.errMsg(e)}')));
      }
      return;
    }
    if (!mounted) return;
    if (ids.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('没有可导出的题目')));
      return;
    }
    final now = DateTime.now();
    showExportSheet(
      context,
      title:
          '${st.realMode ? '真题精选卷' : '练习卷'} ${now.month}月${now.day}日',
      questionIds: ids,
    );
  }

  /// 真题卷库 sheet：选卷整卷连做。
  Future<void> _openPapers() async {
    List<Map<String, dynamic>> papers;
    try {
      papers =
          (await Api.papers()).map((e) => Map<String, dynamic>.from(e)).toList();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('试卷加载失败：${Api.errMsg(e)}')));
      }
      return;
    }
    if (!mounted) return;
    String? region;
    final regions = <String>[];
    for (final p in papers) {
      final r = (p['region'] ?? '').toString();
      if (r.isNotEmpty && !regions.contains(r)) regions.add(r);
    }
    regions.sort();
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          final shown = region == null
              ? papers
              : papers.where((p) => p['region'] == region).toList();
          return SafeArea(
            child: ConstrainedBox(
              constraints:
                  BoxConstraints(maxHeight: MediaQuery.of(c).size.height * .7),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Text('真题卷库 · 选择试卷',
                        style:
                            TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                  if (regions.length > 1)
                    SizedBox(
                      height: 44,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        padding:
                            const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: const Text('全部',
                                  style: TextStyle(fontSize: 12)),
                              selected: region == null,
                              onSelected: (_) => setSheet(() => region = null),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                          for (final r in regions)
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(r, style: const TextStyle(fontSize: 12)),
                                selected: region == r,
                                onSelected: (_) => setSheet(() => region = r),
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                        ],
                      ),
                    ),
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      children: [
                        for (final p in shown)
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text((p['title'] ?? '').toString(),
                                style: const TextStyle(fontSize: 14)),
                            trailing: Text('${p['n']} 题',
                                style: TextStyle(
                                    fontSize: 12, color: context.kg.t3)),
                            onTap: () {
                              Navigator.pop(c);
                              context.push(
                                  '/practice?mode=paper&source=${Uri.encodeComponent((p['source'] ?? '').toString())}&title=${Uri.encodeComponent((p['title'] ?? '').toString())}');
                            },
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
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
            // 考点级弱项推荐（复刻 plan.weak，携带 tag3）
            for (final w in (daily?['weak'] as List<dynamic>? ?? []))
              _weakRow(Map<String, dynamic>.from(w as Map)),
            const SizedBox(height: 8),
            // 今日主攻（复刻 plan-focus chips，影响推荐权重）
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('今天主攻',
                    style: TextStyle(fontSize: 12, color: context.kg.t3)),
                for (final e in kModuleNames.entries)
                  Builder(builder: (context) {
                    final on = daily?['focus'] == e.key;
                    return InkWell(
                      onTap: () => _setFocus(e.key),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: on ? KgColors.brand : context.kg.fill,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(e.value,
                            style: TextStyle(
                                fontSize: 11,
                                color: on ? Colors.white : context.kg.t3)),
                      ),
                    );
                  }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _weakRow(Map<String, dynamic> w) {
    final module = (w['module'] ?? '').toString();
    final sub = (w['submodule'] ?? '').toString();
    final tag3 = (w['tag3'] ?? '').toString();
    final name = tag3.isNotEmpty ? tag3 : (sub.isNotEmpty ? sub : moduleName(module));
    return InkWell(
      onTap: () {
        var url = '/practice?count=10';
        if (module.isNotEmpty) url += '&module=$module';
        if (sub.isNotEmpty) url += '&submodule=${Uri.encodeComponent(sub)}';
        if (tag3.isNotEmpty) url += '&tag3=${Uri.encodeComponent(tag3)}';
        context.push(url);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            const Icon(LucideIcons.crosshair, size: 16, color: KgColors.warning),
            const SizedBox(width: 8),
            Expanded(
              child: Text('弱项专项：$name',
                  style: const TextStyle(fontSize: 13.5)),
            ),
            const Text('练 10 题 ›',
                style: TextStyle(fontSize: 12, color: KgColors.brand)),
          ],
        ),
      ),
    );
  }

  Future<void> _setFocus(String mod) async {
    final next = daily?['focus'] == mod ? '' : mod;
    try {
      await Api.setFocus(next);
      final d = await Api.dailyPlan();
      if (!mounted) return;
      setState(() => daily = d);
      if (next.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('今日主攻已设为${moduleName(next)}，推荐已更新')));
      }
    } catch (_) {/* 非关键路径 */}
  }

  Widget _taskRow(Map<String, dynamic> t) {
    final done = t['done'] == true || t['done'] == 1;
    final module = (t['module'] ?? '').toString();
    final type = (t['type'] ?? '').toString();
    final sub = (t['submodule'] ?? '').toString();
    return InkWell(
      onTap: done
          ? null
          : () {
              if (type == 'mock') {
                context.push('/exam/run?mini=1');
              } else if (type == 'review') {
                context.push('/practice?mode=review');
              } else if (type == 'reinforce') {
                final tag3 = (t['tag3'] ?? '').toString();
                var url = '/practice?mode=reinforce&count=5';
                if (module.isNotEmpty) url += '&module=$module';
                if (sub.isNotEmpty) url += '&submodule=${Uri.encodeComponent(sub)}';
                if (tag3.isNotEmpty) url += '&tag3=${Uri.encodeComponent(tag3)}';
                context.push(url);
              } else {
                final target = ((t['target'] ?? 0) as num).toInt();
                final doneN = ((t['done_n'] ?? 0) as num).toInt();
                final remain = (target - doneN).clamp(5, 100);
                var url = '/practice?count=$remain';
                if (module.isNotEmpty) url += '&module=$module';
                if (sub.isNotEmpty) url += '&submodule=${Uri.encodeComponent(sub)}';
                context.push(url);
              }
            },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(done ? LucideIcons.checkCircle2 : LucideIcons.circle,
                size: 16, color: done ? KgColors.success : context.kg.t4),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (t['title'] ?? t['name'] ?? '').toString(),
                    style: TextStyle(
                      fontSize: 13.5,
                      color: done ? context.kg.t3 : null,
                      decoration: done ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  Builder(builder: (context) {
                    final subText = (t['sub'] ?? '').toString();
                    final doneN = ((t['done_n'] ?? 0) as num).toInt();
                    final target = ((t['target'] ?? 0) as num).toInt();
                    final extra = type != 'mock' && doneN > 0
                        ? ' · 已完成 $doneN/$target'
                        : '';
                    if (subText.isEmpty && extra.isEmpty) {
                      return const SizedBox.shrink();
                    }
                    return Text('$subText$extra',
                        style: TextStyle(
                            fontSize: 11, color: context.kg.t4));
                  }),
                ],
              ),
            ),
            Text(
              done
                  ? '已完成'
                  : type == 'mock'
                      ? '去模考 ›'
                      : type == 'review'
                          ? '去复习 ›'
                          : type == 'reinforce'
                              ? '去强化 ›'
                              : '去练 ›',
              style: TextStyle(
                  fontSize: 12,
                  color: done ? context.kg.t4 : KgColors.brand),
            ),
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

  Widget _paperEntry(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: _openPapers,
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(LucideIcons.files, size: 22, color: KgColors.brand),
            SizedBox(height: 6),
            Text('真题卷练习', style: TextStyle(fontSize: 12)),
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
