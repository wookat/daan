import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// AI 结构化面试陪练：选分类抽题 → 文字作答 → 流式五维打分+点评+参考思路，
/// 对照 frontend-uni/src/pkgA/interview/interview.vue。
class InterviewPage extends StatefulWidget {
  const InterviewPage({super.key, this.sessionId});

  final int? sessionId;

  @override
  State<InterviewPage> createState() => _InterviewPageState();
}

class _InterviewPageState extends State<InterviewPage> {
  String step = 'pick'; // pick / answer / report
  List<dynamic> categories = [];
  int bankTotal = 0;
  String pickedCategory = '';
  Map<String, dynamic> question = {};
  final answerCtrl = TextEditingController();
  int elapsed = 0;
  Timer? _timer;
  bool submitting = false;
  bool streaming = false;
  Map<String, dynamic> report = {};
  String review = '';
  List<dynamic> points = [];
  bool loading = false;

  @override
  void initState() {
    super.initState();
    if (widget.sessionId != null) {
      _loadSession(widget.sessionId!);
    } else {
      _loadCategories();
    }
    answerCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    answerCtrl.dispose();
    super.dispose();
  }

  String _fmtDur(int s) => "${s ~/ 60}'${(s % 60).toString().padLeft(2, '0')}\"";

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _loadCategories() async {
    setState(() => loading = true);
    try {
      final d = await Api.interviewCategories();
      setState(() {
        categories = d['categories'] as List<dynamic>? ?? [];
        bankTotal = (d['total'] as num?)?.toInt() ?? 0;
      });
    } catch (e) {
      _toast(Api.errMsg(e));
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _draw(String category, {int? excludeId}) async {
    pickedCategory = category;
    try {
      final d = await Api.interviewDraw(
          category: category.isEmpty ? null : category, excludeId: excludeId);
      setState(() {
        question = Map<String, dynamic>.from(d['question'] as Map);
        answerCtrl.clear();
        review = '';
        points = [];
        step = 'answer';
      });
      _startTimer();
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  void _startTimer() {
    _timer?.cancel();
    elapsed = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => elapsed++);
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _submit() async {
    if (submitting) return;
    setState(() => submitting = true);
    _stopTimer();
    final duration = elapsed;
    final ans = answerCtrl.text.trim();
    try {
      setState(() {
        report = {
          'scores': <String, dynamic>{},
          'total': 0,
          'summary': '',
          'duration': duration,
          'answerLen': ans.length,
          'category': question['category'],
        };
        review = '';
        streaming = true;
      });
      final res = await Api.interviewAnswerStream(
        questionId: (question['id'] as num).toInt(),
        answer: ans,
        durationSec: duration,
        onMeta: (m) {
          if (!mounted) return;
          setState(() {
            report = {
              ...report,
              'scores': m['scores'] ?? <String, dynamic>{},
              'total': m['total'] ?? 0,
              'summary': m['summary'] ?? '',
            };
            step = 'report';
          });
        },
        onDelta: (full) {
          if (mounted) setState(() => review = full);
        },
      );
      if ((res['review'] ?? '').toString().isNotEmpty) {
        review = res['review'].toString();
      }
      final sid = res['session_id'];
      if (sid is num) unawaited(_loadPoints(sid.toInt()));
    } catch (e) {
      _toast(Api.errMsg(e));
      if (step != 'report') _startTimer();
    } finally {
      if (mounted) {
        setState(() {
          submitting = false;
          streaming = false;
        });
      }
    }
  }

  Future<void> _loadPoints(int sid) async {
    try {
      final d = await Api.interviewSession(sid);
      final s = d['session'] as Map?;
      if (mounted && s != null) {
        setState(() => points = s['points'] as List<dynamic>? ?? []);
      }
    } catch (_) {/* 非关键路径 */}
  }

  Future<void> _loadSession(int sid) async {
    setState(() => loading = true);
    try {
      final d = await Api.interviewSession(sid);
      final s = Map<String, dynamic>.from(d['session'] as Map);
      setState(() {
        question = {
          'id': s['question_id'],
          'category': s['category'],
          'question': s['question_text'],
          'source': s['source'],
        };
        answerCtrl.text = (s['answer_text'] ?? '').toString();
        report = {
          'scores': s['scores'] ?? <String, dynamic>{},
          'total': s['total'] ?? 0,
          'summary': '',
          'duration': s['duration_sec'] ?? 0,
          'answerLen': (s['answer_text'] ?? '').toString().length,
          'category': s['category'],
        };
        review = (s['review'] ?? '').toString();
        points = s['points'] as List<dynamic>? ?? [];
        step = 'report';
      });
    } catch (e) {
      _toast(Api.errMsg(e));
      unawaited(_loadCategories());
    }
    if (mounted) setState(() => loading = false);
  }

  void _retry() {
    setState(() {
      answerCtrl.clear();
      review = '';
      points = [];
      step = 'answer';
    });
    _startTimer();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI 面试陪练')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : switch (step) {
              'answer' => _answerView(),
              'report' => _reportView(),
              _ => _pickView(),
            },
    );
  }

  // ---------- 第一步：选分类 ----------

  Widget _pickView() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(14),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('AI 结构化面试陪练',
                  style: TextStyle(
                      color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
              SizedBox(height: 4),
              Text('抽题作答 · 考官级五维打分 · 逐段点评',
                  style: TextStyle(color: Colors.white70, fontSize: 12.5)),
            ],
          ),
        ),
        if (bankTotal > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8, left: 4),
            child: Text('$bankTotal 道真题/经典题 · 来源公开资料',
                style: const TextStyle(fontSize: 12, color: KgColors.t3)),
          ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text('选择题型分类', style: TextStyle(fontSize: 12, color: KgColors.t3)),
        ),
        Card(
          child: Column(
            children: [
              for (var i = 0; i < categories.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  title: Text((categories[i]['name'] ?? '').toString(),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '共 ${categories[i]['total']} 题 · 已练 ${categories[i]['done']}',
                    style: const TextStyle(fontSize: 12, color: KgColors.t3),
                  ),
                  trailing: const Icon(LucideIcons.chevronRight,
                      size: 18, color: KgColors.t4),
                  onTap: () => _draw((categories[i]['name'] ?? '').toString()),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: () => _draw(''),
          icon: const Icon(LucideIcons.shuffle, size: 16),
          label: const Text('随机抽一题'),
        ),
        const SizedBox(height: 20),
        Center(
          child: TextButton(
            onPressed: () => context.push('/interview/history'),
            child: const Text('练习记录 ›'),
          ),
        ),
      ],
    );
  }

