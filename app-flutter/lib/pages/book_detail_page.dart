import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../theme.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('错题详情'),
        actions: [
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
                child: Row(
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
      ],
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
