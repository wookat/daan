import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 学习日历：月历打卡视图（翻月/图例/本月统计）+ 打卡海报入口。复刻 pages/stats/calendar.vue。
class CalendarPage extends StatefulWidget {
  const CalendarPage({super.key});

  @override
  State<CalendarPage> createState() => _CalendarPageState();
}

class _CalendarPageState extends State<CalendarPage> {
  Map<String, int> days = {}; // 'yyyy-MM-dd' -> 做题数
  bool loading = true;
  String? error;
  late int y;
  late int m; // 1-12
  int streak = 0;
  int bestStreak = 0;
  List<({int days, bool unlocked})> badges = [];
  ({int days, int left, int pct})? nextMilestone;
  bool badgesLoaded = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    y = now.year;
    m = now.month;
    _load();
    _loadBadges();
  }

  Future<void> _loadBadges() async {
    try {
      final b = await Api.checkinBadges();
      final s = (b['streak'] as num?)?.toInt() ?? 0;
      final bs = (b['best_streak'] as num?)?.toInt() ?? s;
      final list = (b['badges'] as List<dynamic>? ?? [])
          .map((e) => (
                days: (((e as Map)['days'] ?? 0) as num).toInt(),
                unlocked: e['unlocked'] == true,
              ))
          .toList();
      final ms = list.map((x) => x.days).toList();
      final next = ms.where((x) => x > s).firstOrNull;
      ({int days, int left, int pct})? nm;
      if (next != null) {
        var prev = 0;
        for (final x in ms) {
          if (x <= s) prev = x;
        }
        nm = (
          days: next,
          left: next - s,
          pct: ((s - prev) * 100 / (next - prev)).round(),
        );
      }
      if (mounted) {
        setState(() {
          streak = s;
          bestStreak = bs;
          badges = list;
          nextMilestone = nm;
          badgesLoaded = true;
        });
      }
    } catch (_) {/* 非关键路径 */}
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final d = await Api.checkinSummary();
      final raw = Map<String, dynamic>.from(d['days'] as Map? ?? {});
      setState(() {
        days = raw.map((k, v) =>
            MapEntry(k, ((v as Map)['n'] ?? 0) is num ? ((v['n'] ?? 0) as num).toInt() : 0));
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  bool get isCurMonth {
    final now = DateTime.now();
    return y == now.year && m == now.month;
  }

  String get _prefix => '$y-${m.toString().padLeft(2, '0')}-';

  int get monthDays =>
      days.entries.where((e) => e.key.startsWith(_prefix) && e.value > 0).length;

  int get monthCount => days.entries
      .where((e) => e.key.startsWith(_prefix))
      .fold(0, (s, e) => s + e.value);

  void _shift(int dir) {
    if (dir > 0 && isCurMonth) return;
    var ny = y, nm = m + dir;
    if (nm < 1) {
      nm = 12;
      ny--;
    }
    if (nm > 12) {
      nm = 1;
      ny++;
    }
    setState(() {
      y = ny;
      m = nm;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('学习日历')),
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
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (badgesLoaded) ...[
                      _milestoneCard(),
                      const SizedBox(height: 16),
                    ],
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                IconButton(
                                  onPressed: () => _shift(-1),
                                  icon: const Icon(LucideIcons.chevronLeft, size: 20),
                                ),
                                Text('$y 年 $m 月',
                                    style: const TextStyle(
                                        fontSize: 16, fontWeight: FontWeight.w700)),
                                IconButton(
                                  onPressed: isCurMonth ? null : () => _shift(1),
                                  icon: const Icon(LucideIcons.chevronRight, size: 20),
                                ),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: KgColors.successBg,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text('本月打卡 $monthDays 天',
                                      style: const TextStyle(
                                          fontSize: 11, color: KgColors.success)),
                                ),
                              ],
                            ),
                            Padding(
                              padding: const EdgeInsets.only(left: 8, bottom: 12),
                              child: Text('本月共练 $monthCount 题',
                                  style: const TextStyle(
                                      fontSize: 12, color: KgColors.t3)),
                            ),
                            Row(
                              children: [
                                for (final w in const ['一', '二', '三', '四', '五', '六', '日'])
                                  Expanded(
                                    child: Center(
                                      child: Text(w,
                                          style: const TextStyle(
                                              fontSize: 11, color: KgColors.t3)),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            _grid(),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                _legend(KgColors.brand50, '1-9 题', border: KgColors.brand),
                                const SizedBox(width: 16),
                                _legend(KgColors.brand, '≥10 题'),
                                const SizedBox(width: 16),
                                _legend(Colors.transparent, '今天', border: KgColors.brand),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.push('/poster'),
                      child: const Text('生成打卡海报'),
                    ),
                  ],
                ),
    );
  }

  /// 连签里程碑卡：当前连签/最佳连签 + 下一枚徽章进度条 + 徽章墙。
  Widget _milestoneCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(LucideIcons.flame, size: 18, color: KgColors.warning),
                const SizedBox(width: 6),
                Text('连续打卡 $streak 天',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text('最佳 $bestStreak 天',
                    style: const TextStyle(fontSize: 12, color: KgColors.t3)),
              ],
            ),
            const SizedBox(height: 12),
            if (nextMilestone != null) ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: nextMilestone!.pct / 100,
                  minHeight: 8,
                  backgroundColor: context.kg.fill,
                  valueColor: const AlwaysStoppedAnimation(KgColors.brand),
                ),
              ),
              const SizedBox(height: 6),
              Text('再打卡 ${nextMilestone!.left} 天解锁「${nextMilestone!.days} 天」徽章',
                  style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            ] else if (badges.isNotEmpty)
              const Text('已解锁全部打卡徽章，太强了！',
                  style: TextStyle(fontSize: 12, color: KgColors.t3)),
            if (badges.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  for (final b in badges)
                    Expanded(
                      child: Column(
                        children: [
                          Opacity(
                            opacity: b.unlocked ? 1 : .3,
                            child: Text(b.unlocked ? '🏅' : '🔒',
                                style: const TextStyle(fontSize: 20)),
                          ),
                          const SizedBox(height: 2),
                          Text('${b.days}天',
                              style: TextStyle(
                                  fontSize: 10,
                                  color: b.unlocked ? KgColors.brand : KgColors.t4,
                                  fontWeight:
                                      b.unlocked ? FontWeight.w700 : FontWeight.w400)),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _grid() {
    final now = DateTime.now();
    final lead = (DateTime(y, m, 1).weekday + 6) % 7;
    final total = DateTime(y, m + 1, 0).day;
    final cells = <Widget>[];
    for (var i = 0; i < lead; i++) {
      cells.add(const SizedBox());
    }
    for (var d = 1; d <= total; d++) {
      final key = '$_prefix${d.toString().padLeft(2, '0')}';
      final n = days[key] ?? 0;
      final today = isCurMonth && d == now.day;
      Color? bg;
      Color fg = KgColors.t3;
      FontWeight fw = FontWeight.w400;
      if (n >= 10) {
        bg = KgColors.brand;
        fg = Colors.white;
        fw = FontWeight.w700;
      } else if (n > 0) {
        bg = KgColors.brand50;
        fg = KgColors.brand;
        fw = FontWeight.w600;
      }
      cells.add(Center(
        child: Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: today ? Border.all(color: KgColors.brand, width: 1.5) : null,
          ),
          child: Text('$d', style: TextStyle(fontSize: 13, color: fg, fontWeight: fw)),
        ),
      ));
    }
    return GridView.count(
      crossAxisCount: 7,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: cells,
    );
  }

  Widget _legend(Color color, String label, {Color? border}) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: border != null ? Border.all(color: border) : null,
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11, color: KgColors.t3)),
      ],
    );
  }
}
