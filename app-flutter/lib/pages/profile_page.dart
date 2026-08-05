import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/offline.dart';
import '../core/providers.dart';
import '../core/storage.dart';
import '../theme.dart';
import '../widgets/predict_card.dart';
import 'home_page.dart';

/// 个人中心：账号卡 + 三项统计 + 能力预测分卡 + 学习/偏好设置/其他分组，
/// 对照 frontend-uni/src/pages/profile/profile.vue 与 docs/design-v3/profile.html。
class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  int totalDone = 0;
  int streak = 0;
  int? mistakeN;
  Map<String, dynamic>? profile;
  Map<String, dynamic>? announce;
  int fontLv = Store.instance.fontLv;
  bool sfxOn = Store.instance.sfxOn;

  static const _fontLabels = ['小', '标准', '大', '特大'];

  @override
  void initState() {
    super.initState();
    _loadRemote();
  }

  Future<void> _loadRemote() async {
    try {
      final d = await Api.checkinSummary();
      if (mounted) {
        setState(() {
          totalDone = (d['total'] as num?)?.toInt() ?? 0;
          streak = (d['streak'] as num?)?.toInt() ?? 0;
        });
      }
    } catch (_) {/* 非关键路径 */}
    try {
      final items = await Api.mistakes();
      if (mounted) setState(() => mistakeN = items.length);
    } catch (_) {/* 非关键路径 */}
    try {
      final r = await Api.dio
          .get('/api/profile', queryParameters: {'uid': Api.uid()});
      final p = r.data['profile'];
      if (mounted && p is Map) {
        setState(() => profile = Map<String, dynamic>.from(p));
      }
    } catch (_) {/* 非关键路径 */}
    try {
      final a = await Api.announcement();
      if (mounted) setState(() => announce = a);
    } catch (_) {/* 非关键路径 */}
  }

  String _maskPhone(String p) =>
      p.length >= 7 ? '${p.substring(0, 3)}****${p.substring(p.length - 4)}' : p;

  String get _profileSummary {
    final p = profile;
    if (p == null) return '未制定';
    final t = (p['exam_type'] ?? '').toString();
    final d = (p['exam_date'] ?? '').toString();
    return '$t${d.isNotEmpty ? ' · $d' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider);
    final goal = ref.watch(dailyGoalProvider);
    final themeMode = ref.watch(themeModeProvider);
    final remindOn = Store.instance.remindOn;
    final remindTime = Store.instance.remindTime;
    final offlineN = Offline.listPacks().length;

    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 账号卡
          Card(
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                    gradient: kBrandGradient, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: user != null
                    ? Text(
                        (user['nickname'] ?? '考').toString().substring(0, 1),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w800))
                    : const Icon(LucideIcons.user, color: Colors.white),
              ),
              title: Text(
                user != null ? (user['nickname'] ?? '考友').toString() : '未登录',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                user != null
                    ? _maskPhone((user['phone'] ?? '').toString())
                    : '登录后多设备同步做题记录',
                style: const TextStyle(fontSize: 12, color: KgColors.t3),
              ),
              trailing: user == null
                  ? FilledButton(
                      style: FilledButton.styleFrom(
                          minimumSize: const Size(88, 38),
                          padding: const EdgeInsets.symmetric(horizontal: 16)),
                      onPressed: () => context.push('/login'),
                      child: const Text('登录'),
                    )
                  : const Icon(LucideIcons.chevronRight,
                      size: 18, color: KgColors.t4),
            ),
          ),
          const SizedBox(height: 12),
          // 三项统计
          Row(
            children: [
              _stat('$totalDone', '累计做题', () => context.go('/stats')),
              const SizedBox(width: 10),
              _stat(mistakeN == null ? '—' : '$mistakeN', '错题本',
                  () => context.go('/book')),
              const SizedBox(width: 10),
              _stat('$streak', '连续打卡', () => context.push('/poster')),
            ],
          ),
          const SizedBox(height: 12),
          // 能力预测分卡
          const PredictCard(),
          if (announce != null) ...[
            const SizedBox(height: 12),
            Card(
              color: Theme.of(context).brightness == Brightness.dark
                  ? KgColors.brandDeep.withValues(alpha: .25)
                  : KgColors.brand50,
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(
                  children: [
                    const Icon(LucideIcons.megaphone,
                        size: 15, color: KgColors.brand),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text((announce!['title'] ?? '').toString(),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12.5, color: KgColors.brand)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          _sectionTitle('学习'),
          Card(
            child: Column(
              children: [
                _cell(LucideIcons.clipboardList, '学习计划 / 报考画像',
                    value: _profileSummary,
                    onTap: () {
                      context.go('/home');
                      homeSetupTick.value++;
                    }),
                _div(),
                _cell(LucideIcons.calendarDays, '学习日历',
                    onTap: () => context.push('/calendar')),
                _div(),
                _cell(LucideIcons.star, '我的收藏',
                    onTap: () => context.push('/favorites')),
                _div(),
                _cell(LucideIcons.fileCheck2, '模考记录',
                    onTap: () => context.push('/exam/list')),
                _div(),
                _cell(LucideIcons.mic, 'AI 面试陪练',
                    onTap: () => context.push('/interview')),
                _div(),
                _cell(LucideIcons.swords, '答题 PK',
                    onTap: () => context.push('/pk')),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _sectionTitle('偏好设置'),
          Card(
            child: Column(
              children: [
                _cell(LucideIcons.target, '每日目标', value: '$goal 题', onTap: () {
                  const opts = [20, 50, 100];
                  final next = opts[(opts.indexOf(goal) + 1) % opts.length];
                  ref.read(dailyGoalProvider.notifier).set(next);
                }),
                _div(),
                _cell(LucideIcons.type, '刷题字号',
                    value: _fontLabels[fontLv.clamp(0, 3)], onTap: () {
                  setState(() => fontLv = (fontLv + 1) % 4);
                  Store.instance.fontLv = fontLv;
                }),
                _div(),
                _cell(LucideIcons.alarmClock, '学习提醒',
                    value: remindOn ? '每天 $remindTime' : '未开启',
                    onTap: () async {
                      await context.push('/reminders');
                      if (mounted) setState(() {});
                    }),
                _div(),
                _cell(LucideIcons.moonStar, '外观模式',
                    value: switch (themeMode) {
                      ThemeMode.light => '浅色',
                      ThemeMode.dark => '深色',
                      _ => '跟随系统',
                    }, onTap: () {
                  final next = switch (themeMode) {
                    ThemeMode.system => ThemeMode.light,
                    ThemeMode.light => ThemeMode.dark,
                    _ => ThemeMode.system,
                  };
                  ref.read(themeModeProvider.notifier).set(next);
                }),
                _div(),
                _cell(LucideIcons.download, '离线题包',
                    value: offlineN > 0 ? '$offlineN 个模块' : '未下载',
                    onTap: () async {
                      await context.push('/offline');
                      if (mounted) setState(() {});
                    }),
                _div(),
                SwitchListTile(
                  secondary: const Icon(LucideIcons.volume2,
                      size: 20, color: KgColors.t3),
                  title: const Text('答题音效', style: TextStyle(fontSize: 15)),
                  value: sfxOn,
                  activeTrackColor: KgColors.brand,
                  onChanged: (v) {
                    setState(() => sfxOn = v);
                    Store.instance.sfxOn = v;
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _sectionTitle('其他'),
          Card(
            child: Column(
              children: [
                _cell(LucideIcons.megaphone, '公告',
                    value: announce != null
                        ? (announce!['title'] ?? '').toString()
                        : '',
                    onTap: () => _showAnnounce()),
                _div(),
                _cell(LucideIcons.messageSquare, '反馈与纠错',
                    onTap: () => _showAbout(feedback: true)),
                _div(),
                _cell(LucideIcons.info, '关于', value: 'v0.1.0',
                    onTap: () => _showAbout()),
                if (user != null) ...[
                  _div(),
                  ListTile(
                    leading: const Icon(LucideIcons.logOut,
                        size: 20, color: KgColors.error),
                    title: const Text('退出登录',
                        style: TextStyle(fontSize: 15, color: KgColors.error)),
                    onTap: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (c) => AlertDialog(
                          title: const Text('退出登录？'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(c, false),
                                child: const Text('取消')),
                            TextButton(
                                onPressed: () => Navigator.pop(c, true),
                                child: const Text('退出')),
                          ],
                        ),
                      );
                      if (ok == true) ref.read(authProvider.notifier).logout();
                    },
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Center(
            child: Text('考公助手 · Flutter 原生版 v0.1.0',
                style: TextStyle(fontSize: 12, color: KgColors.t4)),
          ),
        ],
      ),
    );
  }

  Widget _stat(String n, String t, VoidCallback onTap) {
    return Expanded(
      child: Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Column(
              children: [
                Text(n,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(t,
                    style: const TextStyle(fontSize: 11, color: KgColors.t3)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(t, style: const TextStyle(fontSize: 12, color: KgColors.t3)),
      );

  Widget _div() => const Divider(height: 1, indent: 16, endIndent: 16);

  Widget _cell(IconData icon, String label,
      {String value = '', VoidCallback? onTap}) {
    return ListTile(
      leading: Icon(icon, size: 20, color: KgColors.t3),
      title: Text(label, style: const TextStyle(fontSize: 15)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (value.isNotEmpty)
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 150),
              child: Text(value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, color: KgColors.t3)),
            ),
          const SizedBox(width: 4),
          const Icon(LucideIcons.chevronRight, size: 18, color: KgColors.t4),
        ],
      ),
      onTap: onTap,
    );
  }

  void _showAnnounce() {
    final a = announce;
    showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(a != null ? (a['title'] ?? '公告').toString() : '公告'),
        content: Text(a != null ? (a['body'] ?? '').toString() : '暂无公告'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('知道了')),
        ],
      ),
    );
  }

  void _showAbout({bool feedback = false}) {
    showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(feedback ? '反馈与纠错' : '关于考公助手'),
        content: Text(feedback
            ? '题目纠错可在答题解析页的讨论区留言；功能建议请通过应用商店评价或邮件反馈。'
            : '考公刷题助手 Flutter 原生版 v0.1.0\n行测/申论/时政全覆盖，AI 智能陪练。\n题库来自公开资料整理。'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('知道了')),
        ],
      ),
    );
  }
}
