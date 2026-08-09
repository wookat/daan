import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/storage.dart';
import '../theme.dart';
import 'ask_page.dart';

class BookDetailPage extends StatefulWidget {
  const BookDetailPage({super.key, required this.mistakeId});

  final int mistakeId;

  @override
  State<BookDetailPage> createState() => _BookDetailPageState();
}

class _BookDetailPageState extends State<BookDetailPage> {
  Mistake? m;
  bool loading = true;
  String? error;
  List<dynamic> attempts = [];
  String? analysis;
  bool analysisLoading = false;
  bool reported = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await Api.mistakes();
      final found = items
          .map((e) => Mistake.fromJson(Map<String, dynamic>.from(e)))
          .where((e) => e.id == widget.mistakeId)
          .toList();
      setState(() {
        m = found.isEmpty ? null : found.first;
        loading = false;
        if (found.isEmpty) error = '错题不存在或已删除';
      });
      final qid = m?.questionId;
      if (qid != null) {
        final ats = await Api.questionAttempts(qid).catchError((_) => const <dynamic>[]);
        if (mounted) setState(() => attempts = ats);
      }
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Future<void> _toggleMastered() async {
    final mk = m!;
    final next = !mk.mastered;
    setState(() => mk.mastered = next);
    try {
      await Api.patchMistake(mk.id, {'mastered': next ? 1 : 0});
    } catch (e) {
      setState(() => mk.mastered = !next);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('删除这道错题？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('删除', style: TextStyle(color: KgColors.error))),
        ],
      ),
    );
    if (ok != true) return;
    await Api.deleteMistake(m!.id);
    if (mounted) context.pop();
  }

  Future<void> _loadAnalysis() async {
    if (analysisLoading) return;
    setState(() => analysisLoading = true);
    try {
      final d = await Api.mistakeAnalysis();
      setState(() => analysis = (d['analysis'] ?? '').toString());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('分析失败：${Api.errMsg(e)}')));
      }
    }
    if (mounted) setState(() => analysisLoading = false);
  }

  Future<void> _report() async {
    final rtype = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('题目纠错',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            for (final t in const ['答案错误', '解析错误', '题干有误', '选项有误', '其它'])
              ListTile(
                dense: true,
                title: Text(t, style: const TextStyle(fontSize: 14)),
                onTap: () => Navigator.pop(c, t),
              ),
          ],
        ),
      ),
    );
    if (rtype == null || m?.questionId == null) return;
    try {
      await Api.questionReport(m!.questionId!, rtype, '');
      if (mounted) {
        setState(() => reported = true);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已提交纠错，感谢反馈')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  void _askAi() {
    Store.instance.redoQuestion = m!.questionText;
    context.go('/ask');
    askRedoTick.value++;
  }

  /// 分享给队友：生成分享 sid → 复制链接并唤起系统分享面板。
  Future<void> _shareToTeam() async {
    final qid = m?.questionId;
    if (qid == null) return;
    try {
      final sid = await Api.shareCreate(qid);
      final text =
          '我在考公助手分享了一道题，敢来挑战吗？https://kaogong.zalize.com/#/pkgA/share/share-q?sid=$sid';
      await Clipboard.setData(ClipboardData(text: text));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('分享链接已复制')));
      }
      unawaited(Share.share(text));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('错题详情'),
        actions: [
          if (m?.questionId != null)
            IconButton(
                tooltip: '分享给队友',
                onPressed: _shareToTeam,
                icon: const Icon(LucideIcons.share2, size: 20)),
          if (m?.questionId != null)
            IconButton(
                tooltip: reported ? '已纠错' : '纠错',
                onPressed: reported ? null : _report,
                icon: const Icon(LucideIcons.flag, size: 20)),
          if (m != null)
            IconButton(onPressed: _delete, icon: const Icon(LucideIcons.trash2, size: 20)),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!, style: const TextStyle(color: KgColors.t3)))
              : _detail(),
      bottomNavigationBar: m == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (m!.tag3 != null && m!.tag3!.isNotEmpty) ...[
                      FilledButton.icon(
                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                        onPressed: () => context.push(
                            '/practice?mode=reinforce&count=5'
                            '${m!.module != null ? '&module=${m!.module}' : ''}'
                            '&tag3=${Uri.encodeComponent(m!.tag3!)}'
                            '${m!.tag3Name != null ? '&title=${Uri.encodeComponent('同考点强化 · ${m!.tag3Name}')}' : ''}'),
                        icon: const Icon(LucideIcons.zap, size: 18),
                        label: Text('同考点强化 5 道新题${m!.tag3Name != null ? ' · ${m!.tag3Name}' : ''}'),
                      ),
                      const SizedBox(height: 10),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                            onPressed: _toggleMastered,
                            icon: Icon(
                                m!.mastered ? LucideIcons.rotateCcw : LucideIcons.checkCircle2,
                                size: 18),
                            label: Text(m!.mastered ? '标为待掌握' : '标为已掌握'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: () => context.push(
                                '/practice?mode=redo${m!.module != null ? '&module=${m!.module}' : ''}'),
                            icon: const Icon(LucideIcons.repeat, size: 18),
                            label: const Text('错题重练'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _detail() {
    final mk = m!;
    final parts = mk.questionText.split('\n');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            _tag(moduleName(mk.module), KgColors.moduleColors[mk.module] ?? KgColors.brand),
            if (mk.questionType != null && mk.questionType!.isNotEmpty) ...[
              const SizedBox(width: 6),
              _tag(mk.questionType!, KgColors.t3),
            ],
            const Spacer(),
            _tag(mk.mastered ? '已掌握' : '待掌握',
                mk.mastered ? KgColors.success : KgColors.warning),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(parts.join('\n'), style: const TextStyle(fontSize: 15, height: 1.7)),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('我的答案：', style: TextStyle(color: KgColors.t3, fontSize: 13)),
                    Text(mk.userAnswer ?? '-',
                        style:
                            const TextStyle(color: KgColors.error, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 20),
                    const Text('正确答案：', style: TextStyle(color: KgColors.t3, fontSize: 13)),
                    Text(mk.correctAnswer ?? '-',
                        style: const TextStyle(
                            color: KgColors.success, fontWeight: FontWeight.w700)),
                  ],
                ),
                if (mk.errorReason != null && mk.errorReason!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('错因：${mk.errorReason}',
                      style: const TextStyle(color: KgColors.t2, fontSize: 13)),
                ],
                if (mk.times > 1) ...[
                  const SizedBox(height: 8),
                  Text('累计错 ${mk.times} 次',
                      style: const TextStyle(color: KgColors.error, fontSize: 13)),
                ],
              ],
            ),
          ),
        ),
        if (mk.explanation != null && mk.explanation!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('解析', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(mk.explanation!, style: const TextStyle(fontSize: 14, height: 1.65)),
                ],
              ),
            ),
          ),
        ],
        if (attempts.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('历次作答',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  for (final a in attempts) _attemptRow(Map<String, dynamic>.from(a)),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 12),
        _aiCard(),
      ],
    );
  }

  Widget _attemptRow(Map<String, dynamic> a) {
    final ok = a['correct'] == true || a['correct'] == 1;
    final secs = a['secs'];
    final ts = a['created_at'] ?? a['ts'];
    String when = '';
    if (ts is num && ts > 0) {
      final d = DateTime.fromMillisecondsSinceEpoch((ts * 1000).toInt());
      when = '${d.month}.${d.day}';
    }
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: KgColors.fill, width: .5)),
      ),
      child: Row(
        children: [
          _tag(ok ? '✓ 对' : '✕ 错', ok ? KgColors.success : KgColors.error),
          const SizedBox(width: 10),
          Text('选 ${a['picked'] ?? '-'}',
              style: const TextStyle(fontSize: 13, color: KgColors.t2)),
          if (secs is num && secs > 0) ...[
            const SizedBox(width: 6),
            Text('· 用时 ${secs.toInt()}s',
                style: const TextStyle(fontSize: 13, color: KgColors.t4)),
          ],
          const Spacer(),
          Text(when, style: const TextStyle(fontSize: 13, color: KgColors.t4)),
        ],
      ),
    );
  }

  Widget _aiCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KgColors.brand50.withValues(
                alpha: Theme.of(context).brightness == Brightness.dark ? .12 : 1),
            Theme.of(context).cardTheme.color ?? Colors.white,
          ],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: KgColors.brand100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🤖 AI 错因分析',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const Spacer(),
              _tag('花生十三', KgColors.brand),
            ],
          ),
          const SizedBox(height: 8),
          if (analysis != null)
            Text(analysis!,
                style: const TextStyle(fontSize: 14, color: KgColors.t2, height: 1.65))
          else
            const Text('基于你的错题分布与近期作答数据，AI 给出错因画像与复习建议。',
                style: TextStyle(fontSize: 13, color: KgColors.t3, height: 1.6)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(38)),
                  onPressed: analysisLoading ? null : _loadAnalysis,
                  child: Text(
                      analysisLoading ? '分析中…' : (analysis == null ? '生成错因分析' : '重新分析'),
                      style: const TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(38)),
                  onPressed: _askAi,
                  child: const Text('继续问 AI', style: TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
        ],
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
