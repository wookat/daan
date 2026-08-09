import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 刷题小队：我的小队列表 / 创建 / 凭邀请码加入（复刻 pkgA/team/team.vue home 视图）。
/// 也支持从剪贴板粘贴邀请链接（code=XXX）或分享链接（sid=xxx）进入对应页面。
class TeamPage extends StatefulWidget {
  const TeamPage({super.key, this.joinCode});

  final String? joinCode;

  @override
  State<TeamPage> createState() => _TeamPageState();
}

class _TeamPageState extends State<TeamPage> {
  List<dynamic> teams = [];
  bool loaded = false;
  final joinCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final code = (widget.joinCode ?? '').trim();
    if (code.isNotEmpty) {
      joinCtrl.text = code.toUpperCase();
      Api.trackEvent('team_join_open', source: 'team', ref: code.toUpperCase());
    }
    _load();
  }

  @override
  void dispose() {
    joinCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final items = await Api.teamMine();
      if (mounted) setState(() => teams = items);
    } catch (_) {/* 非关键路径 */}
    if (mounted) setState(() => loaded = true);
  }

  Future<void> _openPanel(int id) async {
    await context.push('/team/panel/$id');
    _load();
  }

  Future<void> _create() async {
    final ctrl = TextEditingController();
    final name = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (c) => Padding(
        padding: EdgeInsets.only(
            left: 20, right: 20, bottom: MediaQuery.of(c).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('创建刷题小队',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 14),
            TextField(
              controller: ctrl,
              autofocus: true,
              maxLength: 20,
              decoration: const InputDecoration(hintText: '小队名，如：上岸冲刺队'),
            ),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: () => Navigator.pop(c, ctrl.text.trim()),
              child: const Text('创建并生成邀请码'),
            ),
          ],
        ),
      ),
    );
    if (name == null || name.isEmpty || !mounted) return;
    try {
      final d = await Api.teamCreate(name);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('小队已创建')));
      final team = Map<String, dynamic>.from(d['team'] as Map);
      _openPanel((team['id'] as num).toInt());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _join() async {
    var code = joinCtrl.text.trim().toUpperCase();
    // 支持直接粘贴邀请链接
    final m = RegExp(r'code=([A-Za-z0-9]+)').firstMatch(code);
    if (m != null) code = m.group(1)!.toUpperCase();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请输入邀请码')));
      return;
    }
    try {
      final d = await Api.teamJoin(code);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(d['already'] == true ? '你已在该小队' : '加入成功！')));
      joinCtrl.clear();
      final team = Map<String, dynamic>.from(d['team'] as Map);
      _openPanel((team['id'] as num).toInt());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  /// 从剪贴板识别分享链接（sid=）或邀请链接（code=），路由到对应页面。
  Future<void> _pasteOpen() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = (data?.text ?? '').trim();
    if (!mounted) return;
    final sid = RegExp(r'sid=([A-Za-z0-9_-]+)').firstMatch(text);
    if (sid != null) {
      context.push('/share?sid=${sid.group(1)}');
      return;
    }
    final rid = RegExp(r'rid=([A-Za-z0-9]+)').firstMatch(text);
    if (rid != null) {
      context.push('/pk-result?rid=${rid.group(1)}');
      return;
    }
    final code = RegExp(r'code=([A-Za-z0-9]+)').firstMatch(text);
    if (code != null) {
      joinCtrl.text = code.group(1)!.toUpperCase();
      _join();
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('剪贴板中没有识别到分享链接或邀请码')));
  }

  @override
  Widget build(BuildContext context) {
    final kg = context.kg;
    return Scaffold(
      appBar: AppBar(
        title: const Text('刷题小队'),
        actions: [
          IconButton(
            tooltip: '粘贴分享/邀请链接',
            onPressed: _pasteOpen,
            icon: const Icon(LucideIcons.clipboardPaste, size: 18),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: kBrandGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Icon(LucideIcons.users, size: 20, color: Colors.white),
                  SizedBox(width: 8),
                  Text('刷题小队',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Colors.white)),
                ]),
                SizedBox(height: 8),
                Text('和队友一起打卡 · 看谁今天没刷题 · 互相催学',
                    style: TextStyle(fontSize: 12, color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (loaded && teams.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text('还没有小队。创建一个小队，把邀请码发给考友，一起打卡刷题！',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: kg.t3, height: 1.7)),
              ),
            ),
          for (final t in teams) _teamRow(Map<String, dynamic>.from(t)),
          const SizedBox(height: 8),
          FilledButton(onPressed: _create, child: const Text('创建小队')),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: joinCtrl,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    hintText: '输入 6 位邀请码',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                style: OutlinedButton.styleFrom(minimumSize: const Size(88, 48)),
                onPressed: _join,
                child: const Text('加入'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teamRow(Map<String, dynamic> t) {
    final kg = context.kg;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: ListTile(
          title: Text((t['name'] ?? '').toString(),
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          subtitle: Text(
              '${t['n_members'] ?? 1} 名队友 · 邀请码 ${t['invite_code'] ?? ''}',
              style: TextStyle(fontSize: 12, color: kg.t3)),
          trailing: const Text('看队友 ›',
              style: TextStyle(
                  fontSize: 13, color: KgColors.brand, fontWeight: FontWeight.w600)),
          onTap: () => _openPanel((t['id'] as num).toInt()),
        ),
      ),
    );
  }
}
