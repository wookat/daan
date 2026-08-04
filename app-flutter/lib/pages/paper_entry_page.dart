import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 手动录入答案：输入卷码 → 题号 + ABCD 点选 → 交卷判分。
class PaperEntryPage extends StatefulWidget {
  const PaperEntryPage({super.key});

  @override
  State<PaperEntryPage> createState() => _PaperEntryPageState();
}

class _PaperEntryPageState extends State<PaperEntryPage> {
  final _codeCtrl = TextEditingController();
  bool looking = false;
  Map<String, dynamic>? paper;
  final Map<int, String> picks = {};
  bool submitting = false;
  Map<String, dynamic>? result;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final code = _codeCtrl.text.trim().toUpperCase();
    if (code.isEmpty) return;
    setState(() {
      looking = true;
      result = null;
    });
    try {
      final d = await Api.paperInfo(code);
      setState(() {
        paper = d;
        picks.clear();
        looking = false;
      });
    } catch (e) {
      setState(() => looking = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _submit() async {
    if (picks.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('还没有选择任何答案')));
      return;
    }
    setState(() => submitting = true);
    try {
      final d = await Api.paperAnswers(
        (paper!['code'] ?? '').toString(),
        picks.map((k, v) => MapEntry('$k', v)),
      );
      setState(() {
        result = d;
        submitting = false;
      });
    } catch (e) {
      setState(() => submitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('判分失败：${Api.errMsg(e)}')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('手动录入答案')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _codeCard(),
          if (paper != null && result == null) ...[
            const SizedBox(height: 12),
            _entryCard(),
          ],
          if (result != null) ...[
            const SizedBox(height: 12),
            ResultCard(result: result!),
          ],
        ],
      ),
      bottomNavigationBar: paper == null || result != null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton(
                  onPressed: submitting ? null : _submit,
                  child: Text(submitting ? '判分中…' : '交卷判分（已选 ${picks.length}/${paper!['n']}）'),
                ),
              ),
            ),
    );
  }

  Widget _codeCard() {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('输入卷码', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('卷码在导出试卷 PDF 的右上角/封面',
                style: TextStyle(fontSize: 12, color: KgColors.t3)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _codeCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      hintText: '如 A1B2C3D4',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onSubmitted: (_) => _lookup(),
                  ),
                ),
                const SizedBox(width: 10),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(88, 44)),
                  onPressed: looking ? null : _lookup,
                  child: Text(looking ? '查询中' : '查询'),
                ),
              ],
            ),
            if (paper != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(LucideIcons.fileText, size: 16, color: KgColors.brand),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${paper!['title'] ?? '试卷'} · ${paper!['n']} 题 · 卷码 ${paper!['code']}',
                      style: const TextStyle(fontSize: 13, color: KgColors.t2),
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

  Widget _entryCard() {
    final n = (paper!['n'] ?? 0) as int;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('点选答案', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            for (var i = 1; i <= n; i++) _row(i),
          ],
        ),
      ),
    );
  }

  Widget _row(int no) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text('$no',
                style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontFeatures: [FontFeature.tabularFigures()])),
          ),
          for (final o in const ['A', 'B', 'C', 'D'])
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(8),
                onTap: () => setState(() {
                  if (picks[no] == o) {
                    picks.remove(no);
                  } else {
                    picks[no] = o;
                  }
                }),
                child: Container(
                  width: 44,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: picks[no] == o ? KgColors.brand : KgColors.fill,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(o,
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: picks[no] == o ? Colors.white : KgColors.t2)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 判分结果卡（手动录入 / 扫描答题卡共用，对应 _judge_paper 返回结构）。
class ResultCard extends StatelessWidget {
  const ResultCard({super.key, required this.result});

  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final items = (result['items'] as List<dynamic>? ?? [])
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final total = result['total'] ?? items.length;
    final answered = result['answered'] ?? 0;
    final correct = result['correct'] ?? 0;
    final acc = answered == 0 ? 0 : ((correct as num) * 100 / (answered as num)).round();
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('判分结果',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: KgColors.successBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('答对 $correct/$answered · 正确率 $acc%',
                      style: const TextStyle(fontSize: 11, color: KgColors.success)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('共 $total 题 · 已答 $answered 题 · 错题已自动入错题本',
                style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 6,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 52 / 32,
              ),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final r = items[i];
                final status = (r['status'] ?? '').toString();
                final Color bg = status != 'ok'
                    ? KgColors.warningBg
                    : r['correct'] == true
                        ? KgColors.successBg
                        : KgColors.errorBg;
                final Color fg = status != 'ok'
                    ? KgColors.warning
                    : r['correct'] == true
                        ? KgColors.success
                        : KgColors.error;
                final label = status == 'blank'
                    ? '?'
                    : status == 'multi'
                        ? '多'
                        : (r['picked'] ?? '').toString();
                return Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('${r['no']} $label',
                      style: TextStyle(fontSize: 12, color: fg)),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
