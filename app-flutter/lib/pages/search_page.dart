import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

const _kMods = {
  'ziliao': '资料',
  'shuliang': '数量',
  'yanyu': '言语',
  'panduan': '判断',
  'changshi': '常识',
  'shenlun': '申论',
};

/// 全局搜索：题号语义码直达 / 题干关键词 / 考点名 / 试卷名。复刻 pkgA/search/search.vue。
class SearchPage extends StatefulWidget {
  const SearchPage({super.key});

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _ctrl = TextEditingController();
  String tab = 'all';
  bool loading = false;
  Map<String, dynamic>? result;
  Map<String, dynamic>? detail;
  Timer? _timer;

  static const tabs = [
    ('all', '全部'),
    ('question', '题目'),
    ('topic', '考点'),
    ('paper', '试卷'),
  ];

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  void _onInput(String _) {
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 400), _doSearch);
  }

  Future<void> _doSearch() async {
    final q = _ctrl.text.trim();
    if (q.isEmpty) {
      setState(() => result = null);
      return;
    }
    setState(() {
      loading = true;
      detail = null;
    });
    try {
      final d = await Api.search(q, type: tab);
      if (mounted) setState(() => result = d);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
    if (mounted) setState(() => loading = false);
  }

  Future<void> _loadMore() async {
    final r = result;
    if (r == null) return;
    final q = (r['q'] ?? '').toString();
    final items = (r['questions']?['items'] as List<dynamic>? ?? []);
    try {
      final d = await Api.search(q, type: 'question', offset: items.length);
      final more = d['questions']?['items'] as List<dynamic>? ?? [];
      setState(() => items.addAll(more));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('加载失败')));
      }
    }
  }

  Future<void> _toggleDetail(Map<String, dynamic> it) async {
    final id = (it['id'] as num).toInt();
    if (detail != null && (detail!['id'] as num?)?.toInt() == id) {
      setState(() => detail = null);
      return;
    }
    try {
      final d = await Api.searchQuestion(id);
      setState(() => detail = d);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('加载失败')));
      }
    }
  }

  bool get isEmpty {
    final r = result;
    if (r == null) return false;
    if (r['code_hit'] != null) return false;
    final topics = r['topics'] as List<dynamic>? ?? [];
    final papers = r['papers'] as List<dynamic>? ?? [];
    final qItems = r['questions']?['items'] as List<dynamic>? ?? [];
    return topics.isEmpty && papers.isEmpty && qItems.isEmpty;
  }

  bool _showSec(String k) => tab == 'all' || tab == k;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Container(
          height: 38,
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: KgColors.fill,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            children: [
              const Icon(LucideIcons.search, size: 16, color: KgColors.t4),
              const SizedBox(width: 6),
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  autofocus: true,
                  textInputAction: TextInputAction.search,
                  onChanged: _onInput,
                  onSubmitted: (_) => _doSearch(),
                  decoration: const InputDecoration(
                    hintText: '题号 / 题干关键词 / 考点名',
                    hintStyle: TextStyle(fontSize: 13, color: KgColors.t4),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              if (_ctrl.text.isNotEmpty)
                InkWell(
                  onTap: () {
                    _ctrl.clear();
                    setState(() => result = null);
                  },
                  child: const Icon(LucideIcons.x,
                      size: 16, color: KgColors.t3),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(),
            child: const Text('取消',
                style: TextStyle(color: KgColors.t2, fontSize: 14)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Row(
              children: [
                for (final (k, n) in tabs) ...[
                  GestureDetector(
                    onTap: () {
                      setState(() => tab = k);
                      _doSearch();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: tab == k
                            ? KgColors.brand
                            : Theme.of(context).cardTheme.color ??
                                Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(n,
                          style: TextStyle(
                              fontSize: 13,
                              color: tab == k ? Colors.white : KgColors.t2,
                              fontWeight: tab == k
                                  ? FontWeight.w600
                                  : FontWeight.w400)),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final r = result;
    if (r == null) {
      return const Center(
        child: Text('支持搜索：题号语义码、题干关键词、考点名、试卷名',
            style: TextStyle(color: KgColors.t3, fontSize: 13)),
      );
    }
    if (isEmpty) {
      return Center(
        child: Text(
          '没有找到「${r['q']}」相关内容\n可尝试题号（如 ZL-JQ-2024-000914）、题干关键词或考点名',
          textAlign: TextAlign.center,
          style: const TextStyle(color: KgColors.t3, fontSize: 13, height: 1.8),
        ),
      );
    }
    final codeHit = r['code_hit'];
    final topics = r['topics'] as List<dynamic>? ?? [];
    final papers = r['papers'] as List<dynamic>? ?? [];
    final questions = r['questions'];
    final qItems = questions?['items'] as List<dynamic>? ?? [];
    final qTotal = (questions?['total'] as num?)?.toInt() ?? qItems.length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (codeHit != null)
          _qCard(Map<String, dynamic>.from(codeHit), codeBadge: true),
        if (_showSec('topic') && topics.isNotEmpty) ...[
          _secTitle('考点'),
          for (final t in topics) _topicCard(Map<String, dynamic>.from(t)),
        ],
        if (_showSec('paper') && papers.isNotEmpty) ...[
          _secTitle('试卷'),
          for (final p in papers) _paperCard(Map<String, dynamic>.from(p)),
        ],
        if (_showSec('question') && qItems.isNotEmpty) ...[
          _secTitle('题目（$qTotal）'),
          for (final it in qItems) _qCard(Map<String, dynamic>.from(it)),
          if (qTotal > qItems.length)
            TextButton(onPressed: _loadMore, child: const Text('加载更多')),
        ],
      ],
    );
  }

  Widget _secTitle(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(t,
            style: const TextStyle(fontSize: 12, color: KgColors.t3)),
      );

  /// 高亮命中关键词
  Widget _hl(String text, {int maxLines = 3, double fontSize = 13.5}) {
    final q = (result?['q'] ?? '').toString();
    final style =
        TextStyle(fontSize: fontSize, height: 1.6, color: KgColors.t2);
    if (q.isEmpty || !text.contains(q)) {
      return Text(text,
          maxLines: maxLines, overflow: TextOverflow.ellipsis, style: style);
    }
    final parts = text.split(q);
    final spans = <TextSpan>[];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isNotEmpty) spans.add(TextSpan(text: parts[i]));
      if (i < parts.length - 1) {
        spans.add(TextSpan(
            text: q,
            style: const TextStyle(
                color: KgColors.brand, fontWeight: FontWeight.w600)));
      }
    }
    return Text.rich(TextSpan(children: spans, style: style),
        maxLines: maxLines, overflow: TextOverflow.ellipsis);
  }

  Widget _qCard(Map<String, dynamic> it, {bool codeBadge = false}) {
    final id = (it['id'] as num).toInt();
    final open = detail != null && (detail!['id'] as num?)?.toInt() == id;
    final mod = _kMods[it['module']] ?? (it['module'] ?? '').toString();
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _toggleDetail(it),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if ((it['code'] ?? '').toString().isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: codeBadge ? KgColors.brand50 : KgColors.fill,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text((it['code'] ?? '').toString(),
                          style: TextStyle(
                              fontSize: 10,
                              fontFamily: 'monospace',
                              color: codeBadge
                                  ? KgColors.brand
                                  : KgColors.t2)),
                    ),
                  const SizedBox(width: 6),
                  if (it['is_real'] == true || it['is_real'] == 1)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: KgColors.warningBg,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                          '真题${(it['exam_year'] ?? '').toString().isNotEmpty ? ' ${it['exam_year']}' : ''}',
                          style: const TextStyle(
                              fontSize: 10, color: KgColors.warning)),
                    ),
                  const SizedBox(width: 6),
                  Text(
                      '$mod${(it['submodule'] ?? '').toString().isNotEmpty ? ' · ${it['submodule']}' : ''}',
                      style: const TextStyle(
                          fontSize: 10, color: KgColors.t3)),
                ],
              ),
              const SizedBox(height: 6),
              _hl((it['question'] ?? '').toString()),
              if (open) _detailView(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailView() {
    final d = detail!;
    final opts = d['options'];
    final ans = (d['answer'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: KgColors.fill)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (opts is Map)
            for (final e in opts.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text('${e.key}. ${e.value}',
                    style: TextStyle(
                        fontSize: 12.5,
                        height: 1.5,
                        color: '${e.key}' == ans
                            ? KgColors.success
                            : KgColors.t2,
                        fontWeight: '${e.key}' == ans
                            ? FontWeight.w600
                            : FontWeight.w400)),
              ),
          Text('答案：$ans',
              style: const TextStyle(
                  fontSize: 12.5,
                  color: KgColors.success,
                  fontWeight: FontWeight.w600)),
          if ((d['explanation'] ?? '').toString().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text((d['explanation'] ?? '').toString(),
                style: const TextStyle(
                    fontSize: 12.5, height: 1.6, color: KgColors.t2)),
          ],
        ],
      ),
    );
  }

  Widget _topicCard(Map<String, dynamic> t) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _hl((t['name'] ?? '').toString(),
                      maxLines: 1, fontSize: 14),
                  const SizedBox(height: 3),
                  Text(
                    '${t['module_name'] ?? ''} · ${t['group_name'] ?? ''}${(t['n'] as num?) != null && (t['n'] as num) > 0 ? ' · ${t['n']} 题' : ''}',
                    style:
                        const TextStyle(fontSize: 11, color: KgColors.t3),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () => context.push('/practice'),
              child: const Text('去练习 ›', style: TextStyle(fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _paperCard(Map<String, dynamic> p) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _hl((p['title'] ?? '').toString(),
                      maxLines: 1, fontSize: 14),
                  const SizedBox(height: 3),
                  Text(
                    '${p['year'] ?? ''}${(p['region'] ?? '').toString().isNotEmpty ? ' · ${p['region']}' : ''}',
                    style:
                        const TextStyle(fontSize: 11, color: KgColors.t3),
                  ),
                ],
              ),
            ),
            TextButton(
              onPressed: () =>
                  context.push('/exam/run?paper_id=${p['id']}'),
              child: const Text('去做卷 ›', style: TextStyle(fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
