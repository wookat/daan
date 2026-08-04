import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/providers.dart';
import '../theme.dart';
import '../widgets/export_sheet.dart';

/// 练习答题页：取题 → 作答 → 判分 → 解析 → 上报 answer_log；答错自动入错题本。
/// mode: normal（专项/综合）| redo（错题重练）| review（今日复习，按遗忘曲线记录）
class PracticePage extends ConsumerStatefulWidget {
  const PracticePage({super.key, this.module, this.mode = 'normal'});

  final String? module;
  final String mode;

  @override
  ConsumerState<PracticePage> createState() => _PracticePageState();
}

class _PracticePageState extends ConsumerState<PracticePage> {
  List<Question> items = [];
  int idx = 0;
  bool loading = true;
  String? error;
  bool finished = false;
  DateTime _qStart = DateTime.now();
  Timer? _ticker;
  int elapsed = 0;
  final Set<int> favedIds = {};

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !finished) setState(() => elapsed++);
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      finished = false;
      idx = 0;
      elapsed = 0;
    });
    try {
      List<Question> qs;
      if (widget.mode == 'redo') {
        final raw = await Api.mistakesRedo(limit: 10, module: widget.module);
        qs = raw.map((e) => Question.fromJson(Map<String, dynamic>.from(e))).toList();
      } else if (widget.mode == 'review') {
        final d = await Api.reviewDue();
        final raw = (d['items'] as List<dynamic>? ?? []);
        qs = raw
            .map((e) {
              final m = Map<String, dynamic>.from(e);
              return _questionFromMistake(m);
            })
            .whereType<Question>()
            .toList();
      } else {
        final d = await Api.questions(module: widget.module, limit: 10);
        qs = (d['items'] as List<dynamic>)
            .map((e) => Question.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      if (qs.isEmpty) {
        setState(() {
          loading = false;
          error = widget.mode == 'review' ? '今日没有到期错题，去刷新题吧' : '暂无题目';
        });
        return;
      }
      setState(() {
        items = qs;
        loading = false;
        _qStart = DateTime.now();
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  /// 复习队列条目 → 可作答题目（question_text 内含选项行时拆出）
  Question? _questionFromMistake(Map<String, dynamic> m) {
    final text = (m['question_text'] ?? '').toString();
    final answer = (m['correct_answer'] ?? '').toString().trim();
    if (text.isEmpty || answer.isEmpty) return null;
    var stem = text;
    final opts = <String, String>{};
    final nl = text.lastIndexOf('\n');
    if (nl > 0) {
      final optLine = text.substring(nl + 1);
      final matches = RegExp(r'([A-D])\.').allMatches(optLine).toList();
      if (matches.length >= 2) {
        stem = text.substring(0, nl);
        for (var i = 0; i < matches.length; i++) {
          final start = matches[i].end;
          final end = i + 1 < matches.length ? matches[i + 1].start : optLine.length;
          opts[matches[i].group(1)!] = optLine.substring(start, end).trim();
        }
      }
    }
    return Question(
      id: m['question_id'] is int ? m['question_id'] as int : null,
      question: stem,
      options: opts,
      answer: answer,
      module: m['module']?.toString(),
      questionType: m['question_type']?.toString(),
      explanation: m['explanation']?.toString(),
      mistakeId: m['id'] as int?,
    );
  }

  Question get cur => items[idx];

  Future<void> _pick(String k) async {
    if (cur.answered) return;
    setState(() {
      cur.picked = k;
      cur.secs = DateTime.now().difference(_qStart).inSeconds;
    });
    if (widget.mode == 'review' && cur.mistakeId != null) {
      // 遗忘曲线复习打卡
      unawaited(Api.recordReview(cur.mistakeId!, cur.correct).catchError((_) => <String, dynamic>{}));
    } else if (!cur.correct && !cur.savedAsMistake) {
      cur.savedAsMistake = true;
      final optText = cur.options.entries.map((e) => '${e.key}.${e.value}').join(' ');
      unawaited(Api.saveMistake({
        'question_id': cur.id,
        'module': cur.module,
        'question_type': cur.questionType ?? cur.submodule,
        'question_text': '${cur.question}\n$optText',
        'user_answer': k,
        'correct_answer': cur.answer,
        'explanation': cur.explanation ?? '',
      }).catchError((_) => null));
    }
  }

  void _next() {
    if (idx < items.length - 1) {
      setState(() {
        idx++;
        _qStart = DateTime.now();
      });
    } else {
      _finish();
    }
  }

  Future<void> _finish() async {
    setState(() => finished = true);
    final answered = items.where((q) => q.answered && !q.logged).toList();
    if (answered.isEmpty) return;
    ref.read(todayCountProvider.notifier).add(answered.length);
    final logItems = answered
        .map((q) => {
              'qid': q.id,
              'module': q.module ?? widget.module,
              'submodule': q.submodule,
              'correct': q.correct,
              'secs': q.secs,
              'picked': q.picked,
            })
        .toList();
    try {
      await Api.answerLog(logItems);
      for (final q in answered) {
        q.logged = true;
      }
      final right = answered.where((q) => q.correct).length;
      final secs = answered.fold<int>(0, (s, q) => s + q.secs);
      unawaited(Api.practiceResult(widget.module ?? '', answered.length, right, secs)
          .catchError((_) {}));
    } catch (_) {/* 非关键路径：断网不阻塞结算 */}
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.mode) {
      'redo' => '错题重练',
      'review' => '今日复习',
      _ => moduleName(widget.module),
    };
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (!loading && error == null && !finished)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  '${(elapsed ~/ 60).toString().padLeft(2, '0')}:${(elapsed % 60).toString().padLeft(2, '0')}',
                  style: const TextStyle(fontSize: 14, color: KgColors.t3),
                ),
              ),
            ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? _ErrorView(message: error!, onRetry: _load)
              : finished
                  ? _resultView()
                  : _questionView(),
    );
  }

  Widget _questionView() {
    final q = cur;
    return Column(
      children: [
        LinearProgressIndicator(
          value: (idx + 1) / items.length,
          minHeight: 3,
          backgroundColor: KgColors.fill,
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  _tag(moduleName(q.module), KgColors.moduleColors[q.module] ?? KgColors.brand),
                  if (q.questionType != null && q.questionType!.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    _tag(q.questionType!, KgColors.t3),
                  ],
                  const Spacer(),
                  Text('${idx + 1}/${items.length}',
                      style: const TextStyle(color: KgColors.t3, fontSize: 13)),
                ],
              ),
              const SizedBox(height: 12),
              Text(q.question, style: const TextStyle(fontSize: 16, height: 1.7)),
              const SizedBox(height: 16),
              for (final e in q.options.entries) _option(q, e.key, e.value),
              if (q.answered) ...[
                const SizedBox(height: 16),
                _explainCard(q),
              ],
            ],
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: q.answered
                ? FilledButton(
                    onPressed: _next,
                    child: Text(idx < items.length - 1 ? '下一题' : '完成本组'),
                  )
                : OutlinedButton(
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                    onPressed: _finish,
                    child: const Text('提前结束'),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _option(Question q, String k, String v) {
    Color border = KgColors.border;
    Color? bgc;
    Widget? trailing;
    if (q.answered) {
      if (k == q.answer) {
        border = KgColors.success;
        bgc = KgColors.successBg;
        trailing = const Text('✓ 正确', style: TextStyle(color: KgColors.success, fontSize: 12));
      } else if (k == q.picked) {
        border = KgColors.error;
        bgc = KgColors.errorBg;
        trailing = const Text('✕ 我的选择', style: TextStyle(color: KgColors.error, fontSize: 12));
      }
    }
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => _pick(k),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: bgc ?? (dark ? const Color(0xFF1A1C22) : Colors.white),
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Text('$k.', style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              Expanded(child: Text(v, style: const TextStyle(fontSize: 15, height: 1.5))),
              if (trailing != null) trailing,
            ],
          ),
        ),
      ),
    );
  }

  Widget _explainCard(Question q) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KgColors.brand50.withValues(alpha: Theme.of(context).brightness == Brightness.dark ? .12 : 1),
            Theme.of(context).cardTheme.color ?? Colors.white,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KgColors.border.withValues(alpha: .6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(q.correct ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
                  size: 18, color: q.correct ? KgColors.success : KgColors.error),
              const SizedBox(width: 6),
              Text(q.correct ? '回答正确' : '回答错误，已自动存入错题本',
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: q.correct ? KgColors.success : KgColors.error)),
            ],
          ),
          const SizedBox(height: 10),
          Text('正确答案：${q.answer}', style: const TextStyle(fontWeight: FontWeight.w600)),
          if (q.explanation != null && q.explanation!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(q.explanation!, style: const TextStyle(fontSize: 14, height: 1.6)),
          ],
          if (q.id != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _explainOp(
                  favedIds.contains(q.id) ? LucideIcons.star : LucideIcons.star,
                  favedIds.contains(q.id) ? '已收藏' : '收藏',
                  () => _toggleFav(q),
                  color: favedIds.contains(q.id) ? KgColors.warning : KgColors.t3,
                ),
                const SizedBox(width: 24),
                _explainOp(LucideIcons.penTool, '写笔记', () => _writeNote(q)),
                const SizedBox(width: 24),
                _explainOp(LucideIcons.messagesSquare, '讨论区',
                    () => context.push('/discuss?qid=${q.id}')),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _explainOp(IconData icon, String label, VoidCallback onTap,
      {Color color = KgColors.t3}) {
    return InkWell(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 13, color: color)),
        ],
      ),
    );
  }

  Future<void> _toggleFav(Question q) async {
    final id = q.id!;
    final on = !favedIds.contains(id);
    setState(() => on ? favedIds.add(id) : favedIds.remove(id));
    try {
      if (on) {
        await Api.setFav(id);
      } else {
        await Api.removeFav(id);
      }
    } catch (e) {
      setState(() => on ? favedIds.remove(id) : favedIds.add(id));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _writeNote(Question q) async {
    final ctrl = TextEditingController();
    final content = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('写笔记'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 4,
          maxLength: 500,
          decoration: const InputDecoration(hintText: '记下解题思路、易错点…'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim()),
              child: const Text('保存')),
        ],
      ),
    );
    if (content == null || content.isEmpty) return;
    try {
      await Api.saveNote(q.id!, content);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('笔记已保存')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Widget _resultView() {
    final answered = items.where((q) => q.answered).toList();
    final right = answered.where((q) => q.correct).length;
    final pct = answered.isEmpty ? 0 : (right * 100 / answered.length).round();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('$pct%',
                style: const TextStyle(fontSize: 48, fontWeight: FontWeight.w800, color: KgColors.brand)),
            const SizedBox(height: 4),
            Text('答对 $right/${answered.length} 题 · 用时 ${elapsed ~/ 60} 分 ${elapsed % 60} 秒',
                style: const TextStyle(color: KgColors.t3)),
            const SizedBox(height: 32),
            FilledButton(onPressed: _load, child: const Text('再来一组')),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () => showExportSheet(
                context,
                title: '自定义练习',
                questionIds: [
                  for (final q in items)
                    if (q.id != null) q.id!,
                ],
                rawItems: [
                  for (final q in items)
                    if (q.id == null)
                      {
                        'question':
                            '${q.question}\n${q.options.entries.map((e) => '${e.key}.${e.value}').join(' ')}',
                        'answer': q.answer,
                        'explanation': q.explanation ?? '',
                      },
                ],
              ),
              child: const Text('导出本组 PDF'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: () {
                context.pop();
              },
              child: const Text('返回'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(LucideIcons.cloudOff, size: 48, color: KgColors.t4),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: KgColors.t3)),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
            onPressed: onRetry,
            child: const Text('重试'),
          ),
        ],
      ),
    );
  }
}
