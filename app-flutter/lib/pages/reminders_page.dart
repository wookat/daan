import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/reminders.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 学习提醒设置：开关 + 提醒时间 + 样式预览，
/// 对照 frontend-uni/src/pkgA/settings/reminders.vue。
class RemindersPage extends StatefulWidget {
  const RemindersPage({super.key});

  @override
  State<RemindersPage> createState() => _RemindersPageState();
}

class _RemindersPageState extends State<RemindersPage> {
  bool on = Store.instance.remindOn;
  String time = Store.instance.remindTime;

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _toggle(bool v) async {
    setState(() => on = v);
    Store.instance.remindOn = v;
    if (v) {
      final ok = await Reminders.requestPermission();
      if (!ok && mounted) {
        _toast('通知权限被拒绝，请在系统设置中允许通知');
      }
      Api.trackEvent('reminder_optin', source: 'app');
    }
    await Reminders.reschedule();
    if (mounted) _toast(v ? '已开启 · 每天 $time 提醒' : '已关闭提醒');
  }

  Future<void> _pickTime() async {
    if (!on) return;
    final parts = time.split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
          hour: int.tryParse(parts[0]) ?? 20,
          minute: int.tryParse(parts.length > 1 ? parts[1] : '30') ?? 30),
    );
    if (t == null) return;
    setState(() => time =
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}');
    Store.instance.remindTime = time;
    await Reminders.reschedule();
    if (mounted && on) _toast('每天 $time 提醒');
  }

  @override
  Widget build(BuildContext context) {
    final goal = Store.instance.dailyGoal;
    final done = Store.instance.todayCount;
    final left = (goal - done).clamp(0, goal);
    return Scaffold(
      appBar: AppBar(title: const Text('学习提醒')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  secondary: _ico(LucideIcons.alarmClock),
                  title: const Text('每日刷题提醒',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  subtitle: Text('每天 $time · 未完成今日目标时提醒',
                      style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                  value: on,
                  activeTrackColor: KgColors.brand,
                  onChanged: _toggle,
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                Opacity(
                  opacity: on ? 1 : .5,
                  child: ListTile(
                    leading: _ico(LucideIcons.clock),
                    title: const Text('提醒时间',
                        style:
                            TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                    subtitle: const Text('建议安排在晚间黄金学习时段',
                        style: TextStyle(fontSize: 12, color: KgColors.t3)),
                    trailing: Text('$time ›',
                        style: const TextStyle(
                            fontSize: 14,
                            color: KgColors.brand,
                            fontWeight: FontWeight.w600)),
                    onTap: _pickTime,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 8),
            child:
                Text('提醒样式预览', style: TextStyle(fontSize: 12, color: KgColors.t3)),
          ),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          gradient: kBrandGradient,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        alignment: Alignment.center,
                        child: const Text('考',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 6),
                      Text('岸上见 · $time',
                          style:
                              const TextStyle(fontSize: 10.5, color: KgColors.t3)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    left > 0 ? '今晚还差 $left 题就能守住连续打卡 🔥' : '今日目标已达成，保持手感再练一组？🎉',
                    style: const TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '今日目标 $goal 题已完成 $done 题${left > 0 ? '，练完守住连续打卡～' : ''}',
                    style: const TextStyle(fontSize: 12, color: KgColors.t3),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            color: Theme.of(context).brightness == Brightness.dark
                ? KgColors.brandDeep.withValues(alpha: .25)
                : KgColors.brand50,
            child: const Padding(
              padding: EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(LucideIcons.lightbulb, size: 14, color: KgColors.brand),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '提醒只在「有事可做」时打扰你：当天已达成目标则改为轻量鼓励；提醒为设备本地通知，无需联网。',
                      style: TextStyle(
                          fontSize: 12, color: KgColors.brand, height: 1.6),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ico(IconData icon) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: dark ? KgColors.brandDeep.withValues(alpha: .3) : KgColors.brand50,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Icon(icon, size: 18, color: KgColors.brand),
    );
  }
}
