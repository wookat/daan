import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../theme.dart';
import '../widgets/export_sheet.dart';

/// 错题本：待掌握 / 已掌握 / 收藏 三个 tab + 今日复习入口
class BookPage extends StatefulWidget {
  const BookPage({super.key});

  @override
  State<BookPage> createState() => _BookPageState();
}

class _BookPageState extends State<BookPage> with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 3, vsync: this);
  List<Mistake> all = [];
  List<dynamic> favs = [];
  int dueCount = 0;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        Api.mistakes(),
        Api.reviewDue(),
        Api.favs().catchError((_) => const <dynamic>[]),
      ]);
      final raw = results[0] as List<dynamic>;
      final review = results[1] as Map<String, dynamic>;
      setState(() {
        all = raw.map((e) => Mistake.fromJson(Map<String, dynamic>.from(e))).toList();
        dueCount = (review['total'] ?? 0) as int;
        favs = results[2] as List<dynamic>;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = all.where((m) => !m.mastered).toList();
    final mastered = all.where((m) => m.mastered).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('错题本'),
        actions: [
          IconButton(
            tooltip: '导出 PDF',
            onPressed: all.isEmpty
                ? null
                : () {
                    final pending = all.where((m) => !m.mastered).toList();
                    final list = pending.isNotEmpty ? pending : all;
                    showExportSheet(
                      context,
                      title: '错题本',
                      questionIds: [
                        for (final m in list)
                          if (m.questionId != null) m.questionId!,
                      ],
                      rawItems: [
                        for (final m in list)
                          if (m.questionId == null)
                            {
                              'question': m.questionText,
                              'answer': m.correctAnswer ?? '',
                              'explanation': m.explanation ?? '',
                            },
                      ],
                    );
                  },
            icon: const Icon(LucideIcons.fileDown, size: 20),
          ),
          IconButton(
            tooltip: '手动录入答案',
            onPressed: () async {
              await context.push('/paper/entry');
              _load();
            },
            icon: const Icon(LucideIcons.clipboardEdit, size: 20),
          ),
          IconButton(
            tooltip: '扫描答题卡',
            onPressed: () async {
              await context.push('/paper/scan');
              _load();
            },
            icon: const Icon(LucideIcons.scanLine, size: 20),
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          tabs: [
            Tab(text: '待掌握 ${pending.length}'),
            Tab(text: '已掌握 ${mastered.length}'),
            Tab(text: '收藏 ${favs.length}'),
          ],
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(error!, style: const TextStyle(color: KgColors.t3)),
                      const SizedBox(height: 12),
                      FilledButton(
                          style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
                          onPressed: _load,
                          child: const Text('重试')),
                    ],
                  ),
                )
              : Column(
                  children: [
                    if (dueCount > 0)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: Card(
                          child: ListTile(
                            leading: const Icon(LucideIcons.alarmClock, color: KgColors.brand),
                            title: Text('今日复习 · $dueCount 道错题到期',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                            trailing: FilledButton(
                              style: FilledButton.styleFrom(
                                  minimumSize: const Size(88, 36),
                                  padding: const EdgeInsets.symmetric(horizontal: 12)),
                              onPressed: () async {
                                await context.push('/practice?mode=review');
                                _load();
                              },
                              child: const Text('开始复习', style: TextStyle(fontSize: 13)),
                            ),
                          ),
                        ),
                      ),
                    Expanded(
                      child: TabBarView(
                        controller: _tab,
                        children: [
                          _list(pending, empty: '还没有待掌握的错题，去刷题吧'),
                          _list(mastered, empty: '还没有已掌握的错题'),
                          _favList(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _list(List<Mistake> items, {required String empty}) {
    if (items.isEmpty) return _empty(empty);
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final m = items[i];
          final stem = m.questionText.split('\n').first;
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () async {
                await context.push('/book/detail/${m.id}');
                _load();
              },
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _tag(moduleName(m.module),
                            KgColors.moduleColors[m.module] ?? KgColors.brand),
                        if (m.questionType != null && m.questionType!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          _tag(m.questionType!, KgColors.t3),
                        ],
                        const Spacer(),
                        if (m.times > 1)
                          Text('错 ${m.times} 次',
                              style: const TextStyle(fontSize: 11, color: KgColors.error)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(stem,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 14, height: 1.5)),
                    const SizedBox(height: 8),
                    Text(
                      '我的答案 ${m.userAnswer ?? '-'} · 正确答案 ${m.correctAnswer ?? '-'}',
                      style: const TextStyle(fontSize: 12, color: KgColors.t3),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _favList() {
    if (favs.isEmpty) return _empty('还没有收藏的题目');
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: favs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final f = Map<String, dynamic>.from(favs[i]);
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Text(
              (f['question'] ?? f['question_text'] ?? '题目 #${f['question_id']}').toString(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 14, height: 1.5),
            ),
          ),
        );
      },
    );
  }

  Widget _empty(String text) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(LucideIcons.inbox, size: 48, color: KgColors.t4),
          const SizedBox(height: 12),
          Text(text, style: const TextStyle(color: KgColors.t3)),
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
