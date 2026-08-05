import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/offline.dart';
import '../theme.dart';

/// 离线题包管理：按模块下载/更新/删除题包 + 待同步队列，
/// 对照 frontend-uni/src/pkgA/user/offline.vue。
class OfflinePage extends StatefulWidget {
  const OfflinePage({super.key});

  @override
  State<OfflinePage> createState() => _OfflinePageState();
}

class _OfflinePageState extends State<OfflinePage> {
  String? downloading;
  bool syncing = false;

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Map<String, dynamic>? _packOf(String module) {
    for (final p in Offline.listPacks()) {
      if (p['module'] == module) return Map<String, dynamic>.from(p as Map);
    }
    return null;
  }

  Future<void> _download(String module) async {
    setState(() => downloading = module);
    try {
      final pack = await Offline.downloadPack(module);
      _toast('已下载 ${(pack['items'] as List).length} 题');
    } catch (e) {
      _toast(Api.errMsg(e));
    }
    if (mounted) setState(() => downloading = null);
  }

  Future<void> _remove(String module, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('删除题包'),
        content: Text('确认删除「$name」离线题包？'),
        actions: [
          TextButton(onPressed: () => c.pop(false), child: const Text('取消')),
          TextButton(onPressed: () => c.pop(true), child: const Text('删除')),
        ],
      ),
    );
    if (ok == true) {
      Offline.removePack(module);
      setState(() {});
      _toast('已删除');
    }
  }

  Future<void> _sync() async {
    setState(() => syncing = true);
    final ok = await Offline.flushQueue();
    if (mounted) {
      setState(() => syncing = false);
      _toast(ok ? '同步完成' : '同步失败，请检查网络后重试');
    }
  }

  String _fmtSize(int bytes) => bytes >= 1024 * 1024
      ? '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB'
      : '${(bytes / 1024).ceil()} KB';

  String _fmtTs(dynamic ts) {
    if (ts is! num) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts.toInt());
    String p(int n) => n.toString().padLeft(2, '0');
    return '${d.month}-${p(d.day)} ${p(d.hour)}:${p(d.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final pending = Offline.pendingCount();
    final usage = Offline.packUsageBytes();
    return Scaffold(
      appBar: AppBar(title: const Text('离线题包')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: kBrandGradient,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(LucideIcons.download, size: 24, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('地铁通勤 · 无网也能刷',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 3),
                      Text(
                        '每包 ${Offline.packSize} 题 · 本地判分 · 联网自动同步（已用 ${_fmtSize(usage)}）',
                        style:
                            const TextStyle(color: Colors.white70, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (pending > 0) ...[
            const SizedBox(height: 12),
            Card(
              color: KgColors.warningBg,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    const Icon(LucideIcons.cloudOff,
                        size: 16, color: KgColors.warning),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('$pending 条离线作答待同步',
                          style: const TextStyle(
                              fontSize: 13, color: KgColors.warning)),
                    ),
                    TextButton(
                      onPressed: syncing ? null : _sync,
                      child: Text(syncing ? '同步中…' : '立即同步',
                          style: const TextStyle(fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child: Text('按模块下载', style: TextStyle(fontSize: 12, color: KgColors.t3)),
          ),
          Card(
            child: Column(
              children: [
                for (var i = 0; i < Offline.packModules.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
                  _moduleRow(Offline.packModules[i].$1, Offline.packModules[i].$2),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () async {
              await context.push('/practice');
              if (mounted) setState(() {});
            },
            icon: const Icon(LucideIcons.play, size: 16),
            label: const Text('开始练习（断网时自动用本地题包）'),
          ),
          const SizedBox(height: 12),
          const Padding(
            padding: EdgeInsets.only(left: 4),
            child: Text(
              '断网练习的作答与错题会先存本地，恢复网络后自动上传并去重，不会重复计入统计。',
              style: TextStyle(fontSize: 11.5, color: KgColors.t3, height: 1.7),
            ),
          ),
        ],
      ),
    );
  }

  Widget _moduleRow(String module, String name) {
    final pack = _packOf(module);
    final busy = downloading == module;
    return ListTile(
      title: Text(name,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      subtitle: Text(
        pack == null
            ? '未下载'
            : '${pack['count']} 题 · ${_fmtSize((pack['size'] as num?)?.toInt() ?? 0)} · 更新于 ${_fmtTs(pack['ts'])}',
        style: const TextStyle(fontSize: 11.5, color: KgColors.t3),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (pack != null)
            IconButton(
              icon: const Icon(LucideIcons.trash2, size: 17, color: KgColors.t3),
              onPressed: () => _remove(module, name),
            ),
          FilledButton.tonal(
            style: FilledButton.styleFrom(
                minimumSize: const Size(76, 34),
                padding: const EdgeInsets.symmetric(horizontal: 12)),
            onPressed: busy ? null : () => _download(module),
            child: Text(
                busy
                    ? '下载中…'
                    : pack == null
                        ? '下载'
                        : '更新',
                style: const TextStyle(fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
