import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 考点掌握度地图：三级考点树 + 五档色阶（复刻 pkgA/stats/mastery-map.vue）。
/// 冷启动（累计作答不足）时展示解锁进度；点考点弹出吸底操作条可直达专项练习。
class MasteryMapPage extends StatefulWidget {
  const MasteryMapPage({super.key});

  @override
  State<MasteryMapPage> createState() => _MasteryMapPageState();
}

const _levelColors = <String, Color>{
  'untouched': Color(0xFFE5E7EB),
  'rumen': Color(0xFFF87171),
  'gonggu': Color(0xFFFBBF24),
  'shulian': Color(0xFF34D399),
  'jingtong': Color(0xFF059669),
};

class _MasteryMapPageState extends State<MasteryMapPage> {
  Map<String, dynamic>? map;
  bool loading = true;
  String? error;
  bool cold = false;
  int nTotal = 0;
  int need = 30;
  String curMod = '';
  Map<String, dynamic>? selected;
  Map<String, dynamic>? selGrp;

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
      final d = await Api.masteryMap();
      setState(() {
        loading = false;
        nTotal = ((d['n_total'] ?? 0) as num).toInt();
        need = ((d['need'] ?? 30) as num).toInt();
        cold = d['cold'] == true;
        if (!cold) {
          map = d;
          final mods = d['modules'] as List<dynamic>? ?? [];
          if (curMod.isEmpty && mods.isNotEmpty) {
            curMod = (mods.first as Map)['module'].toString();
          }
        }
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  List<Map<String, dynamic>> get _curSubs {
    final mods = (map?['modules'] as List<dynamic>? ?? []);
    for (final m in mods) {
      final mm = Map<String, dynamic>.from(m as Map);
      if (mm['module'] == curMod) {
        return [
          for (final g in (mm['subs'] as List<dynamic>? ?? []))
            Map<String, dynamic>.from(g as Map)
        ];
      }
    }
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('考点掌握度地图')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? _err()
              : cold
                  ? _coldView()
                  : _mapView(),
      bottomNavigationBar: selected == null ? null : _actionBar(),
    );
  }

  Widget _err() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(error!, style: const TextStyle(color: KgColors.t3)),
          const SizedBox(height: 12),
          FilledButton(onPressed: _load, child: const Text('重试')),
        ],
      ),
    );
  }

  Widget _coldView() {
    final pct = (nTotal / need).clamp(0.0, 1.0);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(LucideIcons.map, size: 48, color: KgColors.t4),
            const SizedBox(height: 16),
            Text('再练 ${(need - nTotal).clamp(0, need)} 题解锁掌握度地图',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text('累计作答 $nTotal/$need 题后，按三级考点展示你的掌握度色阶',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: KgColors.t3)),
            const SizedBox(height: 20),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                  value: pct, minHeight: 8, backgroundColor: KgColors.fill),
            ),
            const SizedBox(height: 24),
            FilledButton(
              style: FilledButton.styleFrom(minimumSize: const Size(180, 46)),
              onPressed: () => context.push('/practice'),
              child: const Text('去刷题'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mapView() {
    final cov = Map<String, dynamic>.from(map!['coverage'] as Map);
    final mods = (map!['modules'] as List<dynamic>? ?? [])
        .map((m) => Map<String, dynamic>.from(m as Map))
        .toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  SizedBox(
                    width: 64,
                    height: 64,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CircularProgressIndicator(
                          value: ((cov['pct'] ?? 0) as num) / 100,
                          strokeWidth: 6,
                          backgroundColor: KgColors.fill,
                        ),
                        Text('${cov['pct']}%',
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700, color: KgColors.brand)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('考点覆盖度',
                            style: TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text(
                            '已练 ${cov['practiced']}/${cov['total']} 个考点 · 累计 ${map!['n_total']} 题',
                            style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            _legend('未接触', 'untouched'),
                            _legend('入门', 'rumen'),
                            _legend('巩固', 'gonggu'),
                            _legend('熟练', 'shulian'),
                            _legend('精通', 'jingtong'),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final m in mods)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                          '${m['name']} ${((m['mastery'] ?? 0) as num) > 0 ? '${(((m['mastery'] ?? 0) as num) * 100).round()}%' : ''}'),
                      selected: curMod == m['module'],
                      onSelected: (_) => setState(() {
                        curMod = m['module'].toString();
                        selected = null;
                      }),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          for (final g in _curSubs) ...[
            _groupCard(g),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _legend(String name, String level) {
    final c = _levelColors[level]!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(4)),
      child: Text(name,
          style: TextStyle(
              fontSize: 10,
              color: level == 'untouched' ? const Color(0xFF6B7280) : Colors.white)),
    );
  }

  Widget _groupCard(Map<String, dynamic> g) {
    final tags = (g['tag3s'] as List<dynamic>? ?? [])
        .map((t) => Map<String, dynamic>.from(t as Map))
        .toList();
    final n = ((g['n'] ?? 0) as num).toInt();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(g['submodule'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                Text(
                    n > 0
                        ? '${(((g['mastery'] ?? 0) as num) * 100).round()}% · $n 题'
                        : '未练习',
                    style: const TextStyle(fontSize: 12, color: KgColors.t3)),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [for (final t in tags) _tile(g, t)],
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(Map<String, dynamic> g, Map<String, dynamic> t) {
    final level = (t['level'] ?? 'untouched').toString();
    final untouched = level == 'untouched';
    final color = _levelColors[level] ?? _levelColors['untouched']!;
    final sel = selected != null && selected!['code'] == t['code'];
    final due = ((t['due_mistakes'] ?? 0) as num).toInt();
    final n = ((t['n'] ?? 0) as num).toInt();
    return GestureDetector(
      onTap: () => setState(() {
        if (sel) {
          selected = null;
        } else {
          selected = t;
          selGrp = g;
        }
      }),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 102,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: untouched ? const Color(0xFFF3F4F6) : color,
              borderRadius: BorderRadius.circular(10),
              border: untouched
                  ? Border.all(color: const Color(0xFFD1D5DB), width: 1)
                  : sel
                      ? Border.all(color: KgColors.brand, width: 2)
                      : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t['name'].toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: untouched ? const Color(0xFF6B7280) : Colors.white)),
                const SizedBox(height: 2),
                Text(n > 0 ? '${(((t['mastery'] ?? 0) as num) * 100).round()}%' : '未练',
                    style: TextStyle(
                        fontSize: 10,
                        color: untouched
                            ? const Color(0xFF9CA3AF)
                            : Colors.white.withValues(alpha: 0.85))),
              ],
            ),
          ),
          if (due > 0)
            Positioned(
              top: -5,
              right: -5,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: KgColors.error,
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: Text(due > 9 ? '9+' : '$due',
                    style: const TextStyle(fontSize: 9, color: Colors.white)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _actionBar() {
    final t = selected!;
    final n = ((t['n'] ?? 0) as num).toInt();
    final due = ((t['due_mistakes'] ?? 0) as num).toInt();
    final sub = selGrp?['submodule']?.toString();
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: KgColors.border)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(t['name'].toString(),
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                      n > 0
                          ? '掌握度 ${(((t['mastery'] ?? 0) as num) * 100).round()}% · 已练 $n 题${due > 0 ? ' · $due 道错题到期' : ''}'
                          : '还没练过，来试试',
                      style: const TextStyle(fontSize: 11, color: KgColors.t3)),
                ],
              ),
            ),
            if (due > 0) ...[
              OutlinedButton(
                onPressed: () => context.push('/practice?mode=review'),
                child: const Text('去复习', style: TextStyle(fontSize: 13)),
              ),
              const SizedBox(width: 8),
            ],
            FilledButton(
              onPressed: () {
                final q = Uri(queryParameters: {
                  'module': curMod,
                  if (sub != null && sub.isNotEmpty) 'submodule': sub,
                  'tag3': t['code'].toString(),
                  'count': '10',
                }).query;
                context.push('/practice?$q');
              },
              child: const Text('练 10 题', style: TextStyle(fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
