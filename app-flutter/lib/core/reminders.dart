import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'storage.dart';

/// 学习提醒：flutter_local_notifications 每日定时本地通知，
/// 复刻 frontend-uni/src/reminder.js 的提醒文案（按今日目标进度分档）。
class Reminders {
  Reminders._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _inited = false;
  static const _notifId = 1001;

  static Future<void> init() async {
    if (_inited) return;
    tzdata.initializeTimeZones();
    try {
      final name = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(name.identifier));
    } catch (_) {
      // 取不到时区名则退回 UTC（timezone 默认），提醒时间可能有偏差
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    _inited = true;
  }

  /// 请求通知权限（Android 13+ / iOS）。返回是否已授权。
  static Future<bool> requestPermission() async {
    await init();
    final android = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    if (android != null) {
      final ok = await android.requestNotificationsPermission();
      return ok ?? true;
    }
    final ios = _plugin.resolvePlatformSpecificImplementation<
        IOSFlutterLocalNotificationsPlugin>();
    if (ios != null) {
      final ok = await ios.requestPermissions(alert: true, badge: true, sound: true);
      return ok ?? true;
    }
    return true;
  }

  /// 根据 Store 的 remindOn/remindTime 重排每日提醒。
  static Future<void> reschedule() async {
    await init();
    await _plugin.cancel(id: _notifId);
    final store = Store.instance;
    if (!store.remindOn) return;
    final parts = store.remindTime.split(':');
    final hour = int.tryParse(parts[0]) ?? 20;
    final minute = int.tryParse(parts.length > 1 ? parts[1] : '30') ?? 30;

    final now = tz.TZDateTime.now(tz.local);
    var at = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (!at.isAfter(now)) at = at.add(const Duration(days: 1));

    final goal = store.dailyGoal;
    final done = store.todayCount;
    final left = (goal - done).clamp(0, goal);
    final title = left > 0 ? '今晚还差 $left 题完成今日目标 🔥' : '今日目标已达成，来一局答题 PK？⚔️';
    final body = left > 0
        ? '今日目标 $goal 题已完成 $done 题，练完守住连续打卡～'
        : '今天已练 $done 题，超棒！挑战一下考友巩固手感吧。';

    await _plugin.zonedSchedule(
      id: _notifId,
      title: title,
      body: body,
      scheduledDate: at,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'daily_reminder',
          '每日刷题提醒',
          channelDescription: '未完成今日目标时的每日提醒',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
    );
  }
}
