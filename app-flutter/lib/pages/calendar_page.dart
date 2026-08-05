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

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    y = now.year;
    m = now.month;
    _load();
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
