import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';

const kShenlunQTypes = ['全部', '归纳概括', '综合分析', '提出对策', '贯彻执行', '大作文'];
const kShenlunMTypes = ['全部', '金句', '案例', '政策理论', '范文'];

/// 申论：真题题库（筛选）/ 素材范文 / 作答记录 三分段。复刻 pkgA/shenlun/shenlun.vue。
class ShenlunPage extends StatefulWidget {
  const ShenlunPage({super.key, this.initialTab = 'q'});

  final String initialTab;

  @override
  State<ShenlunPage> createState() => _ShenlunPageState();
}

class _ShenlunPageState extends State<ShenlunPage> {
  String tab = 'q';
  String qtype = '全部';
  String mtype = '全部';
  bool loading = false;
  List<dynamic> qs = [];
  List<dynamic> mats = [];
  List<dynamic> recs = [];
  bool recLoading = false;
  bool recLoaded = false;
  int qOffset = 0;
  int mOffset = 0;
  bool qEnd = false;
  bool mEnd = false;
  int qTotal = 0;
  List<int> years = [];
  List<String> regions = [];
  int year = 0;
  String region = '';
  bool favOnly = false;
  List<int> favIds = Store.instance.slMatFavIds;
  List<dynamic> favMats = Store.instance.slMatFavs;
  bool favSynced = false;
  List<int> qFavIds = Store.instance.slQFavIds;
  int? expanded;
  String? expandedRec;

  @override
  void initState() {
    super.initState();
    tab = widget.initialTab;
    _loadQs();
    _loadFilters();
    if (tab == 'm') _switchMat();
    if (tab == 'r') _switchRec();
  }

  Future<void> _loadQs({bool append = false}) async {
    setState(() => loading = !append);
    try {
      final d = await Api.shenlunQuestions(
        offset: qOffset,
        qtype: qtype == '全部' ? null : qtype,
        year: year,
        region: region,
      );
      final items = d['items'] as List<dynamic>? ?? [];
      setState(() {
        qEnd = items.length < 20;
        qTotal = (d['total'] as num?)?.toInt() ?? items.length;
        qs = append ? [...qs, ...items] : items;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      _toast('加载失败：${Api.errMsg(e)}');
    }
  }

  Future<void> _loadMats({bool append = false}) async {
    setState(() => loading = !append);
    try {
      final d = await Api.shenlunMaterials(
        offset: mOffset,
        type: mtype == '全部' ? null : mtype,
      );
      final items = d['items'] as List<dynamic>? ?? [];
      setState(() {
        mEnd = items.length < 20;
        mats = append ? [...mats, ...items] : items;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      _toast('加载失败：${Api.errMsg(e)}');
    }
  }

  Future<void> _loadFilters() async {
    try {
      final d = await Api.shenlunFilters();
      setState(() {
        years = (d['years'] as List<dynamic>? ?? [])
            .map((e) => (e as num).toInt())
            .toList();
        regions = (d['regions'] as List<dynamic>? ?? [])
            .map((e) => e.toString())
            .toList();
      });
    } catch (_) {/* 筛选项加载失败不阻断列表 */}
  }

  void _switchMat() {
    setState(() => tab = 'm');
    if (mats.isEmpty) _loadMats();
    if (!favSynced) {
      favSynced = true;
      _syncFavs();
    }
  }

  Future<void> _switchRec() async {
    setState(() {
      tab = 'r';
      recLoading = !recLoaded;
    });
    try {
      final items = await Api.shenlunHistory();
      setState(() {
        recs = items;
        recLoaded = true;
        recLoading = false;
      });
    } catch (e) {
      setState(() => recLoading = false);
      _toast('加载失败：${Api.errMsg(e)}');
    }
  }

  Future<void> _syncFavs() async {
    try {
      final d = await Api.shenlunMatFavs();
      final serverIds = (d['ids'] as List<dynamic>? ?? [])
          .map((e) => (e as num).toInt())
          .toList();
      final localOnly = favIds.where((id) => !serverIds.contains(id)).toList();
      for (final id in localOnly) {
        Api.shenlunMatFavSet(id, true).catchError((_) {});
      }
      final merged = (d['items'] as List<dynamic>? ?? [])
          .where((x) => !localOnly.contains((x['id'] as num).toInt()))
          .toList();
      setState(() {
        favMats = [
          ...favMats.where((x) => localOnly.contains((x['id'] as num).toInt())),
          ...merged,
        ];
        favIds = favMats.map((x) => (x['id'] as num).toInt()).toList();
      });
      Store.instance.slMatFavIds = favIds;
      Store.instance.slMatFavs = favMats;
    } catch (_) {/* 非关键路径 */}
  }

  void _toggleFav(Map<String, dynamic> m) {
    final id = (m['id'] as num).toInt();
    final on = !favIds.contains(id);
    setState(() {
      if (on) {
        favIds = [...favIds, id];
        favMats = [m, ...favMats];
      } else {
        favIds = favIds.where((x) => x != id).toList();
        favMats =
            favMats.where((x) => (x['id'] as num).toInt() != id).toList();
      }
    });
    Store.instance.slMatFavIds = favIds;
    Store.instance.slMatFavs = favMats;
    Api.shenlunMatFavSet(id, on).catchError((_) {});
  }

  void _toggleQFav(int id) {
    setState(() {
      qFavIds = qFavIds.contains(id)
          ? qFavIds.where((x) => x != id).toList()
          : [...qFavIds, id];
    });
    Store.instance.slQFavIds = qFavIds;
  }

  String _qMeta(String text) {
    final score = RegExp(r'(\d+)\s*分').firstMatch(text)?.group(1);
    final words = RegExp(r'不超过\s*(\d+)\s*字').firstMatch(text)?.group(1);
    final parts = <String>[];
    if (score != null) parts.add('$score 分');
    if (words != null) parts.add('≤$words 字');
    return parts.join(' · ');
  }

  static String fmtTime(num? ts) {
    final d = DateTime.fromMillisecondsSinceEpoch(((ts ?? 0) * 1000).toInt());
    String p(int n) => n < 10 ? '0$n' : '$n';
    return '${d.year}-${p(d.month)}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}';
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  int get fltCount => (year != 0 ? 1 : 0) + (region.isNotEmpty ? 1 : 0);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('申论')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: _segBar(),
          ),
          Expanded(
            child: switch (tab) {
              'm' => _matsView(),
              'r' => _recsView(),
              _ => _qsView(),
            },
          ),
        ],
      ),
    );
  }

