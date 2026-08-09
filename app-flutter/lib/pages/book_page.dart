import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/empty_state.dart';
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
  String modFilter = '';
  String keyword = '';
  String kpFilter = ''; // 二级题型筛选
  String kp3Filter = ''; // 三级考点筛选
  String sortBy = 'time'; // time/times/type/reason/due
  int pageN = 20; // 分页：当前展示条数

  static const _sorts = [
    ('time', '最近优先'),
    ('times', '错次最多'),
    ('type', '按题型'),
    ('reason', '按错因'),
    ('due', '到期优先'),
  ];

  List<Mistake> get filtered {
    final base = all.where((m) {
      if (modFilter.isNotEmpty && m.module != modFilter) return false;
      if (kpFilter.isNotEmpty &&
          (m.questionType ?? m.module ?? '') != kpFilter) {
        return false;
      }
      if (kp3Filter.isNotEmpty && m.tag3Name != kp3Filter) return false;
      if (keyword.isNotEmpty && !m.questionText.contains(keyword)) {
        return false;
      }
      return true;
    }).toList();
    switch (sortBy) {
      case 'times':
        base.sort((a, b) => b.times.compareTo(a.times));
      case 'type':
        base.sort((a, b) => (a.questionType ?? a.module ?? '')
            .compareTo(b.questionType ?? b.module ?? ''));
      case 'reason':
        base.sort((a, b) =>
            (a.errorReason ?? '￿').compareTo(b.errorReason ?? '￿'));
      case 'due':
        base.sort((a, b) =>
            (a.nextReview ?? 9e12).compareTo(b.nextReview ?? 9e12));
      default:
        break; // 后端已按最近在前返回
    }
    return base;
  }

  /// 当前模块下的题型分布（含三级考点子组），复刻 typeGroups。
  List<(String, int)> get typeGroups {
    final map = <String, int>{};
    for (final m in all) {
      if (modFilter.isNotEmpty && m.module != modFilter) continue;
      final t = m.questionType ?? m.module;
      if (t == null || t.isEmpty) continue;
      map[t] = (map[t] ?? 0) + 1;
    }
    final list = map.entries.map((e) => (e.key, e.value)).toList()
      ..sort((a, b) => b.$2.compareTo(a.$2));
    return list;
  }

  /// 题型筛选下的三级考点分布。
  List<(String, int)> get tag3Groups {
    final map = <String, int>{};
    for (final m in all) {
      if (modFilter.isNotEmpty && m.module != modFilter) continue;
      if (kpFilter.isNotEmpty &&
          (m.questionType ?? m.module ?? '') != kpFilter) {
        continue;
      }
      final t = m.tag3Name;
      if (t == null || t.isEmpty) continue;
      map[t] = (map[t] ?? 0) + 1;
    }
    final list = map.entries.map((e) => (e.key, e.value)).toList()
      ..sort((a, b) => b.$2.compareTo(a.$2));
    return list;
  }

  @override
  void initState() {
    super.initState();
    _load();
    _tab.addListener(_onTab);
  }

  @override
  void dispose() {
    _tab.removeListener(_onTab);
    super.dispose();
  }

  /// 切到收藏 tab 时重拉收藏（练习页新收藏的题及时可见）。
  void _onTab() {
    if (!_tab.indexIsChanging && _tab.index == 2) _refreshFavs();
  }

  Future<void> _refreshFavs() async {
    try {
      final f = await Api.favs();
      if (mounted) setState(() => favs = f);
    } catch (_) {/* 非关键路径 */}
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
    final list = filtered;
    final pending = list.where((m) => !m.mastered).toList();
    final mastered = list.where((m) => m.mastered).toList();
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
                    // 模块筛选 + 关键词搜索（复刻 book.vue 筛选栏）
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                      child: SizedBox(
                        height: 36,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: const Text('全部', style: TextStyle(fontSize: 12)),
                                selected: modFilter.isEmpty,
                                onSelected: (_) => setState(() => modFilter = ''),
                                visualDensity: VisualDensity.compact,
                              ),
                            ),
                            for (final e in kModuleNames.entries)
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(e.value, style: const TextStyle(fontSize: 12)),
                                  selected: modFilter == e.key,
                                  onSelected: (_) => setState(() {
                                    modFilter = e.key;
                                    kpFilter = '';
                                    kp3Filter = '';
                                    pageN = 20;
                                  }),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    // 排序（复刻 SORTS）
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                      child: SizedBox(
                        height: 32,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            for (final s in _sorts)
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(s.$2,
                                      style: const TextStyle(fontSize: 11)),
                                  selected: sortBy == s.$1,
                                  onSelected: (_) => setState(() {
                                    sortBy = s.$1;
                                    pageN = 20;
                                  }),
                                  visualDensity: VisualDensity.compact,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    // 二级题型 × 数量（复刻 typeGroups chips）
                    if (typeGroups.length > 1)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                        child: SizedBox(
                          height: 32,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              for (final g in typeGroups)
                                Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ChoiceChip(
                                    label: Text('${g.$1} ×${g.$2}',
                                        style: const TextStyle(fontSize: 11)),
                                    selected: kpFilter == g.$1,
                                    onSelected: (_) => setState(() {
                                      kpFilter =
                                          kpFilter == g.$1 ? '' : g.$1;
                                      kp3Filter = '';
                                      pageN = 20;
                                    }),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    // 三级考点 × 数量（复刻 kp3Filter）
                    if (tag3Groups.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                        child: SizedBox(
                          height: 32,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              for (final g in tag3Groups)
                                Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ChoiceChip(
                                    label: Text('${g.$1} ×${g.$2}',
                                        style: const TextStyle(fontSize: 11)),
                                    selected: kp3Filter == g.$1,
                                    onSelected: (_) => setState(() {
                                      kp3Filter =
                                          kp3Filter == g.$1 ? '' : g.$1;
                                      pageN = 20;
                                    }),
                                    visualDensity: VisualDensity.compact,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                      child: TextField(
                        onChanged: (v) => setState(() => keyword = v.trim()),
                        decoration: InputDecoration(
                          isDense: true,
                          hintText: '搜题干关键词',
                          hintStyle: const TextStyle(fontSize: 13, color: KgColors.t4),
                          prefixIcon: const Icon(LucideIcons.search, size: 16),
                          contentPadding: const EdgeInsets.symmetric(vertical: 8),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: KgColors.border),
                          ),
                        ),
                      ),
                    ),
                    if (modFilter.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: () async {
                              await context.push('/practice?mode=redo&module=$modFilter');
                              _load();
                            },
                            child: Text('重练「${moduleName(modFilter)}」错题'),
                          ),
                        ),
                      ),
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
                                Api.trackEvent('review_entry_click', source: 'book_card');
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
                          _list(pending,
                              empty: '错题本还是空的',
                              emptyDesc: '做错的题会自动收进这里，配合遗忘曲线安排复习',
                              emptyAction: '去刷一组题'),
                          _list(mastered,
                              empty: '还没有已掌握的错题',
                              emptyDesc: '复习中答对的错题会移到这里'),
                          _favList(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _list(List<Mistake> items,
      {required String empty, String? emptyDesc, String? emptyAction}) {
    if (items.isEmpty) {
      return Center(
        child: EmptyState(
          icon: LucideIcons.bookOpen,
          title: empty,
          description: emptyDesc,
          actionLabel: emptyAction,
          onAction: emptyAction == null
              ? null
              : () async {
                  await context.push('/practice');
                  _load();
                },
        ),
      );
    }
    final shown = items.take(pageN).toList();
    final hasMore = items.length > pageN;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: shown.length + (hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          if (i == shown.length) {
            return OutlinedButton(
              onPressed: () => setState(() => pageN += 20),
              child: Text('加载更多（共 ${items.length} 条）'),
            );
          }
          final m = shown[i];
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
                        if (m.tag3Name != null && m.tag3Name!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          _tag(m.tag3Name!, KgColors.brand),
                        ],
                        if (m.errorReason != null && m.errorReason!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          _tag(m.errorReason!, KgColors.warning),
                        ],
                        if (m.mastered) ...[
                          const SizedBox(width: 6),
                          _tag('已掌握', KgColors.success),
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
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (!m.mastered)
                          _op('AI 详解', () {
                            Store.instance.redoQuestion = m.questionText;
                            context.go('/ask');
                          })
                        else
                          _op('恢复复习', () => _master(m, false)),
                        const SizedBox(width: 12),
                        if (!m.mastered) _op('标为已掌握', () => _master(m, true)),
                        const Spacer(),
                        _op('删除', () => _delete(m), color: KgColors.error),
                      ],
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

  Future<void> _master(Mistake m, bool v) async {
    try {
      await Api.patchMistake(m.id, {'mastered': v ? 1 : 0});
      setState(() => m.mastered = v);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _delete(Mistake m) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('删除这道错题？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('取消')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('删除')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.deleteMistake(m.id);
      setState(() {
        all.removeWhere((x) => x.id == m.id);
        // 删空当前筛选结果时重置筛选，避免残留隐形筛选显示空态
        if (filtered.isEmpty) {
          kpFilter = '';
          kp3Filter = '';
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Widget _favList() {
    if (favs.isEmpty) {
      return const Center(
        child: EmptyState(
          icon: LucideIcons.star,
          title: '还没有收藏的题目',
          description: '作答解析页点「收藏」，好题随时回看',
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: favs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final f = Map<String, dynamic>.from(favs[i]);
        final text =
            (f['question'] ?? f['question_text'] ?? '题目 #${f['id']}')
                .toString();
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  text,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, height: 1.5),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _op('AI 详解', () {
                      Store.instance.redoQuestion = text;
                      context.go('/ask');
                    }),
                    const Spacer(),
                    _op('取消收藏', () => _unfav(f), color: KgColors.error),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _unfav(Map<String, dynamic> f) async {
    // /api/favs 返回的是题目展开字段，题目 id 在 `id`
    final qid = f['id'];
    if (qid is! num) return;
    try {
      await Api.removeFav(qid.toInt());
      setState(() => favs.removeWhere(
          (x) => Map<String, dynamic>.from(x)['id'] == qid));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Widget _op(String text, VoidCallback onTap, {Color color = KgColors.brand}) {
    return InkWell(
      onTap: onTap,
      child: Text(text,
          style: TextStyle(
              fontSize: 12, color: color, fontWeight: FontWeight.w600)),
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
