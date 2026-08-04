import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 申论题目详情：作答要求 + 给定资料 + 作答区（草稿本机自动保存）+ AI 批改 + 历史作答 + 参考要点。
class ShenlunDetailPage extends StatefulWidget {
  const ShenlunDetailPage({super.key, required this.qid});

  final int qid;

  @override
  State<ShenlunDetailPage> createState() => _ShenlunDetailPageState();
}

class _ShenlunDetailPageState extends State<ShenlunDetailPage> {
  Map<String, dynamic>? detail;
  bool loading = true;
  String? error;
  bool showMat = true;
  bool showRef = false;
  bool showHist = false;
  bool grading = false;
  String gradeResult = '';
  String? gradeError;
  List<dynamic> history = [];
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: Store.instance.slDraft(widget.qid));
    _ctrl.addListener(() {
      Store.instance.setSlDraft(widget.qid, _ctrl.text);
      setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final d = await Api.shenlunQuestion(widget.qid);
      setState(() {
        detail = d;
        loading = false;
      });
      _loadHistory();
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Future<void> _loadHistory() async {
    try {
      final items = await Api.shenlunHistory(qid: widget.qid);
      if (mounted) setState(() => history = items);
    } catch (_) {/* 历史加载失败不阻断 */}
  }

  Future<void> _grade() async {
    final answer = _ctrl.text.trim();
    if (grading || answer.isEmpty) return;
    setState(() {
      grading = true;
      gradeResult = '';
      gradeError = null;
    });
    try {
      final result = await Api.shenlunGrade(widget.qid, answer);
      setState(() {
        gradeResult = result;
        grading = false;
      });
      Store.instance.setSlDraft(widget.qid, '');
      _loadHistory();
    } catch (e) {
      setState(() {
        grading = false;
        gradeError = Api.errMsg(e);
      });
    }
  }

  Future<void> _promptAccessCode() async {
    final ctrl = TextEditingController(text: Store.instance.accessCode);
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('请输入访问码'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: '访问码'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim()),
              child: const Text('保存')),
        ],
      ),
    );
    if (code != null && code.isNotEmpty) {
      Store.instance.accessCode = code;
      setState(() => gradeError = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('访问码已保存，请重新发起批改')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('申论作答')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(error!, style: const TextStyle(color: KgColors.t3)),
                      const SizedBox(height: 16),
                      FilledButton(
                          style: FilledButton.styleFrom(
                              minimumSize: const Size(160, 44)),
                          onPressed: _load,
                          child: const Text('重试')),
                    ],
                  ),
                )
              : _body(),
    );
  }

  Widget _body() {
    final d = detail!;
    final paper = (d['paper'] ?? '').toString().isNotEmpty
        ? d['paper'].toString()
        : '${d['exam_year'] ?? ''} · ${d['exam_region'] ?? ''}';
    final wordCount = _ctrl.text.replaceAll(RegExp(r'\s'), '').length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            _tag(paper, KgColors.warning),
            const Spacer(),
            _tag((d['qtype'] ?? '申论').toString(), KgColors.brand),
          ],
        ),
        const SizedBox(height: 14),
        const _SecTitle('作答要求'),
        Text((d['question'] ?? '').toString(),
            style: const TextStyle(fontSize: 15, height: 1.7)),
        const SizedBox(height: 14),
        InkWell(
          onTap: () => setState(() => showMat = !showMat),
          child: Row(
            children: [
              const Text('给定资料',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: KgColors.brand)),
              Icon(showMat ? LucideIcons.chevronUp : LucideIcons.chevronDown,
                  size: 16, color: KgColors.brand),
            ],
          ),
        ),
        if (showMat) ...[
          const SizedBox(height: 8),
          Text((d['material'] ?? '').toString(),
              style: const TextStyle(
                  fontSize: 14, height: 1.8, color: KgColors.t2)),
        ],
        const SizedBox(height: 14),
        Row(
          children: [
            const _SecTitle('我的作答'),
            const Spacer(),
            Text('$wordCount 字 · 草稿自动保存',
                style: const TextStyle(fontSize: 12, color: KgColors.t3)),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _ctrl,
          maxLines: null,
          minLines: 6,
          maxLength: 3000,
          decoration: const InputDecoration(
            hintText: '在此作答后点击下方按钮，AI 按采分点批改（大作文为结构点评+参考档位）。草稿自动保存在本机',
            hintStyle: TextStyle(fontSize: 13, color: KgColors.t4),
            border: OutlineInputBorder(),
          ),
          style: const TextStyle(fontSize: 14, height: 1.7),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed:
              grading || _ctrl.text.trim().isEmpty ? null : _grade,
          child: Text(grading ? 'AI 批改中…' : '提交 AI 批改'),
        ),
        if (gradeError != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: KgColors.errorBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('批改失败：$gradeError',
                    style:
                        const TextStyle(fontSize: 13, color: KgColors.error)),
                if (gradeError!.contains('访问码'))
                  TextButton(
                    onPressed: _promptAccessCode,
                    child: const Text('填写访问码',
                        style: TextStyle(fontSize: 13)),
                  ),
              ],
            ),
          ),
        ],
        if (gradeResult.isNotEmpty) ...[
          const SizedBox(height: 14),
          Row(
            children: const [
              _SecTitle('批改结果'),
              Text('（AI 参考，非官方评分）',
                  style: TextStyle(fontSize: 12, color: KgColors.t3)),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: KgColors.brand50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(gradeResult,
                style: const TextStyle(fontSize: 13.5, height: 1.8)),
          ),
        ],
        if (history.isNotEmpty) ...[
          const SizedBox(height: 14),
          InkWell(
            onTap: () => setState(() => showHist = !showHist),
            child: Row(
              children: [
                Text('历史作答（${history.length}）',
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: KgColors.brand)),
                Icon(
                    showHist
                        ? LucideIcons.chevronUp
                        : LucideIcons.chevronDown,
                    size: 16,
                    color: KgColors.brand),
              ],
            ),
          ),
          if (showHist) ...[
            const SizedBox(height: 8),
            for (final h in history) _histItem(Map<String, dynamic>.from(h)),
          ],
        ],
        const SizedBox(height: 14),
        InkWell(
          onTap: () => setState(() => showRef = !showRef),
          child: Text(
            showRef ? '收起参考要点 ▲' : '写完再看 · 参考要点 ▼',
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: KgColors.warning),
          ),
        ),
        if (showRef) ...[
          const SizedBox(height: 8),
          Text((detail!['reference'] ?? '').toString(),
              style: const TextStyle(
                  fontSize: 14, height: 1.8, color: KgColors.t2)),
          if ((detail!['notes'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text((detail!['notes'] ?? '').toString(),
                style: const TextStyle(
                    fontSize: 13, height: 1.7, color: KgColors.t3)),
          ],
        ],
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _histItem(Map<String, dynamic> h) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KgColors.fill,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(fmtTime(h['created_at'] as num?),
              style: const TextStyle(fontSize: 11, color: KgColors.t3)),
          const SizedBox(height: 4),
          Text((h['answer'] ?? '').toString(),
              maxLines: 6,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, height: 1.7)),
          if ((h['result'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: KgColors.warningBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text((h['result'] ?? '').toString(),
                  style: const TextStyle(
                      fontSize: 12.5, height: 1.7, color: KgColors.t2)),
            ),
          ],
        ],
      ),
    );
  }

  static String fmtTime(num? ts) {
    final d = DateTime.fromMillisecondsSinceEpoch(((ts ?? 0) * 1000).toInt());
    String p(int n) => n < 10 ? '0$n' : '$n';
    return '${d.year}-${p(d.month)}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}';
  }

  Widget _tag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _SecTitle extends StatelessWidget {
  const _SecTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700));
}
