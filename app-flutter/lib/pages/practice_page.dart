import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/offline.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/export_sheet.dart';

/// 练习答题页：取题 → 作答 → 判分 → 解析 → 上报 answer_log；答错自动入错题本。
/// mode: normal（专项/综合）| redo（错题重练）| review（今日复习，按遗忘曲线记录）
class PracticePage extends ConsumerStatefulWidget {
  const PracticePage({
    super.key,
    this.module,
    this.mode = 'normal',
    this.submodule,
    this.count,
    this.source,
    this.title,
  });

  final String? module;
  final String mode;

  /// 二级题型（考点）筛选。
  final String? submodule;

  /// 本组题量（默认取练习设置 groupSize）。
  final int? count;

  /// 真题卷来源（mode=paper 时整卷连做）。
  final String? source;

  /// 页面标题覆盖（卷名等）。
  final String? title;

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
  bool offline = false; // 断网时使用本地题包，本地判分，作答入离线队列
  int _curStreak = 0; // 本组连对，用于更新 bestStreak 勋章

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
      } else if (widget.mode == 'paper' && widget.source != null) {
        final raw = await Api.paperQuestions(widget.source!);
        qs = raw.map((e) => Question.fromJson(Map<String, dynamic>.from(e))).toList();
      } else {
        offline = false;
        final n = widget.count ?? Store.instance.groupSize;
        final real = Store.instance.realMode;
        try {
          final d = await Api.questions(
            module: widget.module,
            submodule: widget.submodule,
            limit: n,
            real: real,
            year: real ? Store.instance.realYear : null,
            region: real ? Store.instance.realRegion : null,
          );
          qs = (d['items'] as List<dynamic>)
              .map((e) => Question.fromJson(Map<String, dynamic>.from(e)))
              .toList();
          unawaited(Offline.flushQueue());
        } on Exception {
          final local = Offline.drawOffline(widget.module, n);
          if (local == null) rethrow;
          offline = true;
          qs = local.map(Question.fromJson).toList();
        }
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
    if (cur.correct) {
      _curStreak++;
      if (_curStreak > Store.instance.bestStreak) {
        Store.instance.bestStreak = _curStreak;
      }
    } else {
      _curStreak = 0;
    }
    if (widget.mode == 'review' && cur.mistakeId != null) {
      // 遗忘曲线复习打卡
      unawaited(Api.recordReview(cur.mistakeId!, cur.correct).catchError((_) => <String, dynamic>{}));
    } else if (!cur.correct && !cur.savedAsMistake) {
      cur.savedAsMistake = true;
      final optText = cur.options.entries.map((e) => '${e.key}.${e.value}').join(' ');
      if (offline) {
        Offline.enqueueMistake({
          'uid': Api.uid(),
          'question_id': cur.id,
          'module': cur.module,
          'question_type': cur.questionType ?? cur.submodule,
          'question_text': '${cur.question}\n$optText',
          'user_answer': k,
          'correct_answer': cur.answer,
          'explanation': cur.explanation ?? '',
        });
        return;
      }
      final q = cur;
      unawaited(Api.saveMistake({
        'question_id': q.id,
        'module': q.module,
        'question_type': q.questionType ?? q.submodule,
        'question_text': '${q.question}\n$optText',
        'user_answer': k,
        'correct_answer': q.answer,
        'explanation': q.explanation ?? '',
      }).then((mid) => q.mistakeId ??= mid).catchError((_) => null));
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
    // 本地各模块统计（复刻 pstats.byModule，供首页进度展示）
    final byMod = <String, List<int>>{};
    for (final q in answered) {
      final m = (q.module ?? widget.module ?? '').toString();
      if (m.isEmpty) continue;
      final cur = byMod.putIfAbsent(m, () => [0, 0]);
      cur[0]++;
      if (q.correct) cur[1]++;
    }
    byMod.forEach((m, v) => Store.instance.addModuleStat(m, v[0], v[1]));
    // 本地练习记录（复刻 practiceHistory 键，供统计页展示）
    Store.instance.addPracticeHistory({
      't': DateTime.now().millisecondsSinceEpoch,
      'module': widget.module ?? '',
      'mode': widget.mode,
      'n': answered.length,
      'correct': answered.where((q) => q.correct).length,
      'secs': answered.fold<int>(0, (s, q) => s + q.secs),
    });
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
    if (offline) {
      final now = DateTime.now().millisecondsSinceEpoch;
      Offline.enqueueAnswers(Api.uid(), [
        for (var i = 0; i < logItems.length; i++) {...logItems[i], 't': now + i},
      ]);
      for (final q in answered) {
        q.logged = true;
      }
      return;
    }
    try {
      await Api.answerLog(logItems);
      for (final q in answered) {
        q.logged = true;
      }
      final right = answered.where((q) => q.correct).length;
      final secs = answered.fold<int>(0, (s, q) => s + q.secs);
      unawaited(Api.practiceResult(widget.module ?? '', answered.length, right, secs)
          .catchError((_) {}));
    } catch (_) {
      // 断网结算：入离线队列，联网后自动补传去重
      final now = DateTime.now().millisecondsSinceEpoch;
      Offline.enqueueAnswers(Api.uid(), [
        for (var i = 0; i < logItems.length; i++) {...logItems[i], 't': now + i},
      ]);
      for (final q in answered) {
        q.logged = true;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.mode) {
      'redo' => '错题重练',
      'review' => '今日复习',
      'paper' => widget.title ?? '真题卷',
      _ => widget.title ??
          (widget.submodule?.isNotEmpty == true
              ? widget.submodule!
              : moduleName(widget.module)),
    };
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          if (!loading && error == null && !finished)
            IconButton(
              tooltip: '答题卡',
              onPressed: _openAnswerCard,
              icon: const Icon(LucideIcons.layoutGrid, size: 18),
            ),
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
        if (offline)
          Container(
            width: double.infinity,
            color: KgColors.warningBg,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: const Text('离线模式 · 本地题包判分，联网后自动同步',
                style: TextStyle(fontSize: 11.5, color: KgColors.warning)),
          ),
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
              Text(q.question,
                  style: TextStyle(
                      fontSize: const [14.0, 16.0, 18.0, 20.0][
                          Store.instance.fontLv.clamp(0, 3)],
                      height: 1.7)),
              if (q.image != null && q.image!.isNotEmpty) ...[
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    _imgUrl(q.image!),
                    width: double.infinity,
                    fit: BoxFit.fitWidth,
                    errorBuilder: (c, e, s) => const SizedBox.shrink(),
                  ),
                ),
                if (q.imageCredit != null && q.imageCredit!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('图源：${q.imageCredit}',
                        style: const TextStyle(fontSize: 10, color: KgColors.t4)),
                  ),
              ],
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
          if (!q.correct) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('错因自评：',
                    style: TextStyle(fontSize: 12, color: KgColors.t3)),
                for (final rz in const ['粗心大意', '概念不清', '方法不会', '纯蒙的'])
                  InkWell(
                    onTap: () => _setReason(q, rz),
                    borderRadius: BorderRadius.circular(6),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: q.errorReason == rz
                            ? KgColors.brand
                            : KgColors.fill,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(rz,
                          style: TextStyle(
                              fontSize: 11,
                              color: q.errorReason == rz
                                  ? Colors.white
                                  : KgColors.t3)),
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Text('正确答案：${q.answer}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const Spacer(),
              if (q.secs > 0)
                Text('用时 ${q.secs}s',
                    style: const TextStyle(fontSize: 12, color: KgColors.t4)),
            ],
          ),
          if (q.source != null && q.source!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('出处：${q.source}',
                style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
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
            const SizedBox(height: 10),
            InkWell(
              onTap: q.reported ? null : () => _reportQuestion(q),
              child: Text(
                q.reported ? '已提交纠错，感谢反馈' : '题目有问题？纠错',
                style: TextStyle(
                    fontSize: 12,
                    color: q.reported ? KgColors.t4 : KgColors.brand),
              ),
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
            if (offline) ...[
              const SizedBox(height: 8),
              const Text('本组为离线作答，恢复网络后将自动同步（去重）',
                  style: TextStyle(fontSize: 12, color: KgColors.warning)),
            ],
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

  String _imgUrl(String p) =>
      p.startsWith('http') ? p : '${Api.baseUrl}$p';

  Future<void> _setReason(Question q, String rz) async {
    setState(() => q.errorReason = rz);
    if (q.mistakeId != null) {
      try {
        await Api.patchMistake(q.mistakeId!, {'error_reason': rz});
      } catch (_) {/* 非关键路径 */}
    }
  }

  /// 题目纠错（复刻 reportTypes）。
  Future<void> _reportQuestion(Question q) async {
    if (q.id == null) return;
    const types = ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'];
    final rtype = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text('题目纠错 · 选择问题类型',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(height: 6),
            for (final t in types)
              ListTile(
                dense: true,
                title: Text(t, style: const TextStyle(fontSize: 14)),
                onTap: () => Navigator.pop(c, t),
              ),
          ],
        ),
      ),
    );
    if (rtype == null || !mounted) return;
    try {
      await Api.questionReport(q.id!, rtype, '');
      setState(() => q.reported = true);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已提交，感谢反馈')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  /// 答题卡：全组题号网格，点击跳题。
  Future<void> _openAnswerCard() async {
    final jump = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('答题卡',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (var i = 0; i < items.length; i++)
                    InkWell(
                      onTap: () => Navigator.pop(c, i),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: 40,
                        height: 40,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: !items[i].answered
                              ? KgColors.fill
                              : items[i].correct
                                  ? KgColors.successBg
                                  : KgColors.errorBg,
                          borderRadius: BorderRadius.circular(8),
                          border: i == idx
                              ? Border.all(color: KgColors.brand, width: 1.5)
                              : null,
                        ),
                        child: Text('${i + 1}',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: !items[i].answered
                                    ? KgColors.t3
                                    : items[i].correct
                                        ? KgColors.success
                                        : KgColors.error)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              const Text('绿=对 红=错 灰=未作答，点题号可跳转',
                  style: TextStyle(fontSize: 11, color: KgColors.t4)),
            ],
          ),
        ),
      ),
    );
    if (jump != null && mounted) {
      setState(() {
        idx = jump;
        if (!items[jump].answered) _qStart = DateTime.now();
      });
    }
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
