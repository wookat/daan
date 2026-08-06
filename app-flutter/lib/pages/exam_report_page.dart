import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';
import '../widgets/rank_card.dart';

/// 成绩报告：得分 Hero + 模块条形 + 逐题对错网格（点击看解析）+ 复盘错题。
class ExamReportPage extends StatefulWidget {
  const ExamReportPage({super.key, required this.attemptId});

  final int attemptId;

  @override
  State<ExamReportPage> createState() => _ExamReportPageState();
}

class _ExamReportPageState extends State<ExamReportPage> {
  Map<String, dynamic>? report;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.examReport(widget.attemptId);
      setState(() {
        report = d;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Map<String, dynamic> get attempt => Map<String, dynamic>.from(report?['attempt'] ?? {});
  Map<String, dynamic> get paper => Map<String, dynamic>.from(report?['paper'] ?? {});
  List<Map<String, dynamic>> get items =>
      (report?['items'] as List<dynamic>? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();

  int get usedMinutes {
    final s = attempt['started_at'];
    final e = attempt['submitted_at'];
    if (s is! num || e is! num || e <= s) return 0;
    return ((e - s) / 60).round();
  }

  int get wrongCount => items.where((r) => (r['picked'] ?? '') != '' && r['correct'] != true).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('成绩报告')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!, style: const TextStyle(color: KgColors.t3)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _hero(),
                    const SizedBox(height: 12),
                    RankCard(attemptId: widget.attemptId),
                    const SizedBox(height: 12),
                    _modules(),
                    const SizedBox(height: 12),
                    _grid(),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                                minimumSize: const Size.fromHeight(46)),
                            onPressed: () => context.pop(),
                            child: const Text('返回卷库'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: FilledButton(
                            onPressed: () => context.go('/book'),
                            child: Text(wrongCount > 0 ? '复盘 $wrongCount 道错题' : '查看错题本'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
    );
  }

  Widget _hero() {
    final score = attempt['score'] ?? 0;
    final answered = report?['answered'] ?? 0;
    final correct = report?['correct'] ?? 0;
    final total = report?['total'] ?? 0;
    final acc = answered == 0 ? 0 : (correct * 100 / answered).round();
    final fullAcc = total == 0 ? 0 : ((correct as num) * 100 / total).round();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [KgColors.gradStart, KgColors.brand],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: KgColors.brand.withValues(alpha: .3),
              blurRadius: 18,
              offset: const Offset(0, 6)),
        ],
      ),
      child: Column(
        children: [
          Text((paper['title'] ?? '').toString(),
              style: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: .85))),
          const SizedBox(height: 2),
          Text.rich(
            TextSpan(children: [
              TextSpan(
                  text: '$score',
                  style: const TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      fontFeatures: [FontFeature.tabularFigures()])),
              TextSpan(
                  text: ' 分',
                  style: TextStyle(fontSize: 16, color: Colors.white.withValues(alpha: .8))),
            ]),
          ),
          const SizedBox(height: 2),
          Text('答对 $correct/$total（已答 $answered）· 已答正确率 $acc% · 全卷正确率 $fullAcc% · 用时 $usedMinutes 分钟',
              style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: .85))),
        ],
      ),
    );
  }

  Widget _modules() {
    final pm = Map<String, dynamic>.from(attempt['per_module'] ?? {});
    if (pm.isEmpty) return const SizedBox.shrink();
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('模块得分', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            for (final e in pm.entries) _moduleRow(e.key, Map<String, dynamic>.from(e.value)),
          ],
        ),
      ),
    );
  }

  Widget _moduleRow(String mod, Map<String, dynamic> v) {
    final n = (v['n'] ?? 0) as int;
    final correct = (v['correct'] ?? 0) as int;
    final pct = n == 0 ? 0.0 : correct / n;
    final color = pct >= .8
        ? KgColors.success
        : pct >= .6
            ? (KgColors.moduleColors[mod] ?? KgColors.brand)
            : pct >= .5
                ? KgColors.warning
                : KgColors.error;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            child: Text(moduleName(mod),
                style: const TextStyle(fontSize: 13, color: KgColors.t2)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 8,
                backgroundColor: KgColors.fill,
                color: color,
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 56,
            child: Text('$correct/$n',
                textAlign: TextAlign.right,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()])),
          ),
        ],
      ),
    );
  }

  Widget _grid() {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('逐题对错（点击看解析）',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: KgColors.fill,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('错题已自动入本',
                      style: TextStyle(fontSize: 11, color: KgColors.t3)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 9,
                mainAxisSpacing: 7,
                crossAxisSpacing: 7,
                childAspectRatio: 34 / 30,
              ),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final r = items[i];
                final answered = (r['picked'] ?? '') != '';
                final Color bg = !answered
                    ? KgColors.fill
                    : r['correct'] == true
                        ? KgColors.successBg
                        : KgColors.errorBg;
                final Color fg = !answered
                    ? KgColors.t3
                    : r['correct'] == true
                        ? KgColors.success
                        : KgColors.error;
                return InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () => _showDetail(r),
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: bg,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('${r['no']}',
                        style: TextStyle(fontSize: 11.5, color: fg)),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showDetail(Map<String, dynamic> r) {
    final opts = <String, String>{};
    final rawOpts = r['options'];
    if (rawOpts is Map) rawOpts.forEach((k, v) => opts[k.toString()] = v.toString());
    final explanation =
        (r['explanation'] ?? r['hs_explanation'] ?? '').toString().trim();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: .7,
        maxChildSize: .92,
        builder: (c, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                    color: KgColors.border, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            Row(
              children: [
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: KgColors.brand50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(moduleName(r['module']?.toString()),
                      style: const TextStyle(fontSize: 11, color: KgColors.brand)),
                ),
                const Spacer(),
                Icon(
                  r['correct'] == true ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
                  size: 18,
                  color: r['correct'] == true ? KgColors.success : KgColors.error,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('${r['no']}. ${r['question'] ?? ''}',
                style: const TextStyle(fontSize: 15, height: 1.7)),
            const SizedBox(height: 12),
            for (final e in opts.entries) _detailOption(r, e.key, e.value),
            const SizedBox(height: 8),
            Text(
              '我的答案 ${(r['picked'] ?? '').toString().isEmpty ? '未作答' : r['picked']} · 正确答案 ${r['answer']}',
              style: const TextStyle(fontSize: 13, color: KgColors.t3),
            ),
            if (explanation.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: KgColors.brand50.withValues(alpha: .5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('解析', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(explanation, style: const TextStyle(fontSize: 14, height: 1.65)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailOption(Map<String, dynamic> r, String k, String v) {
    Color border = KgColors.border;
    Color? bgc;
    if (k == (r['answer'] ?? '')) {
      border = KgColors.success;
      bgc = KgColors.successBg;
    } else if (k == (r['picked'] ?? '') && r['correct'] != true) {
      border = KgColors.error;
      bgc = KgColors.errorBg;
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bgc,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$k.', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(width: 8),
          Expanded(child: Text(v, style: const TextStyle(fontSize: 14, height: 1.5))),
        ],
      ),
    );
  }
}
