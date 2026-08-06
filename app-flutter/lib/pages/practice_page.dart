import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/offline.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/export_sheet.dart';

/// 练习答题页：取题 → 作答 → 判分 → 解析 → 上报 answer_log；答错自动入错题本。
/// mode: normal（专项/综合）| redo（错题重练）| review（今日复习，按遗忘曲线记录）| reinforce（同考点强化，只出未做过的新题）
class PracticePage extends ConsumerStatefulWidget {
  const PracticePage({
    super.key,
    this.module,
    this.mode = 'normal',
    this.submodule,
    this.count,
    this.source,
    this.title,
    this.tag3,
  });

  final String? module;
  final String mode;

  /// 三级考点（tag3）筛选。
  final String? tag3;

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
  int _bestInGroup = 0; // 本组最高连对（结算展示）
  int qsecs = 0; // 当前题已用秒数（限时训练倒计时用）
  bool beiMode = Store.instance.beiMode;
  bool timedMode = Store.instance.timedMode;
  bool autoNext = Store.instance.autoNext;
  bool sfxOn = Store.instance.sfxOn;
  int fontLv = Store.instance.fontLv;
  final Map<int, String> hsRated = {}; // 花生解析评价状态 qid -> up/down
  int? percentile; // 本组正确率全站分位
  Timer? _autoTimer;
  Map<String, dynamic>? reinforcePicked; // 复习完成后的同考点强化候选

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !finished) {
        setState(() {
          elapsed++;
          if (!loading && error == null && items.isNotEmpty && !cur.answered) {
            qsecs = DateTime.now().difference(_qStart).inSeconds;
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _autoTimer?.cancel();
    // 中途退出也上报已答题目，保证做题记录/累计统计不丢（与 H5 quit 一致）
    unawaited(_flushLog());
    super.dispose();
  }

  /// 上报尚未记录的已答题目（answer_log）；失败/离线时入本地队列待同步。
  /// 返回是否已直接上报成功。
  Future<bool> _flushLog() async {
    final answered = items.where((q) => q.answered && !q.logged).toList();
    if (answered.isEmpty) return true;
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
    void markLogged() {
      for (final q in answered) {
        q.logged = true;
      }
    }
    if (offline) {
      final now = DateTime.now().millisecondsSinceEpoch;
      Offline.enqueueAnswers(Api.uid(), [
        for (var i = 0; i < logItems.length; i++) {...logItems[i], 't': now + i},
      ]);
      markLogged();
      return false;
    }
    try {
      await Api.answerLog(logItems);
      markLogged();
      return true;
    } catch (_) {
      // 断网：入离线队列，联网后自动补传去重
      final now = DateTime.now().millisecondsSinceEpoch;
      Offline.enqueueAnswers(Api.uid(), [
        for (var i = 0; i < logItems.length; i++) {...logItems[i], 't': now + i},
      ]);
      markLogged();
      return false;
    }
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      finished = false;
      idx = 0;
      elapsed = 0;
      reinforcePicked = null;
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
      } else if (widget.mode == 'reinforce') {
        final d = await Api.reinforceQuestions(
          module: widget.module,
          submodule: widget.submodule,
          tag3: widget.tag3,
          limit: widget.count ?? 5,
        );
        final raw = (d['items'] as List<dynamic>? ?? []);
        qs = raw.map((e) => Question.fromJson(Map<String, dynamic>.from(e))).toList();
      } else if (widget.mode == 'paper' && widget.source != null) {
        final raw = await Api.paperQuestions(widget.source!);
        qs = raw.map((e) => Question.fromJson(Map<String, dynamic>.from(e))).toList();
      } else {
        offline = false;
        final n = widget.count ?? Store.instance.groupSize;
        final real = Store.instance.realMode;
        try {
          // 资料分析无二级/考点筛选时按同材料题组取题（复刻 grouped=1）
          final grouped = widget.module == 'ziliao' &&
              (widget.submodule == null || widget.submodule!.isEmpty) &&
              (widget.tag3 == null || widget.tag3!.isEmpty) &&
              !real;
          final d = await Api.questions(
            module: widget.module,
            submodule: widget.submodule,
            tag3: widget.tag3,
            limit: n,
            real: real,
            year: real ? Store.instance.realYear : null,
            region: real ? Store.instance.realRegion : null,
            grouped: grouped,
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
          error = widget.mode == 'review'
              ? '今日没有到期错题，去刷新题吧'
              : widget.mode == 'reinforce'
                  ? '该考点暂无未做过的新题，换个考点试试'
                  : '暂无题目';
        });
        return;
      }
      setState(() {
        items = qs;
        loading = false;
        _curStreak = 0;
        _bestInGroup = 0;
        percentile = null;
        qsecs = 0;
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
    if (cur.answered || beiMode) return;
    setState(() {
      cur.picked = k;
      cur.secs = DateTime.now().difference(_qStart).inSeconds;
    });
    if (sfxOn) {
      unawaited(cur.correct
          ? HapticFeedback.lightImpact()
          : HapticFeedback.heavyImpact());
    }
    if (cur.correct) {
      _curStreak++;
      if (_curStreak > _bestInGroup) _bestInGroup = _curStreak;
      if (_curStreak > Store.instance.bestStreak) {
        Store.instance.bestStreak = _curStreak;
      }
      // 答对自动跳下一题（复刻 autoNext，停留 1.2s 看判定后跳转）
      if (autoNext && idx < items.length - 1) {
        _autoTimer?.cancel();
        _autoTimer = Timer(const Duration(milliseconds: 1200), () {
          if (mounted && !finished && cur.answered && cur.correct) _next();
        });
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
    _autoTimer?.cancel();
    if (idx < items.length - 1) {
      _goTo(idx + 1);
    } else {
      _finish();
    }
  }

  void _goTo(int i) {
    if (i < 0 || i >= items.length || i == idx) return;
    setState(() {
      idx = i;
      qsecs = 0;
      _qStart = DateTime.now();
    });
  }

  /// 答题卡：网格展示全组题号与对/错/未答状态，支持跳题。
  Future<void> _openAnswerCard() async {
    final kg = context.kg;
    final target = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).cardTheme.color,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (c) {
        final answered = items.where((q) => q.answered).length;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('答题卡',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text('已答 $answered/${items.length}',
                        style: TextStyle(fontSize: 13, color: kg.t3)),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      _answerCardChip(i, () => Navigator.pop(c, i)),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    _legend(KgColors.success, '答对'),
                    const SizedBox(width: 16),
                    _legend(KgColors.error, '答错'),
                    const SizedBox(width: 16),
                    _legend(kg.t4, '未答'),
                  ],
                ),
                const SizedBox(height: 18),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                  onPressed: () => Navigator.pop(c, -1),
                  child: const Text('提前交卷结算'),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (!mounted || target == null) return;
    if (target < 0) {
      _finish();
    } else {
      _goTo(target);
    }
  }

  Widget _answerCardChip(int i, VoidCallback onTap) {
    final q = items[i];
    final kg = context.kg;
    Color fg = kg.t2;
    Color bg = kg.fill;
    Color? bd;
    if (q.answered) {
      fg = q.correct ? KgColors.success : KgColors.error;
      bg = (q.correct ? KgColors.success : KgColors.error).withValues(alpha: .12);
    }
    if (i == idx) bd = KgColors.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: bd == null ? null : Border.all(color: bd, width: 2),
        ),
        child: Text('${i + 1}',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: fg)),
      ),
    );
  }

  Widget _legend(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color.withValues(alpha: .18), shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12, color: context.kg.t3)),
      ],
    );
  }

  Future<void> _finish() async {
    setState(() => finished = true);
    if (widget.mode == 'review') {
      unawaited(Api.reinforceSuggest().then((d) {
        final p = d['picked'];
        if (p is Map && mounted) {
          setState(() => reinforcePicked = Map<String, dynamic>.from(p));
        }
      }).catchError((_) {}));
    }
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
    final ok = await _flushLog();
    if (ok) {
      final right = answered.where((q) => q.correct).length;
      final secs = answered.fold<int>(0, (s, q) => s + q.secs);
      unawaited(Api
          .practiceResult(widget.module ?? '', answered.length, right, secs)
          .then((d) {
        if (mounted && d['percentile'] != null) {
          setState(() => percentile = (d['percentile'] as num).toInt());
        }
      }).catchError((_) {}));
      _markDailyDone();
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = switch (widget.mode) {
      'redo' => '错题重练',
      'review' => '今日复习',
      'reinforce' => widget.title ?? '同考点强化',
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
          if (!loading && error == null && !finished && _curStreak >= 3)
            Center(
              child: Row(children: [
                const Icon(LucideIcons.flame, size: 15, color: KgColors.warning),
                Text('$_curStreak',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: KgColors.warning)),
              ]),
            ),
          if (!loading && error == null && !finished)
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Center(child: _timerText()),
            ),
          IconButton(
            tooltip: '练习工具',
            onPressed: _openTools,
            icon: const Icon(LucideIcons.settings2, size: 18),
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

  /// 顶栏计时：普通模式总用时；限时训练按模块建议用时倒计时/超时。
  Widget _timerText() {
    String fmt(int s) =>
        '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
    if (timedMode && !beiMode && items.isNotEmpty && !cur.answered) {
      final t = _targetSecs;
      final over = qsecs > t;
      return Text(over ? '超时+${fmt(qsecs - t)}' : fmt(t - qsecs),
          style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: over ? KgColors.error : KgColors.brand));
    }
    return Text(fmt(elapsed),
        style: TextStyle(fontSize: 14, color: context.kg.t3));
  }

  /// 模块建议单题用时（复刻 targetSecs）。
  int get _targetSecs =>
      const {
        'changshi': 40,
        'yanyu': 50,
        'shuliang': 90,
        'panduan': 60,
        'ziliao': 80,
      }[cur.module] ??
      60;

  Widget _questionView() {
    final q = cur;
    return Column(
      children: [
        if (offline)
          Container(
            width: double.infinity,
            color: context.kg.warningBg,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: const Text('离线模式 · 本地题包判分，联网后自动同步',
                style: TextStyle(fontSize: 11.5, color: KgColors.warning)),
          ),
        LinearProgressIndicator(
          value: (idx + 1) / items.length,
          minHeight: 3,
          backgroundColor: context.kg.fill,
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (beiMode || (timedMode && !beiMode) || q.isReal || q.groupSeq != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      if (beiMode) _tag('背题模式', KgColors.brand),
                      if (timedMode && !beiMode) _tag('限时训练', KgColors.brand),
                      if (q.isReal)
                        _tag(
                            '真题${q.examYear != null ? ' · ${q.examYear}' : ''}${q.examRegion?.isNotEmpty == true ? ' · ${q.examRegion}' : ''}',
                            KgColors.warning),
                      if (q.groupSeq != null)
                        _tag('同材料题组 ${q.groupSeq}', KgColors.t3),
                    ],
                  ),
                ),
              Row(
                children: [
                  _tag(moduleName(q.module), KgColors.moduleColors[q.module] ?? KgColors.brand),
                  if (q.questionType != null && q.questionType!.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    _tag(q.questionType!, context.kg.t3),
                  ],
                  const Spacer(),
                  Text('${idx + 1}/${items.length}',
                      style: TextStyle(color: context.kg.t3, fontSize: 13)),
                ],
              ),
              const SizedBox(height: 12),
              _questionText(q),
              if (q.image != null && q.image!.isNotEmpty) ...[
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => _previewImage(_imgUrl(q.image!)),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      _imgUrl(q.image!),
                      width: double.infinity,
                      fit: BoxFit.fitWidth,
                      errorBuilder: (c, e, s) => const SizedBox.shrink(),
                    ),
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
              if (q.answered || beiMode) ...[
                const SizedBox(height: 16),
                _explainCard(q),
              ],
            ],
          ),
        ),
        _bottomBar(q),
      ],
    );
  }

  /// 题干文本：作答后/背题模式下标注解析涉及的关键数字/关联词（复刻 qSegs）。
  Widget _questionText(Question q) {
    final fs = const [14.0, 16.0, 18.0, 20.0][fontLv.clamp(0, 3)];
    final segs = (q.answered || beiMode) ? _qSegs(q) : null;
    if (segs == null) {
      return Text(q.question, style: TextStyle(fontSize: fs, height: 1.7));
    }
    final darkMode = Theme.of(context).brightness == Brightness.dark;
    final hlBg = darkMode ? const Color(0xFF3A2E10) : const Color(0xFFFEF3C7);
    final hlFg = darkMode ? const Color(0xFFFBBF24) : const Color(0xFF92400E);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(TextSpan(children: [
          for (final s in segs)
            TextSpan(
              text: s.$1,
              style: s.$2
                  ? TextStyle(
                      backgroundColor: hlBg,
                      fontWeight: FontWeight.w700,
                      color: hlFg)
                  : null,
            ),
        ]), style: TextStyle(fontSize: fs, height: 1.7)),
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text('已标注题干重点（解析涉及的关键数字/关键词），对照检查是否找对了信息',
              style: TextStyle(fontSize: 11, color: KgColors.warning)),
        ),
      ],
    );
  }

  /// 从解析提取题干关键段（关键数字 + 关联词），无命中返回 null。
  List<(String, bool)>? _qSegs(Question q) {
    final src = [q.hsExplanation, q.explanation, q.xpExplanation]
        .where((s) => s != null && s.trim().isNotEmpty)
        .join('\n');
    if (src.isEmpty) return null;
    final toks = <String>{};
    for (final m in RegExp(r'\d[\d.,]*[%％万亿倍]?').allMatches(src)) {
      final t = m.group(0)!;
      if (t.replaceAll(RegExp(r'[.,]'), '').length >= 2 && q.question.contains(t)) {
        toks.add(t);
      }
    }
    const conj = ['但是', '然而', '因此', '所以', '总之', '可见', '也就是说', '实际上', '换句话说', '不仅', '而且', '否则', '如果', '只有', '除非'];
    for (final c in conj) {
      if (src.contains(c) && q.question.contains(c)) toks.add(c);
    }
    if (toks.isEmpty) return null;
    final list = toks.toList()
      ..sort((a, b) => b.length.compareTo(a.length));
    final text = q.question;
    bool isD(String ch) => ch.codeUnitAt(0) >= 48 && ch.codeUnitAt(0) <= 57;
    final ivs = <List<int>>[];
    for (final t in list.take(20)) {
      var p = 0;
      while ((p = text.indexOf(t, p)) != -1) {
        final pre = p > 0 ? text[p - 1] : '';
        final postIdx = p + t.length;
        final post = postIdx < text.length ? text[postIdx] : '';
        final numClipped = isD(t[0]) &&
            ((pre.isNotEmpty && isD(pre)) ||
                (post.isNotEmpty && (isD(post) || post == '.')));
        final overlap = ivs.any((v) => p < v[1] && p + t.length > v[0]);
        if (!numClipped && !overlap) ivs.add([p, p + t.length]);
        p += t.length;
      }
    }
    if (ivs.isEmpty) return null;
    ivs.sort((a, b) => a[0].compareTo(b[0]));
    final segs = <(String, bool)>[];
    var last = 0;
    for (final iv in ivs) {
      if (iv[0] > last) segs.add((text.substring(last, iv[0]), false));
      segs.add((text.substring(iv[0], iv[1]), true));
      last = iv[1];
    }
    if (last < text.length) segs.add((text.substring(last), false));
    return segs;
  }

  /// 全屏图片预览（复刻 uni.previewImage，可双指缩放）。
  void _previewImage(String url) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (c) => GestureDetector(
        onTap: () => Navigator.pop(c),
        child: InteractiveViewer(
          maxScale: 5,
          child: Center(child: Image.network(url)),
        ),
      ),
    );
  }

  /// 练习工具：字号/背题/自动跳题/限时/音效（复刻网页端工具面板）。
  Future<void> _openTools() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          void both(VoidCallback fn) {
            setSheet(fn);
            setState(() {});
          }

          Widget row(String name, String value, VoidCallback onTap,
              {bool on = false}) {
            return ListTile(
              dense: true,
              title: Text(name, style: const TextStyle(fontSize: 14)),
              trailing: Text(value,
                  style: TextStyle(
                      fontSize: 13,
                      color: on ? KgColors.brand : KgColors.t3,
                      fontWeight: on ? FontWeight.w600 : FontWeight.w400)),
              onTap: onTap,
            );
          }

          return SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.only(bottom: 4),
                  child: Text('练习工具',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                ),
                row('字号大小',
                    '${const ['小', '标准', '大', '特大'][fontLv.clamp(0, 3)]} · 点击切换',
                    () {
                  both(() {
                    fontLv = (fontLv + 1) % 3;
                    Store.instance.fontLv = fontLv;
                  });
                }),
                row('背题模式', beiMode ? '已开启' : '已关闭', () {
                  both(() {
                    beiMode = !beiMode;
                    Store.instance.beiMode = beiMode;
                  });
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(beiMode
                          ? '背题模式：直接看答案解析，不计入正确率'
                          : '已切回做题模式')));
                }, on: beiMode),
                row('答对自动跳下一题', autoNext ? '已开启' : '已关闭', () {
                  both(() {
                    autoNext = !autoNext;
                    Store.instance.autoNext = autoNext;
                  });
                }, on: autoNext),
                if (!beiMode)
                  row('限时训练（按模块建议用时倒计时）',
                      timedMode ? '已开启' : '已关闭', () {
                    both(() {
                      timedMode = !timedMode;
                      Store.instance.timedMode = timedMode;
                    });
                  }, on: timedMode),
                row('答题震动反馈', sfxOn ? '已开启' : '已关闭', () {
                  both(() {
                    sfxOn = !sfxOn;
                    Store.instance.sfxOn = sfxOn;
                  });
                }, on: sfxOn),
                const SizedBox(height: 8),
              ],
            ),
          );
        },
      ),
    );
  }

  /// 普通模式每日一组完成打卡（复刻 markDailyDone）。
  void _markDailyDone() {
    if (widget.mode != 'normal') return;
    final now = DateTime.now();
    final key =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final plan = Store.instance.dailyPlanDays;
    final days = Map<String, dynamic>.from(plan['days'] as Map);
    days[key] = true;
    Store.instance.dailyPlanDays = {...plan, 'days': days};
  }

  /// 底部固定工具栏：上一题 / 答题卡 / 下一题。
  /// 对标粉笔与华图的作答页——跳题与回看是刷题的刚需，原本只有单个「提前结束」。
  Widget _bottomBar(Question q) {
    final kg = context.kg;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        border: Border(top: BorderSide(color: kg.border)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Row(
            children: [
              _barAction(LucideIcons.chevronLeft, '上一题',
                  idx > 0 ? () => _goTo(idx - 1) : null),
              _barAction(LucideIcons.layoutGrid, '答题卡', _openAnswerCard),
              const SizedBox(width: 4),
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                  onPressed: (q.answered || beiMode) ? _next : null,
                  child: Text(idx < items.length - 1 ? '下一题' : '完成本组'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _barAction(IconData icon, String label, VoidCallback? onTap) {
    final kg = context.kg;
    final color = onTap == null ? kg.t4 : kg.t2;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        width: 62,
        height: 46,
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 11, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _option(Question q, String k, String v) {
    final kg = context.kg;
    Color border = kg.border;
    Color? bgc;
    Color badgeBg = kg.fill;
    Color badgeFg = kg.t2;
    Widget? trailing;
    if (q.answered || beiMode) {
      if (k == q.answer) {
        border = KgColors.success;
        bgc = kg.successBg;
        badgeBg = KgColors.success;
        badgeFg = Colors.white;
        trailing = const Text('✓ 正确', style: TextStyle(color: KgColors.success, fontSize: 12));
      } else if (k == q.picked) {
        border = KgColors.error;
        bgc = kg.errorBg;
        badgeBg = KgColors.error;
        badgeFg = Colors.white;
        trailing = const Text('✕ 我的选择', style: TextStyle(color: KgColors.error, fontSize: 12));
      }
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: bgc ?? Theme.of(context).cardTheme.color ?? kg.surface,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _pick(k),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              border: Border.all(color: border),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                // 圆形字母徽章：对标粉笔/华图，作为选项的视觉锚点与选中态载体
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: badgeBg, shape: BoxShape.circle),
                  child: Text(k,
                      style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700, color: badgeFg)),
                ),
                const SizedBox(width: 12),
                Expanded(child: Text(v, style: const TextStyle(fontSize: 15, height: 1.5))),
                if (trailing != null) ...[const SizedBox(width: 8), trailing],
              ],
            ),
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
            context.kg.brandBg,
            Theme.of(context).cardTheme.color ?? Colors.white,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.kg.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (q.answered)
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
            )
          else
            const Row(
              children: [
                Icon(LucideIcons.bookOpen, size: 18, color: KgColors.brand),
                SizedBox(width: 6),
                Text('背题模式 · 直接看答案解析，不计入正确率',
                    style: TextStyle(
                        fontWeight: FontWeight.w600, color: KgColors.brand)),
              ],
            ),
          if (q.answered && !q.correct) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('错因自评：',
                    style: TextStyle(fontSize: 12, color: context.kg.t3)),
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
                            : context.kg.fill,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(rz,
                          style: TextStyle(
                              fontSize: 11,
                              color: q.errorReason == rz
                                  ? Colors.white
                                  : context.kg.t3)),
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
                Text(
                    timedMode
                        ? '用时 ${q.secs}s / 建议 ${_targetSecs}s${q.secs > _targetSecs ? ' · 超时' : ''}'
                        : '用时 ${q.secs}s',
                    style: TextStyle(
                        fontSize: 12,
                        color: timedMode && q.secs > _targetSecs
                            ? KgColors.error
                            : KgColors.t4)),
            ],
          ),
          if (_kpChain(q) != null) ...[
            const SizedBox(height: 6),
            Text('考点：${_kpChain(q)}',
                style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
          if (_qStatLine(q) != null) ...[
            const SizedBox(height: 6),
            Text('全站数据：${_qStatLine(q)}',
                style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
          if (q.source != null && q.source!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('出处：${q.source}',
                style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
          if (q.hsExplanation != null && q.hsExplanation!.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            _tag('花生十三方法解析', KgColors.warning),
            const SizedBox(height: 6),
            Text(q.hsExplanation!,
                style: const TextStyle(fontSize: 14, height: 1.6)),
            if (q.xpExplanation != null && q.xpExplanation!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              _tag(q.xpSchool?.isNotEmpty == true ? q.xpSchool! : '第二名师视角',
                  KgColors.brand),
              const SizedBox(height: 6),
              Text(q.xpExplanation!,
                  style: const TextStyle(fontSize: 14, height: 1.6)),
            ],
            if (q.id != null) ...[
              const SizedBox(height: 8),
              if (hsRated.containsKey(q.id))
                Text(hsRated[q.id] == 'up' ? '已反馈：有用' : '已反馈：有误',
                    style: const TextStyle(fontSize: 12, color: KgColors.t4))
              else
                Row(children: [
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(64, 30),
                        padding: const EdgeInsets.symmetric(horizontal: 12)),
                    onPressed: () => _rateHs(q, true),
                    child: const Text('有用', style: TextStyle(fontSize: 12)),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(64, 30),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        foregroundColor: KgColors.error),
                    onPressed: () => _rateHs(q, false),
                    child: const Text('有误', style: TextStyle(fontSize: 12)),
                  ),
                ]),
            ],
          ] else if (q.explanation != null && q.explanation!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(q.explanation!, style: const TextStyle(fontSize: 14, height: 1.6)),
          ],
          const SizedBox(height: 10),
          InkWell(
            onTap: () => _deepExplain(q),
            child: const Text('用花生十三方法详解这道题 ›',
                style: TextStyle(fontSize: 12, color: KgColors.brand)),
          ),
          if (q.id != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                _explainOp(
                  favedIds.contains(q.id) ? LucideIcons.star : LucideIcons.star,
                  favedIds.contains(q.id) ? '已收藏' : '收藏',
                  () => _toggleFav(q),
                  color: favedIds.contains(q.id) ? KgColors.warning : context.kg.t3,
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
      {Color? color}) {
    color ??= context.kg.t3;
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

  /// 考点链：模块 > 二级题型 > 题型。
  String? _kpChain(Question q) {
    final parts = <String>[
      moduleName(q.module),
      if (q.submodule?.isNotEmpty == true) q.submodule!,
      if (q.questionType?.isNotEmpty == true &&
          q.questionType != q.submodule)
        q.questionType!,
    ];
    return parts.length > 1 ? parts.join(' > ') : null;
  }

  /// 全站难度/正确率/易错项（复刻 qStatLine）。
  String? _qStatLine(Question q) {
    if (q.attemptCount < 5 || q.correctRatio == null) return null;
    final r = q.correctRatio!;
    final stars = '★' * (r > 85 ? 1 : r > 70 ? 2 : r > 55 ? 3 : r > 40 ? 4 : 5);
    var s = '难度$stars · 全站正确率 $r%（${q.attemptCount} 人次）';
    if (q.mostWrong?.isNotEmpty == true && q.mostWrong != q.answer) {
      s += ' · 易错项 ${q.mostWrong}';
    }
    return s;
  }

  Future<void> _rateHs(Question q, bool up) async {
    setState(() => hsRated[q.id!] = up ? 'up' : 'down');
    unawaited(Api.rateQuestionHs(q.id!, up).catchError((_) {}));
  }

  /// AI 深度详解：题干+选项存入 redoQuestion，跳 AI 问答页（复刻 deepExplain）。
  void _deepExplain(Question q) {
    final optText =
        q.options.entries.map((e) => '${e.key}.${e.value}').join(' ');
    Store.instance.redoQuestion = '${q.question}\n$optText';
    context.go('/ask');
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
    // 分模块成绩（复刻结算页模块拆分）
    final byMod = <String, List<int>>{};
    for (final q in answered) {
      final m = (q.module ?? '').toString();
      if (m.isEmpty) continue;
      final v = byMod.putIfAbsent(m, () => [0, 0]);
      v[0]++;
      if (q.correct) v[1]++;
    }
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 12),
        Center(
          child: SizedBox(
            width: 132,
            height: 132,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 132,
                  height: 132,
                  child: CircularProgressIndicator(
                    value: pct / 100,
                    strokeWidth: 10,
                    backgroundColor: context.kg.fill,
                    color: pct >= 80
                        ? KgColors.success
                        : pct >= 60
                            ? KgColors.brand
                            : KgColors.warning,
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('$pct%',
                        style: const TextStyle(
                            fontSize: 32, fontWeight: FontWeight.w800)),
                    const Text('正确率',
                        style: TextStyle(fontSize: 11, color: KgColors.t3)),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
              '答对 $right/${answered.length} 题 · 用时 ${elapsed ~/ 60} 分 ${elapsed % 60} 秒'
              '${_bestInGroup >= 2 ? ' · 最高连对 $_bestInGroup' : ''}',
              style: const TextStyle(color: KgColors.t3)),
        ),
        if (percentile != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Center(
              child: Text('本组正确率击败了全站 $percentile% 的练习记录',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: KgColors.brand)),
            ),
          ),
        if (byMod.length > 1) ...[
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('分模块成绩',
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  for (final e in byMod.entries)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          Text(moduleName(e.key),
                              style: const TextStyle(fontSize: 13)),
                          const Spacer(),
                          Text('${e.value[1]}/${e.value[0]} 对',
                              style: const TextStyle(
                                  fontSize: 13, color: KgColors.t3)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        // 题目回顾网格：点题号回看解析
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('题目回顾（点题号看解析）',
                    style:
                        TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      InkWell(
                        onTap: () => setState(() {
                          finished = false;
                          idx = i;
                        }),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          width: 36,
                          height: 36,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: !items[i].answered
                                ? context.kg.fill
                                : items[i].correct
                                    ? context.kg.successBg
                                    : context.kg.errorBg,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('${i + 1}',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: !items[i].answered
                                      ? context.kg.t3
                                      : items[i].correct
                                          ? KgColors.success
                                          : KgColors.error)),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (offline) ...[
          const SizedBox(height: 8),
          const Center(
            child: Text('本组为离线作答，恢复网络后将自动同步（去重）',
                style: TextStyle(fontSize: 12, color: KgColors.warning)),
          ),
        ],
        if (reinforcePicked != null) ...[
          const SizedBox(height: 16),
          Card(
            color: KgColors.brand50,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('趁热打铁 · 同考点强化',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(
                      '${reinforcePicked!['tag3_name'] ?? reinforcePicked!['submodule']} · 掌握度 ${(((reinforcePicked!['mastery'] ?? 0) as num) * 100).round()}%（${reinforcePicked!['level_name']}） · 今日错 ${reinforcePicked!['wrong_today']} 道',
                      style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: () {
                      final p = reinforcePicked!;
                      final q = Uri(queryParameters: {
                        'mode': 'reinforce',
                        if ((p['module'] ?? '').toString().isNotEmpty)
                          'module': p['module'].toString(),
                        if ((p['submodule'] ?? '').toString().isNotEmpty)
                          'submodule': p['submodule'].toString(),
                        if ((p['tag3'] ?? '').toString().isNotEmpty)
                          'tag3': p['tag3'].toString(),
                        'count': '5',
                      }).query;
                      context.pushReplacement('/practice?$q');
                    },
                    child: const Text('强化 5 道新题（未做过）'),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),
        FilledButton(onPressed: _load, child: const Text('再来一组')),
        const SizedBox(height: 12),
        OutlinedButton(
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () => Share.share(
              '我在考公助手完成了一组练习：答对 $right/${answered.length} 题，正确率 $pct%'
              '${_bestInGroup >= 2 ? '，最高连对 $_bestInGroup' : ''}'
              '${percentile != null ? '，击败全站 $percentile% 的记录' : ''}，一起来刷题！'),
          child: const Text('分享战绩'),
        ),
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
          Icon(LucideIcons.cloudOff, size: 48, color: context.kg.t4),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(color: context.kg.t3)),
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
