import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api.dart';
import 'storage.dart';

/// 登录用户（null=匿名）
class AuthNotifier extends Notifier<Map<String, dynamic>?> {
  @override
  Map<String, dynamic>? build() => Store.instance.authUser;

  Future<void> login(String phone, String password) async {
    final d = await Api.authLogin(phone, password);
    _applyAuth(d);
  }

  Future<void> register(String phone, String password, {String nickname = ''}) async {
    final d = await Api.authRegister(phone, password, nickname: nickname);
    _applyAuth(d);
  }

  void _applyAuth(Map<String, dynamic> d) {
    final user = Map<String, dynamic>.from(d['user'] as Map);
    Store.instance.setAuth(d['token'] as String, user);
    state = user;
    final dev = Store.instance.deviceAnonUid;
    if (dev != null && dev.isNotEmpty && dev != user['uid']) {
      Api.mergeAnon(dev);
    }
  }

  Future<void> logout() async {
    await Api.authLogout();
    Store.instance.clearAuth();
    state = null;
  }
}

final authProvider = NotifierProvider<AuthNotifier, Map<String, dynamic>?>(AuthNotifier.new);

/// 每日目标
class GoalNotifier extends Notifier<int> {
  @override
  int build() => Store.instance.dailyGoal;

  void set(int v) {
    Store.instance.dailyGoal = v;
    state = v;
  }
}

final dailyGoalProvider = NotifierProvider<GoalNotifier, int>(GoalNotifier.new);

/// 今日已练题数（本地口径，与 home.vue todayCount 一致）
class TodayCountNotifier extends Notifier<int> {
  @override
  int build() => Store.instance.todayCount;

  void add(int n) {
    Store.instance.addTodayCount(n);
    state = Store.instance.todayCount;
  }
}

final todayCountProvider = NotifierProvider<TodayCountNotifier, int>(TodayCountNotifier.new);

/// 主题模式
class ThemeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() => switch (Store.instance.themeMode) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };

  void set(ThemeMode m) {
    Store.instance.themeMode = m.name;
    state = m;
  }
}

final themeModeProvider = NotifierProvider<ThemeNotifier, ThemeMode>(ThemeNotifier.new);
