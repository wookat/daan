import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

const _site = 'https://kaogong.zalize.com';

/// 小队面板：成员打卡矩阵（近 7 天）、提醒 TA（系统分享面板）、邀请与退出。
/// 复刻 pkgA/team/team.vue panel 视图。
class TeamPanelPage extends StatefulWidget {
  const TeamPanelPage({super.key, required this.teamId});

  final int teamId;

  @override
  State<TeamPanelPage> createState() => _TeamPanelPageState();
}

class _TeamPanelPageState extends State<TeamPanelPage> {
  Map<String, dynamic>? panel;
  bool loading = true;
  String? error;

  static const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
  int get todayIdx => (DateTime.now().weekday + 6) % 7;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.teamPanel(widget.teamId);
      setState(() {
        panel = d;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        error = Api.errMsg(e);
      });
    }
  }

  Map<String, dynamic> get _team => Map<String, dynamic>.from(panel!['team'] as Map);
  List<Map<String, dynamic>> get _members =>
      (panel!['members'] as List<dynamic>? ?? [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  String _inviteUrl() => '$_site/#/pages/team/join?code=${_team['invite_code']}';

  void _invite() {
    Share.share(
        '我在考公助手建了刷题小队「${_team['name']}」，一起打卡刷题冲上岸！邀请码 ${_team['invite_code']}，点链接直接加入：${_inviteUrl()}');
  }

  void _remind(Map<String, dynamic> m) {
    Share.share(
        '「${m['nickname']}」今天还没刷题哦！我在考公助手小队「${_team['name']}」等你打卡，别掉队：${_inviteUrl()}');
  }

  Future<void> _leave() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('退出小队'),
        content: const Text('退出后将不再显示在队友面板中，可凭邀请码重新加入。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('退出', style: TextStyle(color: KgColors.error))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await Api.teamLeave(widget.teamId);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  String _memDesc(Map<String, dynamic> m) {
    final parts = <String>[];
    final streak = (m['streak'] as num?)?.toInt() ?? 0;
    parts.add(streak > 0 ? '连续打卡 $streak 天' : '打卡中断');
    final todayN = (m['today_n'] as num?)?.toInt() ?? 0;
    if (todayN > 0) {
      parts.add('今日正确率 ${m['today_acc']}%');
    } else {
      parts.add('今天还没刷题');
    }
    final la = (m['last_active'] as num?)?.toDouble();
    if (la != null && la > 0) parts.add(_fmtAgo(la));
    return parts.join(' · ');
  }

  String _fmtAgo(double ts) {
    final s = DateTime.now().millisecondsSinceEpoch / 1000 - ts;
    if (s < 3600) return '${(s / 60).floor().clamp(1, 59)} 分钟前活跃';
    if (s < 86400) return '${(s / 3600).floor()} 小时前活跃';
    return '${(s / 86400).floor()} 天前活跃';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('小队面板')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!, style: TextStyle(color: context.kg.t3)))
              : _body(),
    );
  }

  Widget _body() {
    final kg = context.kg;
    final members = _members;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text((_team['name'] ?? '').toString(),
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
              const SizedBox(height: 6),
              Text('${members.length} 名队友 · 邀请码 ${_team['invite_code']}',
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: KgColors.brand,
                          minimumSize: const Size.fromHeight(40)),
                      onPressed: _invite,
                      child: const Text('邀请队友', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                          backgroundColor: Colors.white24,
                          minimumSize: const Size.fromHeight(40)),
                      onPressed: _leave,
                      child: const Text('退出小队', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            children: [
              SizedBox(width: 48, child: Text('队友', style: TextStyle(fontSize: 11, color: kg.t4))),
              const SizedBox(width: 10),
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: Text(weekLabels[i],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: i == todayIdx ? FontWeight.w700 : FontWeight.w400,
                          color: i == todayIdx ? KgColors.brand : kg.t4)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        for (final m in members) _memberCard(m),
      ],
    );
  }

  Widget _memberCard(Map<String, dynamic> m) {
    final kg = context.kg;
    final isMe = m['is_me'] == true;
    final todayN = (m['today_n'] as num?)?.toInt() ?? 0;
    final week = (m['week'] as List<dynamic>? ?? [])
        .map((e) => (e as num?)?.toInt() ?? 0)
        .toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: isMe ? kBrandGradient : null,
                      color: isMe ? null : kg.brandBg,
                    ),
                    child: Text((m['nickname'] ?? '?').toString().isEmpty
                        ? '?'
                        : (m['nickname'] ?? '?').toString().substring(0, 1),
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: isMe ? Colors.white : KgColors.brand)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text((m['nickname'] ?? '').toString(),
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 14, fontWeight: FontWeight.w700)),
                            ),
                            if (isMe) _memTag('我', KgColors.brand, kg.brandBg),
                            if (!isMe && m['is_creator'] == true)
                              _memTag('队长', KgColors.warning, kg.warningBg),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(_memDesc(m),
                            style: TextStyle(fontSize: 11, color: kg.t3)),
                      ],
                    ),
                  ),
                  if (!isMe && todayN == 0)
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(72, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          foregroundColor: KgColors.warning),
                      onPressed: () => _remind(m),
                      child: const Text('提醒 TA', style: TextStyle(fontSize: 12)),
                    )
                  else if (todayN > 0)
                    Text('今日 $todayN 题',
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: KgColors.success)),
                ],
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.only(left: 46),
                child: Row(
                  children: [
                    for (var i = 0; i < 7; i++) ...[
                      if (i > 0) const SizedBox(width: 5),
                      Expanded(child: _cell(i < week.length ? week[i] : 0, i)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _memTag(String t, Color fg, Color bg) => Container(
        margin: const EdgeInsets.only(left: 6),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
        child: Text(t, style: TextStyle(fontSize: 10, color: fg)),
      );

  Widget _cell(int n, int i) {
    final kg = context.kg;
    Color bg = kg.fill;
    Border? border;
    Color fg = KgColors.brand;
    if (i > todayIdx) {
      bg = Colors.transparent;
      border = Border.all(color: kg.border, width: 1);
    } else if (n == 0 && i == todayIdx) {
      border = Border.all(color: KgColors.brand, width: 1);
    } else if (n >= 20) {
      bg = KgColors.brand;
      fg = Colors.white;
    } else if (n > 0) {
      bg = const Color(0xFFDBEAFE);
    }
    return Container(
      height: 26,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        border: border,
        borderRadius: BorderRadius.circular(6),
      ),
      child: n > 0
          ? Text(n > 99 ? '99+' : '$n',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: fg))
          : null,
    );
  }
}