  // ---------- 第二步：作答 ----------

  Widget _answerView() {
    final canSubmit = answerCtrl.text.trim().length >= 20 && !submitting;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _questionCard(),
        const SizedBox(height: 12),
        Row(
          children: [
            const Icon(LucideIcons.timer, size: 15, color: KgColors.t2),
            const SizedBox(width: 4),
            Text(_fmtDur(elapsed),
                style: const TextStyle(fontSize: 13, color: KgColors.t2)),
            const Spacer(),
            TextButton(
              onPressed: () => _draw(pickedCategory,
                  excludeId: (question['id'] as num?)?.toInt()),
              child: const Text('换一题', style: TextStyle(fontSize: 13)),
            ),
          ],
        ),
        TextField(
          controller: answerCtrl,
          maxLines: 8,
          maxLength: 5000,
          decoration: const InputDecoration(
            hintText: '像面试现场一样组织语言作答（建议 200 字以上）…',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: () => _toast('语音作答即将上线，先用文字练起来吧'),
              icon: const Icon(LucideIcons.mic, size: 15),
              label: const Text('语音作答', style: TextStyle(fontSize: 13)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: canSubmit ? _submit : null,
                child: Text(submitting ? '考官点评中…' : '提交作答'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _questionCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: KgColors.brand.withValues(alpha: .1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text((question['category'] ?? '').toString(),
                      style: const TextStyle(
                          fontSize: 11,
                          color: KgColors.brand,
                          fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text((question['source'] ?? '').toString(),
                      style: const TextStyle(fontSize: 11, color: KgColors.t3)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text((question['question'] ?? '').toString(),
                style: const TextStyle(fontSize: 15, height: 1.7)),
          ],
        ),
      ),
    );
  }

  // ---------- 第三步：点评报告 ----------

  Widget _reportView() {
    final scores = Map<String, dynamic>.from(report['scores'] as Map? ?? {});
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('结构化面试 · ${report['category'] ?? ''}',
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 12.5)),
                        Text.rich(TextSpan(
                          text: '${report['total'] ?? 0}',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 34,
                              fontWeight: FontWeight.w800),
                          children: const [
                            TextSpan(
                                text: ' / 100',
                                style: TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w500)),
                          ],
                        )),
                      ],
                    ),
                  ),
                  Text(
                    '作答 ${_fmtDur((report['duration'] as num?)?.toInt() ?? 0)} · ${report['answerLen'] ?? 0} 字',
                    style: const TextStyle(color: Colors.white70, fontSize: 11.5),
                  ),
                ],
              ),
              if ((report['summary'] ?? '').toString().isNotEmpty) ...[
                const Divider(color: Colors.white24, height: 20),
                Text((report['summary'] ?? '').toString(),
                    style: const TextStyle(
                        color: Colors.white, fontSize: 12.5, height: 1.6)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('五维评分',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                for (final e in scores.entries) _dimRow(e.key, e.value),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text('题目', style: TextStyle(fontSize: 12, color: KgColors.t3)),
        ),
        _questionCard(),
        if (points.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('参考思路要点',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  for (var i = 0; i < points.length; i++)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text('${i + 1}. ${points[i]}',
                          style: const TextStyle(fontSize: 13.5, height: 1.7)),
                    ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text('考官点评${streaming ? '（生成中…）' : ''}',
              style: const TextStyle(fontSize: 12, color: KgColors.t3)),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: review.isNotEmpty
                ? Text(review, style: const TextStyle(fontSize: 13.5, height: 1.8))
                : const Text('考官正在撰写点评…',
                    style: TextStyle(fontSize: 13, color: KgColors.t3)),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            OutlinedButton(
              onPressed: streaming ? null : _retry,
              child: const Text('重答本题'),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: streaming
                    ? null
                    : () => _draw(pickedCategory,
                        excludeId: (question['id'] as num?)?.toInt()),
                child: const Text('再练一题'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: () => context.push('/interview/history'),
            child: const Text('练习记录 ›'),
          ),
        ),
      ],
    );
  }

  Widget _dimRow(String label, dynamic value) {
    final v = (value as num?)?.toDouble() ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 68,
            child: Text(label,
                style: const TextStyle(fontSize: 12, color: KgColors.t2)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: (v / 10).clamp(0, 1),
                minHeight: 7,
                backgroundColor: KgColors.fill,
                valueColor: const AlwaysStoppedAnimation(KgColors.brand),
              ),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 22,
            child: Text('${v == v.roundToDouble() ? v.toInt() : v}',
                textAlign: TextAlign.right,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
