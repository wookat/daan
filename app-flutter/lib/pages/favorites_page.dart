import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

const _kMods = {
  'ziliao': '资料分析',
  'shuliang': '数量关系',
  'yanyu': '言语理解',
  'panduan': '判断推理',
  'changshi': '常识判断',
};

const _kModColors = {
  'changshi': (Color(0xFFFEF3C7), Color(0xFFB45309)),
  'shuliang': (Color(0xFFDBEAFE), Color(0xFF1D4ED8)),
  'panduan': (Color(0xFFEDE9FE), Color(0xFF6D28D9)),
  'ziliao': (Color(0xFFD1FAE5), Color(0xFF047857)),
  'yanyu': (Color(0xFFFEE2E2), Color(0xFFB91C1C)),
};

/// 收藏夹 + 我的笔记。复刻 pkgA/social/favorites.vue。
class FavoritesPage extends StatefulWidget {
  const FavoritesPage({super.key});

  @override
  State<FavoritesPage> createState() => _FavoritesPageState();
}

class _FavoritesPageState extends State<FavoritesPage> {
  String tab = 'fav';
  List<dynamic> folders = [];
  int? folderId;
  List<dynamic> items = [];
  List<dynamic> notes = [];
  String modFilter = '';
  bool loading = true;
  int? openId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final rs = await Future.wait([Api.favFolders(), Api.favs()]);
      setState(() {
        folders = rs[0];
        items = rs[1];
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _switchNote() async {
    setState(() {
      tab = 'note';
      loading = true;
    });
    try {
      final n = await Api.notes();
      setState(() {
        notes = n;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
      _toast(Api.errMsg(e));
    }
  }

  List<dynamic> get shownItems {
    var list = items;
    if (folderId != null) {
      list = list.where((it) => it['folder_id'] == folderId).toList();
    }
    if (modFilter.isNotEmpty) {
      list = list.where((it) => it['module'] == modFilter).toList();
    }
    return list;
  }

  String get curFolderName {
    if (folderId == null) return '全部收藏';
    final f = folders.where((x) => x['id'] == folderId).toList();
    return f.isNotEmpty ? '「${f.first['name']}」' : '本夹';
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _newFolder() async {
    final ctrl = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('新建收藏夹'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: '夹名，如：图推·必背规律'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim()),
              child: const Text('创建')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      await Api.createFavFolder(name);
      _load();
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _folderOps(Map<String, dynamic> f) async {
    final fid = (f['id'] as num?)?.toInt();
    if (fid == null || fid == 0) return; // 默认夹不可改
    final op = await showModalBottomSheet<String>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.pencil, size: 18),
              title: const Text('重命名'),
              onTap: () => Navigator.pop(c, 'rename'),
            ),
            ListTile(
              leading:
                  const Icon(LucideIcons.trash2, size: 18, color: KgColors.error),
              title: const Text('删除（夹内收藏移回默认夹）',
                  style: TextStyle(color: KgColors.error)),
              onTap: () => Navigator.pop(c, 'delete'),
            ),
          ],
        ),
      ),
    );
    if (op == 'rename') {
      if (!mounted) return;
      final ctrl = TextEditingController(text: (f['name'] ?? '').toString());
      final name = await showDialog<String>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('重命名收藏夹'),
          content: TextField(controller: ctrl, autofocus: true),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(c), child: const Text('取消')),
            FilledButton(
                onPressed: () => Navigator.pop(c, ctrl.text.trim()),
                child: const Text('保存')),
          ],
        ),
      );
      if (name == null || name.isEmpty) return;
      try {
        await Api.renameFavFolder(fid, name);
        _load();
      } catch (e) {
        _toast(Api.errMsg(e));
      }
    } else if (op == 'delete') {
      if (!mounted) return;
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text('删除「${f['name']}」？'),
          content: const Text('夹内收藏会移回默认收藏夹'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(c, false),
                child: const Text('取消')),
            FilledButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('删除')),
          ],
        ),
      );
      if (ok != true) return;
      try {
        await Api.deleteFavFolder(fid);
        if (folderId == fid) folderId = null;
        _load();
      } catch (e) {
        _toast(Api.errMsg(e));
      }
    }
  }

  Future<void> _moveItem(Map<String, dynamic> it) async {
    final f = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final f in folders)
              ListTile(
                leading: Text((f['icon'] ?? '📁').toString(),
                    style: const TextStyle(fontSize: 18)),
                title: Text((f['name'] ?? '').toString()),
                onTap: () =>
                    Navigator.pop(c, Map<String, dynamic>.from(f)),
              ),
          ],
        ),
      ),
    );
    if (f == null) return;
    try {
      final fid = (f['id'] as num?)?.toInt();
      await Api.setFav((it['id'] as num).toInt(),
          folderId: fid == 0 ? null : fid);
      _toast('已移入「${f['name']}」');
      _load();
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _unfav(Map<String, dynamic> it) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('取消收藏这道题？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true), child: const Text('确定')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await Api.removeFav((it['id'] as num).toInt());
      _load();
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  static String _fmtDate(num? ts) {
    final d = DateTime.fromMillisecondsSinceEpoch(((ts ?? 0) * 1000).toInt());
    return '${d.month}/${d.day}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('收藏与笔记')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: context.kg.border,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  _seg('fav', '收藏题目', () => setState(() => tab = 'fav')),
                  _seg('note', '我的笔记', _switchNote),
                ],
              ),
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : tab == 'fav'
                    ? _favView()
                    : _noteView(),
          ),
        ],
      ),
    );
  }

  Widget _seg(String k, String label, VoidCallback onTap) {
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
          ),
          child: Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 13,
                  color: on ? KgColors.brand : context.kg.t2,
                  fontWeight: on ? FontWeight.w600 : FontWeight.w400)),
        ),
      ),
    );
  }

  Widget _favView() {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                for (final f in folders)
                  _folderTile(Map<String, dynamic>.from(f)),
                ListTile(
                  dense: true,
                  leading: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: context.kg.brandBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(LucideIcons.folderPlus,
                        size: 17, color: KgColors.brand),
                  ),
                  title: const Text('新建收藏夹',
                      style: TextStyle(
                          fontSize: 14,
                          color: KgColors.brand,
                          fontWeight: FontWeight.w600)),
                  onTap: _newFolder,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip('全部模块', modFilter.isEmpty,
                  () => setState(() => modFilter = '')),
              for (final e in _kMods.entries)
                _chip(
                    e.value,
                    modFilter == e.key,
                    () => setState(() =>
                        modFilter = modFilter == e.key ? '' : e.key)),
            ],
          ),
          const SizedBox(height: 12),
          if (shownItems.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Column(
                children: [
                  Text('这里还没有收藏',
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: context.kg.t2)),
                  SizedBox(height: 4),
                  Text('刷题时点右上角收藏星标收藏好题，长按可选收藏夹',
                      style: TextStyle(fontSize: 12, color: context.kg.t3)),
                ],
              ),
            )
          else ...[
            FilledButton(
              onPressed: () => context.push('/practice?mode=redo'),
              child: Text('重练$curFolderName（${shownItems.length} 题）'),
            ),
            const SizedBox(height: 12),
            for (final it in shownItems)
              _qItem(Map<String, dynamic>.from(it)),
          ],
        ],
      ),
    );
  }

  Widget _folderTile(Map<String, dynamic> f) {
    final fid = (f['id'] as num?)?.toInt();
    final on = folderId == fid;
    return InkWell(
      onTap: () => setState(() => folderId = on ? null : fid),
      onLongPress: () => _folderOps(f),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: context.kg.brandBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text((f['icon'] ?? '📁').toString(),
                  style: const TextStyle(fontSize: 16)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text((f['name'] ?? '').toString(),
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: on ? KgColors.brand : null)),
                  Text('${f['n'] ?? 0} 题',
                      style: TextStyle(
                          fontSize: 11, color: context.kg.t3)),
                ],
              ),
            ),
            Icon(on ? LucideIcons.check : LucideIcons.chevronRight,
                size: 16, color: on ? KgColors.brand : context.kg.t4),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: on ? context.kg.brandBg : context.kg.fill,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12,
                color: on ? KgColors.brand : context.kg.t2,
                fontWeight: on ? FontWeight.w700 : FontWeight.w400)),
      ),
    );
  }

  Widget _modTag(String? mod) {
    final c = _kModColors[mod] ?? (context.kg.brandBg, KgColors.brand);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.$1,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(_kMods[mod] ?? mod ?? '',
          style: TextStyle(fontSize: 10, color: c.$2)),
    );
  }

  Widget _qItem(Map<String, dynamic> it) {
    final id = (it['id'] as num).toInt();
    final open = openId == id;
    final note = (it['note'] ?? '').toString();
    final opts = it['options'];
    final ans = (it['answer'] ?? '').toString();
    final exp =
        (it['hs_explanation'] ?? it['explanation'] ?? '').toString();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => openId = open ? null : id),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text((it['question'] ?? '').toString(),
                  maxLines: open ? null : 2,
                  overflow: open ? null : TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14, height: 1.65)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _modTag(it['module']?.toString()),
                  const SizedBox(width: 6),
                  if ((it['submodule'] ?? '').toString().isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: context.kg.fill,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text((it['submodule'] ?? '').toString(),
                          style: TextStyle(
                              fontSize: 10, color: context.kg.t3)),
                    ),
                  const Spacer(),
                  Text('收藏于 ${_fmtDate(it['faved_at'] as num?)}',
                      style:
                          TextStyle(fontSize: 11, color: context.kg.t3)),
                ],
              ),
              if (note.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: context.kg.warningBg,
                    border: Border(
                        left: BorderSide(color: KgColors.warning, width: 3)),
                    borderRadius: BorderRadius.only(
                        topRight: Radius.circular(8),
                        bottomRight: Radius.circular(8)),
                  ),
                  child: Text('✎ 我的笔记：$note',
                      style: TextStyle(
                          fontSize: 12, color: context.kg.t2, height: 1.6)),
                ),
              ],
              if (open) ...[
                const Divider(height: 20),
                if (opts is Map)
                  for (final e in opts.entries)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text('${e.key}. ${e.value}',
                          style: TextStyle(
                              fontSize: 13,
                              height: 1.6,
                              color: '${e.key}' == ans
                                  ? KgColors.success
                                  : context.kg.t2,
                              fontWeight: '${e.key}' == ans
                                  ? FontWeight.w600
                                  : FontWeight.w400)),
                    ),
                Text('正确答案 $ans',
                    style: TextStyle(
                        fontSize: 12, color: context.kg.t3)),
                if (exp.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: context.kg.fill,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(exp,
                        style: TextStyle(
                            fontSize: 12, height: 1.7, color: context.kg.t2)),
                  ),
                ],
                const SizedBox(height: 10),
                Row(
                  children: [
                    _op('移动到…', () => _moveItem(it)),
                    const SizedBox(width: 24),
                    _op('讨论区', () => context.push('/discuss?qid=$id')),
                    const SizedBox(width: 24),
                    _op('取消收藏', () => _unfav(it), danger: true),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _op(String label, VoidCallback onTap, {bool danger = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Text(label,
          style: TextStyle(
              fontSize: 13,
              color: danger ? KgColors.error : KgColors.brand)),
    );
  }

  Widget _noteView() {
    if (notes.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('还没有笔记',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: context.kg.t2)),
            SizedBox(height: 4),
            Text('答题后在解析下方「写笔记」，方法心得随题沉淀',
                style: TextStyle(fontSize: 12, color: context.kg.t3)),
          ],
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final n in notes) _noteItem(Map<String, dynamic>.from(n)),
      ],
    );
  }

  Widget _noteItem(Map<String, dynamic> n) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((n['question'] ?? '').toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.65)),
            const SizedBox(height: 8),
            Row(
              children: [
                _modTag(n['module']?.toString()),
                const SizedBox(width: 6),
                if ((n['submodule'] ?? '').toString().isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: context.kg.fill,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text((n['submodule'] ?? '').toString(),
                        style: TextStyle(
                            fontSize: 10, color: context.kg.t3)),
                  ),
                const Spacer(),
                Text(_fmtDate(n['updated_at'] as num?),
                    style: TextStyle(fontSize: 11, color: context.kg.t3)),
              ],
            ),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: context.kg.warningBg,
                border:
                    Border(left: BorderSide(color: KgColors.warning, width: 3)),
                borderRadius: BorderRadius.only(
                    topRight: Radius.circular(8),
                    bottomRight: Radius.circular(8)),
              ),
              child: Text('✎ ${n['content'] ?? ''}',
                  style: TextStyle(
                      fontSize: 12, color: context.kg.t2, height: 1.6)),
            ),
          ],
        ),
      ),
    );
  }
}
