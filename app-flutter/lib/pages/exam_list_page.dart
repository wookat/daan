import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 真题卷库：迷你模考置顶 + 年份/地区筛选 + 真题卷列表 + 历史成绩。
class ExamListPage extends StatefulWidget {
  const ExamListPage({super.key});

  @override
  State<ExamListPage> createState() => _ExamListPageState();
}

class _ExamListPageState extends State<ExamListPage> {
  List<dynamic> items = [];
  List<int> years = [];
  List<String> regions = [];
  int? year;
  String? region;
  List<dynamic> attempts = [];
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
      final results = await Future.wait([
        Api.examPapers(year: year, region: region),
        Api.examAttempts(limit: 10).catchError((_) => const <dynamic>[]),
      ]);
      final d = results[0] as Map<String, dynamic>;
      final filters = Map<String, dynamic>.from(d['filters'] ?? {});
      setState(() {
        items = d['items'] as List<dynamic>? ?? [];
        years = (filters['years'] as List<dynamic>? ?? [])
            .map((e) => e is Map ? int.tryParse('${e['y']}') ?? 0 : int.tryParse('$e') ?? 0)
            .where((e) => e > 0)
            .toList();
        regions = (filters['regions'] as List<dynamic>? ?? [])
            .map((e) => e is Map ? '${e['r'] ?? ''}' : e.toString())
            .where((e) => e.isNotEmpty)
            .toList();
        attempts = results[1] as List<dynamic>;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Future<void> _openExam({int? paperId, bool mini = false}) async {
    final q = mini ? 'mini=1' : 'paper_id=$paperId';
    await context.push('/exam/run?$q');
    _load();
  }

  void _pickYear() {
    showModalBottomSheet(
      context: context,
      builder: (c) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            ListTile(
              title: const Text('全部年份'),
              onTap: () {
                Navigator.pop(c);
                setState(() => year = null);
                _load();
              },
            ),
            for (final y in years)
              ListTile(
                title: Text('$y 年'),
                trailing: y == year ? const Icon(LucideIcons.check, color: KgColors.brand) : null,
                onTap: () {
                  Navigator.pop(c);
                  setState(() => year = y);
                  _load();
                },
              ),
          ],
        ),
      ),
    );
  }

  void _showHistory() {
    showModalBottomSheet(
      context: context,
      builder: (c) => SafeArea(
        child: attempts.isEmpty
            ? const SizedBox(
                height: 200,
                child: Center(child: Text('还没有模考记录', style: TextStyle(color: KgColors.t3))))
            : ListView.builder(
                shrinkWrap: true,
                itemCount: attempts.length,
                itemBuilder: (context, i) {
                  final a = Map<String, dynamic>.from(attempts[i]);
                  final score = a['score'];
                  return ListTile(
                    leading: const Icon(LucideIcons.fileBarChart, color: KgColors.brand),
                    title: Text((a['title'] ?? '模考').toString(),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(_fmtTime(a['submitted_at']),
                        style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                    trailing: Text('$score 分',
                        style: const TextStyle(
                            color: KgColors.brand, fontWeight: FontWeight.w700, fontSize: 15)),
                    onTap: () {
                      Navigator.pop(c);
                      context.push('/exam/report/${a['id']}');
                    },
                  );
                },
              ),
      ),
    );
  }

  String _fmtTime(dynamic ts) {
    if (ts is! num || ts <= 0) return '';
    final d = DateTime.fromMillisecondsSinceEpoch((ts * 1000).toInt());
    return '${d.month}/${d.day} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('真题卷库')),
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
                      _miniCard(),
                      const SizedBox(height: 14),
                      _filters(),
                      const SizedBox(height: 12),
                      if (items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 48),
                          child: Center(
                              child: Text('暂无符合条件的真题卷',
                                  style: TextStyle(color: KgColors.t3, fontSize: 13))),
                        )
                      else
                        for (final it in items) _paperCard(Map<String, dynamic>.from(it)),
                    ],
                  ),
                ),
    );
  }

  Widget _miniCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFFFF7ED), Color(0xFFFFFBEB)]),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Text('⚡', style: TextStyle(fontSize: 26)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('迷你模考', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                SizedBox(height: 2),
                Text('30 题 · 30 分钟 · 随机组卷，即刻开考',
                    style: TextStyle(fontSize: 12, color: KgColors.t3)),
              ],
            ),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                minimumSize: const Size(0, 38),
                padding: const EdgeInsets.symmetric(horizontal: 18)),
            onPressed: () => _openExam(mini: true),
            child: const Text('开始', style: TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  Widget _filters() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _chip('全部地区', region == null, () {
            setState(() => region = null);
            _load();
          }),
          for (final r in regions) ...[
            const SizedBox(width: 8),
            _chip(r, region == r, () {
              setState(() => region = r);
              _load();
            }),
          ],
          const SizedBox(width: 8),
          _chip(year == null ? '全部年份 ▾' : '$year 年 ▾', year != null, _pickYear),
          const SizedBox(width: 8),
          _chip('历史成绩', false, _showHistory),
        ],
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? KgColors.brand50 : KgColors.fill,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12,
                color: on ? KgColors.brand : KgColors.t2,
                fontWeight: on ? FontWeight.w600 : FontWeight.w400)),
      ),
    );
  }

  Widget _paperCard(Map<String, dynamic> p) {
    final n = p['n'] ?? p['question_count'] ?? '';
    final dur = p['duration_min'] ?? '';
    final best = p['best_score'];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openExam(paperId: p['id'] as int),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: KgColors.brand50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(LucideIcons.fileText, size: 20, color: KgColors.brand),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((p['title'] ?? '').toString(),
                        style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text('$n 题 · $dur 分钟',
                        style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                  ],
                ),
              ),
              if (best != null)
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: KgColors.successBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('最高 $best',
                      style: const TextStyle(fontSize: 11, color: KgColors.success)),
                )
              else
                const Icon(LucideIcons.chevronRight, size: 18, color: KgColors.t4),
            ],
          ),
        ),
      ),
    );
  }
}