  Widget _segBar() {
    Widget seg(String k, String label, VoidCallback onTap) {
      final on = tab == k;
      return Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: on
                  ? Theme.of(context).cardTheme.color ?? Colors.white
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              boxShadow: on
                  ? [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: .06),
                          blurRadius: 4)
                    ]
                  : null,
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: on ? KgColors.brand : KgColors.t2,
                fontWeight: on ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: KgColors.border,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          seg('q', '真题题库', () => setState(() => tab = 'q')),
          seg('m', '素材/范文', _switchMat),
          seg('r', '作答记录', _switchRec),
        ],
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback onTap, {Widget? icon}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: on
              ? KgColors.brand
              : Theme.of(context).cardTheme.color ?? Colors.white,
          border: Border.all(color: on ? KgColors.brand : KgColors.border),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[icon, const SizedBox(width: 3)],
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    color: on ? Colors.white : KgColors.t2)),
          ],
        ),
      ),
    );
  }

  // ---------- 题库 ----------

  Widget _qsView() {
    return RefreshIndicator(
      onRefresh: () async {
        qOffset = 0;
        qEnd = false;
        await _loadQs();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final t in kShenlunQTypes) ...[
                        _chip(t, qtype == t, () {
                          setState(() {
                            qtype = t;
                            qOffset = 0;
                            qEnd = false;
                          });
                          _loadQs();
                        }),
                        const SizedBox(width: 8),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 6),
              _chip('筛选${fltCount > 0 ? ' $fltCount' : ''}', fltCount > 0,
                  _openFilterSheet,
                  icon: Icon(LucideIcons.slidersHorizontal,
                      size: 12,
                      color: fltCount > 0 ? Colors.white : KgColors.t2)),
            ],
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (qs.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                  child: Text('暂无题目，敬请期待',
                      style: TextStyle(color: KgColors.t3))),
            )
          else ...[
            for (final q in qs) _qCard(Map<String, dynamic>.from(q)),
            if (!qEnd && qs.length >= 20)
              TextButton(
                onPressed: () {
                  qOffset += 20;
                  _loadQs(append: true);
                },
                child: const Text('加载更多'),
              ),
          ],
        ],
      ),
    );
  }

  void _openFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) {
          void apply(void Function() fn) {
            setSheet(fn);
            setState(() {
              qOffset = 0;
              qEnd = false;
            });
            _loadQs();
          }

          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('筛选',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    IconButton(
                        onPressed: () => Navigator.pop(c),
                        icon: const Icon(LucideIcons.x, size: 20)),
                  ],
                ),
                if (years.isNotEmpty) ...[
                  const Text('年份',
                      style: TextStyle(fontSize: 13, color: KgColors.t3)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _chip('全部', year == 0,
                          () => apply(() => year = 0)),
                      for (final y in years)
                        _chip('$y', year == y,
                            () => apply(() => year = year == y ? 0 : y)),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                if (regions.isNotEmpty) ...[
                  const Text('地区',
                      style: TextStyle(fontSize: 13, color: KgColors.t3)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _chip('全部', region.isEmpty,
                          () => apply(() => region = '')),
                      for (final r in regions)
                        _chip(r, region == r,
                            () => apply(() => region = region == r ? '' : r)),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: OutlinedButton(
                        onPressed: () => apply(() {
                          year = 0;
                          region = '';
                        }),
                        child: const Text('重置'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 7,
                      child: FilledButton(
                        onPressed: () => Navigator.pop(c),
                        child: Text('查看 $qTotal 道题'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _qCard(Map<String, dynamic> q) {
    final id = (q['id'] as num).toInt();
    final paper = (q['paper'] ?? '').toString().isNotEmpty
        ? q['paper'].toString()
        : '${q['exam_year'] ?? ''} · ${q['exam_region'] ?? ''}';
    final meta = _qMeta((q['question'] ?? '').toString());
    final faved = qFavIds.contains(id);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openDetail(id),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _tag(paper, KgColors.warning),
                  const Spacer(),
                  _tag((q['qtype'] ?? '申论').toString(), KgColors.brand),
                  const SizedBox(width: 4),
                  InkWell(
                    onTap: () => _toggleQFav(id),
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(LucideIcons.star,
                          size: 17,
                          color: faved ? KgColors.warning : KgColors.t4),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                (q['question'] ?? '').toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.6),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(meta,
                      style:
                          const TextStyle(fontSize: 12, color: KgColors.t3)),
                  const Spacer(),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      textStyle: const TextStyle(fontSize: 13),
                    ),
                    onPressed: () => _openDetail(id),
                    child: const Text('去作答'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openDetail(int id) async {
    await context.push('/shenlun/detail/$id');
    if (tab == 'r') _switchRec();
  }

  // ---------- 素材 ----------

  Widget _matsView() {
    final shown = favOnly ? favMats : mats;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final t in kShenlunMTypes)
              _chip(t, mtype == t && !favOnly, () {
                setState(() {
                  favOnly = false;
                  mtype = t;
                  mOffset = 0;
                  mEnd = false;
                });
                _loadMats();
              }),
            _chip('收藏${favIds.isNotEmpty ? ' ${favIds.length}' : ''}', favOnly,
                () => setState(() => favOnly = !favOnly),
                icon: Icon(LucideIcons.star,
                    size: 12, color: favOnly ? Colors.white : KgColors.t3)),
          ],
        ),
        const SizedBox(height: 12),
        if (loading && !favOnly)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Text(
                favOnly ? '还没有收藏素材，点素材右上星标收藏' : '暂无素材，敬请期待',
                style: const TextStyle(color: KgColors.t3),
              ),
            ),
          )
        else ...[
          for (final m in shown) _matCard(Map<String, dynamic>.from(m)),
          if (!favOnly && !mEnd && mats.length >= 20)
            TextButton(
              onPressed: () {
                mOffset += 20;
                _loadMats(append: true);
              },
              child: const Text('加载更多'),
            ),
        ],
      ],
    );
  }

  Widget _matCard(Map<String, dynamic> m) {
    final id = (m['id'] as num).toInt();
    final faved = favIds.contains(id);
    final open = expanded == id;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text((m['topic'] ?? '').toString(),
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                ),
                _tag((m['type'] ?? '素材').toString(), KgColors.brand),
                const SizedBox(width: 4),
                InkWell(
                  onTap: () => _toggleFav(m),
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Icon(LucideIcons.star,
                        size: 17,
                        color: faved ? KgColors.warning : KgColors.t4),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => setState(() => expanded = open ? null : id),
              child: Text(
                (m['content'] ?? '').toString(),
                maxLines: open ? null : 4,
                overflow: open ? null : TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13.5, height: 1.7, color: KgColors.t2),
              ),
            ),
            if ((m['source'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('出处：${m['source']}',
                  style: const TextStyle(fontSize: 12, color: KgColors.t3)),
            ],
          ],
        ),
      ),
    );
  }

  // ---------- 作答记录 ----------

  Widget _recsView() {
    if (recLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (recs.isEmpty) {
      return const Center(
        child: Text('还没有作答记录，去题库作答并 AI 批改后会自动保存',
            style: TextStyle(color: KgColors.t3, fontSize: 13)),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final r in recs) _recCard(Map<String, dynamic>.from(r)),
      ],
    );
  }

  Widget _recCard(Map<String, dynamic> r) {
    final key = 'r${r['id']}';
    final open = expandedRec == key;
    final body = '【我的作答】\n${r['answer'] ?? ''}'
        '${(r['result'] ?? '').toString().isNotEmpty ? '\n\n【批改结果】\n${r['result']}' : ''}';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(fmtTime(r['created_at'] as num?),
                    style:
                        const TextStyle(fontSize: 11, color: KgColors.t3)),
                const Spacer(),
                _tag((r['qtype'] ?? '申论').toString(), KgColors.brand),
              ],
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () {
                final qid = (r['qid'] as num?)?.toInt();
                if (qid != null) _openDetail(qid);
              },
              child: Text(
                (r['question'] ?? '（题目已下线）').toString(),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.6),
              ),
            ),
            const SizedBox(height: 8),
            InkWell(
              onTap: () =>
                  setState(() => expandedRec = open ? null : key),
              child: Text(
                body,
                maxLines: open ? null : 4,
                overflow: open ? null : TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13, height: 1.7, color: KgColors.t2),
              ),
            ),
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
          style: TextStyle(
              fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
