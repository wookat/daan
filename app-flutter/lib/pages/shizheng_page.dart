import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 时政每日一练：每日 10 题（/api/shizheng/daily），作答判分，完成后本地记录（szDaily），
/// 当日已完成再进入则展示回顾。复刻 frontend-uni practice.vue 的 startShizheng/reviewShizheng。
class ShizhengPage extends ConsumerStatefulWidget {
  const ShizhengPage({super.key});

  @override
  ConsumerState<ShizhengPage> createState() => _ShizhengPageState();
}

class _ShizhengPageState extends ConsumerState<ShizhengPage> {
  List<Question> items = [];
  int idx = 0;
  bool loading = true;
  String? error;
  bool finished = false;
  bool reviewMode = false;
  int right = 0;
  DateTime _qStart = DateTime.now();
  Timer? _ticker;
  int elapsed = 0;
  String date = '';

  static String _today() {
    final n = DateTime.now();
    return '${n.year.toString().padLeft(4, '0')}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !finished && !reviewMode) setState(() => elapsed++);
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Question _mapShizheng(Map<String, dynamic> j) {
    final q = Question.fromJson(j);
    final note = (j['source_note'] ?? '').toString();
    return Question(
      id: q.id,
      question: q.question,
      options: q.options,
      answer: q.answer,
      module: 'shizheng',
      questionType: q.questionType,
      explanation:
          (q.explanation ?? '') + (note.isNotEmpty ? '\n【出处】$note' : ''),
    );
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
      finished = false;
      reviewMode = false;
      idx = 0;
      right = 0;
      elapsed = 0;
    });
    try {
      final d = await Api.shizhengDaily();
      final raw = (d['items'] as List<dynamic>? ?? []);
      if (raw.isEmpty) {
        setState(() {
          loading = false;
          error = '时政题库准备中，敬请期待';
        });
        return;
      }
      date = (d['date'] ?? _today()).toString();
      final qs = raw
          .map((e) => _mapShizheng(Map<String, dynamic>.from(e)))
          .toList();
      final rec = Store.instance.szDaily['days'][_today()];
      if (rec is Map) {
        // 当日已完成 → 回顾模式
        final picks = (rec['picks'] as List<dynamic>? ?? []);
        for (var i = 0; i < qs.length; i++) {
          final p = i < picks.length ? picks[i].toString() : '';
          if (p.isNotEmpty) qs[i].picked = p;
          qs[i].logged = true;
        }
        setState(() {
          items = qs;
          right = (rec['right'] as num?)?.toInt() ?? 0;
          reviewMode = true;
          loading = false;
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

  Question get cur => items[idx];

  void _pick(String k) {
    if (cur.answered) return;
    setState(() {
      cur.picked = k;
      cur.secs = DateTime.now().difference(_qStart).inSeconds;
      if (cur.correct) right++;
    });
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

  void _finish() {
    setState(() => finished = true);
    final answered = items.where((q) => q.answered).length;
    if (answered > 0) {
      ref.read(todayCountProvider.notifier).add(answered);
    }
    // 复刻 markShizhengDone：按日期记录本地完成态
    final sz = Store.instance.szDaily;
    final days = Map<String, dynamic>.from(sz['days'] as Map);
    days[_today()] = {
      'right': right,
      'picks': items.map((q) => q.picked ?? '').toList(),
    };
    Store.instance.szDaily = {...sz, 'days': days};
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('时政每日一练'),
        actions: [
          if (!loading && error == null && !finished && !reviewMode)
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
              ? _errorView()
              : reviewMode
                  ? _reviewView()
                  : finished
                      ? _resultView()
                      : _questionView(),
    );
  }

  Widget _errorView() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(LucideIcons.newspaper, size: 48, color: KgColors.t4),
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: KgColors.t3)),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
            onPressed: _load,
            child: const Text('重试'),
          ),
        ],
      ),
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
                  _tag('今日热点 · $date', KgColors.warning),
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
                    child: Text(idx < items.length - 1 ? '下一题' : '完成今日一练'),
                  )
                : OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48)),
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
        trailing = const Text('✓ 正确',
            style: TextStyle(color: KgColors.success, fontSize: 12));
      } else if (k == q.picked) {
        border = KgColors.error;
        bgc = KgColors.errorBg;
        trailing = const Text('✕ 我的选择',
            style: TextStyle(color: KgColors.error, fontSize: 12));
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
              Expanded(
                  child:
                      Text(v, style: const TextStyle(fontSize: 15, height: 1.5))),
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
        color: KgColors.brand50.withValues(
            alpha: Theme.of(context).brightness == Brightness.dark ? .12 : 1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KgColors.border.withValues(alpha: .6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(q.correct ? LucideIcons.checkCircle2 : LucideIcons.xCircle,
                  size: 18,
                  color: q.correct ? KgColors.success : KgColors.error),
              const SizedBox(width: 6),
              Text(q.correct ? '回答正确' : '回答错误',
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: q.correct ? KgColors.success : KgColors.error)),
            ],
          ),
          const SizedBox(height: 10),
          Text('正确答案：${q.answer}',
              style: const TextStyle(fontWeight: FontWeight.w600)),
          if (q.explanation != null && q.explanation!.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(q.explanation!,
                style: const TextStyle(fontSize: 14, height: 1.6)),
          ],
        ],
      ),
    );
  }

  Widget _resultView() {
    final answered = items.where((q) => q.answered).length;
    final pct = answered == 0 ? 0 : (right * 100 / answered).round();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('时政每日一练完成！',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            Text('$pct%',
                style: const TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.w800,
                    color: KgColors.brand)),
            const SizedBox(height: 4),
            Text('答对 $right/$answered 题 · 用时 ${elapsed ~/ 60} 分 ${elapsed % 60} 秒',
                style: const TextStyle(color: KgColors.t3)),
            const SizedBox(height: 32),
            FilledButton(
                onPressed: () => setState(() {
                      reviewMode = true;
                      finished = false;
                    }),
                child: const Text('回顾今日题目')),
            const SizedBox(height: 12),
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48)),
              onPressed: () => context.pop(),
              child: const Text('返回'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reviewView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(LucideIcons.checkCircle2, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text('今日已完成 · 答对 $right/${items.length} 题',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w600)),
              ),
              Text(date,
                  style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        for (var i = 0; i < items.length; i++) _reviewItem(i),
      ],
    );
  }

  Widget _reviewItem(int i) {
    final q = items[i];
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _tag('第 ${i + 1} 题', KgColors.brand),
                const SizedBox(width: 8),
                if (q.answered)
                  _tag(q.correct ? '答对' : '答错 ${q.picked}',
                      q.correct ? KgColors.success : KgColors.error)
                else
                  _tag('未作答', KgColors.t3),
              ],
            ),
            const SizedBox(height: 8),
            Text(q.question, style: const TextStyle(fontSize: 15, height: 1.6)),
            const SizedBox(height: 8),
            for (final e in q.options.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '${e.key}. ${e.value}',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: e.key == q.answer
                        ? KgColors.success
                        : (e.key == q.picked ? KgColors.error : KgColors.t2),
                    fontWeight:
                        e.key == q.answer ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            Text('正确答案：${q.answer}',
                style: const TextStyle(
                    fontSize: 13,
                    color: KgColors.success,
                    fontWeight: FontWeight.w600)),
            if (q.explanation != null && q.explanation!.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(q.explanation!,
                  style: const TextStyle(
                      fontSize: 13, height: 1.6, color: KgColors.t2)),
            ],
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
      child: Text(text,
          style:
              TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
