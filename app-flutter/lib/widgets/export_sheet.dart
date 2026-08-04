import 'dart:io';

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

/// PDF 导出弹层：含答题卡 / 含答案解析 / 仅导出答案。复刻 book.vue 导出弹层。
/// [questionIds] 有 id 的题走后端题库；[rawItems] 无 id 的题直接传原文。
Future<void> showExportSheet(
  BuildContext context, {
  required String title,
  List<int> questionIds = const [],
  List<Map<String, dynamic>> rawItems = const [],
}) {
  return showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
    builder: (c) => _ExportSheet(
        title: title, questionIds: questionIds, rawItems: rawItems),
  );
}

class _ExportSheet extends StatefulWidget {
  const _ExportSheet({
    required this.title,
    required this.questionIds,
    required this.rawItems,
  });

  final String title;
  final List<int> questionIds;
  final List<Map<String, dynamic>> rawItems;

  @override
  State<_ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<_ExportSheet> {
  bool expSheet = true;
  bool expAns = true;
  bool expOnly = false;
  bool busy = false;

  int get total => widget.questionIds.length + widget.rawItems.length;

  Future<void> _export() async {
    if (busy || total == 0) return;
    setState(() => busy = true);
    try {
      final bytes = await Api.exportPdf({
        'title': widget.title,
        if (widget.questionIds.isNotEmpty) 'question_ids': widget.questionIds,
        if (widget.rawItems.isNotEmpty) 'items': widget.rawItems,
        'include_answers': expOnly || expAns,
        'answer_sheet': !expOnly && expSheet,
        'include_questions': !expOnly,
      });
      if (bytes.isEmpty) throw Exception('导出内容为空');
      final dir = await getTemporaryDirectory();
      final file = File(
          '${dir.path}/${widget.title}_${DateTime.now().millisecondsSinceEpoch}.pdf');
      await file.writeAsBytes(bytes);
      if (!mounted) return;
      Navigator.pop(context);
      await Share.shareXFiles([XFile(file.path, mimeType: 'application/pdf')],
          text: widget.title);
    } catch (e) {
      if (mounted) {
        setState(() => busy = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('导出失败：${Api.errMsg(e)}')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: KgColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(LucideIcons.fileDown,
                    size: 20, color: KgColors.brand),
                const SizedBox(width: 8),
                Text('导出 PDF · ${widget.title}（$total 题）',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            _opt(
              '含答题卡',
              '附一页可涂写的答题卡，适合打印练习',
              expSheet && !expOnly,
              expOnly ? null : (v) => setState(() => expSheet = v),
            ),
            _opt(
              '含答案与解析',
              '题目后附答案页（含解析）',
              expAns && !expOnly,
              expOnly ? null : (v) => setState(() => expAns = v),
            ),
            _opt(
              '仅导出答案',
              '不含题目，只导出答案速查表',
              expOnly,
              (v) => setState(() => expOnly = v),
            ),
            const SizedBox(height: 14),
            FilledButton(
              onPressed: busy || total == 0 ? null : _export,
              child: Text(busy ? '正在生成 PDF…' : '生成并分享 PDF'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _opt(String title, String sub, bool value,
      void Function(bool)? onChanged) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
              Text(sub,
                  style: const TextStyle(fontSize: 11, color: KgColors.t3)),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeTrackColor: KgColors.brand,
        ),
      ],
    );
  }
}
