import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/providers.dart';
import '../theme.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goal = ref.watch(dailyGoalProvider);
    final today = ref.watch(todayCountProvider);
    final pct = (today / goal).clamp(0.0, 1.0);

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // 今日目标 Hero
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: kBrandGradient,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('今日目标',
                      style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(
                    '今日已练 $today/$goal 题${today >= goal ? ' · 已达成' : ''}',
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: pct,
                      minHeight: 6,
                      backgroundColor: Colors.white24,
                      valueColor: const AlwaysStoppedAnimation(Colors.white),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: KgColors.brandDeep,
                      ),
                      onPressed: () => context.push('/practice'),
                      child: Text(today >= goal ? '再练一组' : '继续目标'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const _SectionTitle('专项练习'),
            const SizedBox(height: 10),
            Card(
              child: Column(
                children: [
                  for (final e in kModuleNames.entries)
                    ListTile(
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: (KgColors.moduleColors[e.key] ?? KgColors.brand).withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(_moduleIcon(e.key),
                            size: 20, color: KgColors.moduleColors[e.key] ?? KgColors.brand),
                      ),
                      title: Text(e.value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                      trailing: const Icon(LucideIcons.chevronRight, size: 18, color: KgColors.t4),
                      onTap: () => context.push('/practice?module=${e.key}'),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            const _SectionTitle('更多练习'),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                _entry(context, LucideIcons.timer, '模考', '/placeholder?title=全真模考'),
                _entry(context, LucideIcons.repeat, '错题重练', '/practice?mode=redo'),
                _entry(context, LucideIcons.penTool, '申论', '/placeholder?title=申论批改'),
                _entry(context, LucideIcons.newspaper, '时政每日练', '/placeholder?title=时政每日一练'),
                _entry(context, LucideIcons.camera, '拍题讲解', '/placeholder?title=拍题讲解'),
                _entry(context, LucideIcons.swords, '答题PK', '/placeholder?title=答题PK'),
                _entry(context, LucideIcons.mic, '面试陪练', '/placeholder?title=AI 面试陪练'),
                _entry(context, LucideIcons.fileDown, 'PDF导出', '/placeholder?title=PDF 导出'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _entry(BuildContext context, IconData icon, String label, String route) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push(route),
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: KgColors.brand),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  static IconData _moduleIcon(String key) => switch (key) {
        'ziliao' => LucideIcons.pieChart,
        'shuliang' => LucideIcons.calculator,
        'yanyu' => LucideIcons.languages,
        'panduan' => LucideIcons.puzzle,
        'changshi' => LucideIcons.lightbulb,
        _ => LucideIcons.pencil,
      };
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700));
}
