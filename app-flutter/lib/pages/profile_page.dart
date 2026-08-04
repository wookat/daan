import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/providers.dart';
import '../theme.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider);
    final goal = ref.watch(dailyGoalProvider);
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('我的')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 账号卡
          Card(
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(gradient: kBrandGradient, shape: BoxShape.circle),
                child: const Icon(LucideIcons.user, color: Colors.white),
              ),
              title: Text(
                user != null ? (user['nickname'] ?? '考友').toString() : '未登录',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                user != null ? (user['phone'] ?? '').toString() : '登录后多设备同步做题记录',
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
                  : TextButton(
                      onPressed: () async {
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
                      child: const Text('退出'),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          // 学习偏好
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(LucideIcons.target, size: 20, color: KgColors.brand),
                  title: const Text('每日目标', style: TextStyle(fontSize: 15)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final g in const [20, 50, 100])
                        Padding(
                          padding: const EdgeInsets.only(left: 6),
                          child: ChoiceChip(
                            label: Text('$g 题'),
                            selected: goal == g,
                            labelStyle: TextStyle(
                                fontSize: 12,
                                color: goal == g ? KgColors.brandDeep : KgColors.t2),
                            onSelected: (_) =>
                                ref.read(dailyGoalProvider.notifier).set(g),
                          ),
                        ),
                    ],
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: const Icon(LucideIcons.moon, size: 20, color: KgColors.brand),
                  title: const Text('深色模式', style: TextStyle(fontSize: 15)),
                  trailing: SegmentedButton<ThemeMode>(
                    style: const ButtonStyle(visualDensity: VisualDensity.compact),
                    segments: const [
                      ButtonSegment(value: ThemeMode.system, label: Text('跟随')),
                      ButtonSegment(value: ThemeMode.light, label: Text('浅')),
                      ButtonSegment(value: ThemeMode.dark, label: Text('深')),
                    ],
                    selected: {themeMode},
                    onSelectionChanged: (s) =>
                        ref.read(themeModeProvider.notifier).set(s.first),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // 学习资产（占位入口）
          Card(
            child: Column(
              children: [
                _link(context, LucideIcons.clipboardList, '学习计划 / 报考画像', '学习计划'),
                _link(context, LucideIcons.star, '我的收藏', '我的收藏'),
                _link(context, LucideIcons.fileDown, 'PDF 导出记录', 'PDF 导出记录'),
                _link(context, LucideIcons.bell, '学习提醒', '学习提醒'),
                _link(context, LucideIcons.megaphone, '公告', '公告'),
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

  Widget _link(BuildContext context, IconData icon, String label, String title) {
    return ListTile(
      leading: Icon(icon, size: 20, color: KgColors.t3),
      title: Text(label, style: const TextStyle(fontSize: 15)),
      trailing: const Icon(LucideIcons.chevronRight, size: 18, color: KgColors.t4),
      onTap: () => context.push('/placeholder?title=${Uri.encodeComponent(title)}'),
    );
  }
}
