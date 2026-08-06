import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 全真模考：整卷倒计时 + 答题卡浮层 + 中途退出恢复（examProgress 键）+ 交卷判分。
class ExamPage extends StatefulWidget {
  const ExamPage({super.key, this.paperId, this.mini = false, this.eventId});

  final int? paperId;
  final bool mini;
  final int? eventId;

  @override
  State<ExamPage> createState() => _ExamPageState();
}

class _ExamPageState extends State<ExamPage> {
  bool loading = true;
  String? error;
  int? attemptId;
  Map<String, dynamic>? paper;
  List<Map<String, dynamic>> items = [];
  int idx = 0;
  int leftSecs = 0;
  int _endAt = 0;
  int qsecs = 0;
  Timer? _timer;
  bool submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _saveProgress();
    super.dispose();
  }

  Future<void> _init() async {
    final saved = Store.instance.examProgress;
    final matches = saved != null &&
        saved['attemptId'] != null &&
        (saved['endAt'] ?? 0) > DateTime.now().millisecondsSinceEpoch &&
        ((widget.paperId != null && '${saved['paperId']}' == '${widget.paperId}') ||
            (widget.mini && saved['mini'] == true));
    if (matches) {
      final savedItems = (saved['items'] as List<dynamic>)
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      final answered = savedItems.where((q) => (q['_picked'] ?? '') != '').length;
      final resume = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('继续上次模考？'),
          content: Text('检测到未交卷的进度（已答 $answered/${savedItems.length} 题）'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('重新开始')),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('继续')),
          ],
        ),
      );
      if (resume == true) {
        setState(() {
          attemptId = saved['attemptId'] as int;
          paper = Map<String, dynamic>.from(saved['paper'] ?? {});
          items = savedItems;
          idx = ((saved['idx'] ?? 0) as int).clamp(0, savedItems.length - 1);
          _endAt = saved['endAt'] as int;
          loading = false;
        });
        _startClock();
        return;
      }
      Store.instance.examProgress = null;
    }
    await _start();
  }

  Future<void> _start() async {
    try {
      final d = await Api.examStart(paperId: widget.paperId, mini: widget.mini);
      setState(() {
        attemptId = d['attempt_id'] as int;
        paper = Map<String, dynamic>.from(d['paper'] ?? {});
        items = (d['items'] as List<dynamic>)
            .map((e) => {...Map<String, dynamic>.from(e), '_picked': '', '_marked': false, '_secs': 0})
            .toList();
        _endAt = DateTime.now().millisecondsSinceEpoch +
            ((paper!['duration_min'] ?? 30) as num).toInt() * 60 * 1000;
        loading = false;
      });
      _startClock();
      _saveProgress();
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  void _startClock() {
    _timer?.cancel();
    leftSecs = ((_endAt - DateTime.now().millisecondsSinceEpoch) / 1000).round().clamp(0, 1 << 30);
    qsecs = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        leftSecs =
            ((_endAt - DateTime.now().millisecondsSinceEpoch) / 1000).round().clamp(0, 1 << 30);
        qsecs++;
      });
      if (leftSecs <= 0) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('时间到，自动交卷')));
        _submit();
      }
    });
  }

  Map<String, dynamic> get cur => items[idx];
  int get answeredCount => items.where((q) => (q['_picked'] ?? '') != '').length;

  String get fmtLeft {
    final s = leftSecs.clamp(0, 1 << 30);
    return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}';
  }

  void _flushQSecs() {
    if (qsecs > 0) {
      cur['_secs'] = ((cur['_secs'] ?? 0) as int) + qsecs;
      qsecs = 0;
    }
  }

  void _pick(String k) {
    setState(() => cur['_picked'] = cur['_picked'] == k ? '' : k);
    _saveProgress();
    if ((cur['_picked'] ?? '') != '' && idx + 1 < items.length) {
      Future.delayed(const Duration(milliseconds: 180), () {
        if (mounted && !submitting) _next();
      });
    }
  }

  void _goto(int i) {
    if (i < 0 || i >= items.length || i == idx) return;
    _flushQSecs();
    setState(() => idx = i);
    _saveProgress();
  }

  void _next() => _goto(idx + 1);
  void _prev() => _goto(idx - 1);

  void _toggleMark() {
    setState(() => cur['_marked'] = !(cur['_marked'] == true));
    _saveProgress();
  }

  void _saveProgress() {
    if (attemptId == null || submitting) return;
    Store.instance.examProgress = {
      'attemptId': attemptId,
      'paperId': paper?['id'],
      'mini': widget.mini,
      'paper': paper,
      'items': items,
      'idx': idx,
      'endAt': _endAt,
    };
  }

  Future<void> _confirmSubmit() async {
    final blank = items.length - answeredCount;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('确认交卷？'),
        content: Text(blank > 0 ? '还有 $blank 题未作答，交卷后不能再修改' : '已全部作答，交卷查看成绩报告'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('交卷')),
        ],
      ),
    );
    if (ok == true) _submit();
  }

  Future<void> _submit() async {
    if (submitting) return;
    setState(() => submitting = true);
    _timer?.cancel();
    _flushQSecs();
    try {
      final picks = <String, String>{};
      final secs = <String, int>{};
      for (var i = 0; i < items.length; i++) {
        final q = items[i];
        if ((q['_picked'] ?? '') != '') picks['${i + 1}'] = q['_picked'] as String;
        if ((q['_secs'] ?? 0) != 0) secs['${i + 1}'] = q['_secs'] as int;
      }
      final d = await Api.examSubmit(attemptId!, picks, secs);
      Store.instance.examProgress = null;
      _mergeIntoStats(d);
      if (widget.eventId != null) {
        try {
          await Api.mockAttach(widget.eventId!, d['attempt_id'] as int);
          if (mounted) context.pushReplacement('/exam/contest/report/${widget.eventId}');
          return;
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text('未计入比赛：${Api.errMsg(e)}')));
          }
        }
      }
      if (mounted) context.pushReplacement('/exam/report/${d['attempt_id']}');
    } catch (e) {
      if (mounted) {
        setState(() => submitting = false);
        _startClock();
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('交卷失败：${Api.errMsg(e)}')));
      }
    }
  }

  /// 模考作答同步计入本地统计（与练习同一口径，供统计页/打卡使用）
  void _mergeIntoStats(Map<String, dynamic> d) {
    try {
      final results = (d['items'] as List<dynamic>? ?? [])
          .whereType<Map>()
          .where((it) => it['status'] == 'ok')
          .toList();
      if (results.isEmpty) return;
      Store.instance.addTodayCount(results.length);
      final byMod = <String, List<int>>{};
      for (final it in results) {
        final m = (it['module'] ?? '').toString();
        if (m.isEmpty) continue;
        final cur = byMod.putIfAbsent(m, () => [0, 0]);
        cur[0]++;
        if (it['correct'] == true) cur[1]++;
      }
      byMod.forEach((m, v) => Store.instance.addModuleStat(m, v[0], v[1]));
      Store.instance.addPracticeHistory({
        't': DateTime.now().millisecondsSinceEpoch,
        'module': '',
        'mode': 'exam',
        'n': ((d['total'] ?? results.length) as num).toInt(),
        'correct': ((d['correct'] ?? 0) as num).toInt(),
        'secs': items.fold<int>(0, (s, q) => s + (((q['_secs'] ?? 0) as num).toInt())),
        'exam': items.length > 50 ? 'full' : 'mini',
      });
    } catch (_) {/* 非关键路径 */}
  }

  void _openCard() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                    color: KgColors.border, borderRadius: BorderRadius.circular(2)),
              ),
              Text('答题卡 · 已答 $answeredCount/${items.length}',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              Flexible(
                child: SingleChildScrollView(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < items.length; i++)
                        InkWell(
                          borderRadius: BorderRadius.circular(6),
                          onTap: () {
                            Navigator.pop(c);
                            _goto(i);
                          },
                          child: Container(
                            width: 34,
                            height: 34,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: (items[i]['_picked'] ?? '') != ''
                                  ? KgColors.brand50
                                  : KgColors.fill,
                              borderRadius: BorderRadius.circular(6),
                              border: items[i]['_marked'] == true
                                  ? Border.all(color: KgColors.warning)
                                  : (i == idx ? Border.all(color: KgColors.brand) : null),
                            ),
                            child: Text('${i + 1}',
                                style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: (items[i]['_picked'] ?? '') != ''
                                        ? KgColors.brand
                                        : KgColors.t3)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                onPressed: submitting
                    ? null
                    : () {
                        Navigator.pop(c);
                        _confirmSubmit();
                      },
                child: const Text('交卷'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          '⏱ $fmtLeft',
          style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: leftSecs <= 300 ? KgColors.error : KgColors.t1),
        ),
        actions: [
          if (!loading && error == null)
            IconButton(
              onPressed: _toggleMark,
              icon: Icon(
                LucideIcons.flag,
                size: 20,
                color: cur['_marked'] == true ? KgColors.warning : KgColors.t3,
              ),
            ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('开考失败：$error', style: const TextStyle(color: KgColors.t3)),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: () => context.pop(), child: const Text('返回')),
                    ],
                  ),
                )
              : _body(),
      bottomNavigationBar: loading || error != null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                        onPressed: idx > 0 ? _prev : null,
                        child: const Text('上一题'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      width: 88,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                        onPressed: _openCard,
                        child: const Text('答题卡'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: idx < items.length - 1 ? _next : _confirmSubmit,
                        child: Text(idx < items.length - 1 ? '下一题' : '交卷'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _body() {
    final q = cur;
    final opts = <String, String>{};
    final rawOpts = q['options'];
    if (rawOpts is Map) rawOpts.forEach((k, v) => opts[k.toString()] = v.toString());
    return GestureDetector(
      onHorizontalDragEnd: (d) {
        final v = d.primaryVelocity ?? 0;
        if (v < -200) _next();
        if (v > 200) _prev();
      },
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: Row(
              children: [
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: KgColors.brand50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(moduleName(q['module']?.toString()),
                      style: const TextStyle(fontSize: 11, color: KgColors.brand)),
                ),
                const Spacer(),
                Text.rich(
                  TextSpan(children: [
                    TextSpan(
                        text: '${idx + 1}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, color: KgColors.t1)),
                    TextSpan(text: '/${items.length}'),
                  ]),
                  style: const TextStyle(fontSize: 13, color: KgColors.t3),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: (idx + 1) / items.length,
                minHeight: 6,
                backgroundColor: KgColors.fill,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              children: [
                Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${idx + 1}. ${q['question'] ?? ''}',
                            style: const TextStyle(fontSize: 15.5, height: 1.75)),
                        const SizedBox(height: 14),
                        for (final e in opts.entries) _option(e.key, e.value),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _option(String k, String v) {
    final sel = cur['_picked'] == k;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: submitting ? null : () => _pick(k),
        child: Container(
          constraints: const BoxConstraints(minHeight: 46),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: sel ? KgColors.brand50 : null,
            border: Border.all(
                color: sel ? KgColors.brand : KgColors.border, width: sel ? 1.5 : 1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Text(k,
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: sel ? KgColors.brand : KgColors.t1)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(v,
                    style: TextStyle(
                        fontSize: 14.5,
                        height: 1.5,
                        fontWeight: sel ? FontWeight.w600 : FontWeight.w400,
                        color: sel ? KgColors.brand : KgColors.t1)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
