import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

/// 轻量本地存储，复刻 frontend-uni 的 uni.getStorageSync 键。
class Store {
  Store(this._sp);

  final SharedPreferences _sp;

  static late Store instance;

  static Future<void> init() async {
    instance = Store(await SharedPreferences.getInstance());
  }

  // ---------- 匿名 uid（与 api.js anonUid 一致的生成规则） ----------

  String anonUid() {
    var uid = _sp.getString('anonUid');
    if (uid == null || uid.isEmpty) {
      final r = Random();
      uid = 'u${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}'
          '${List.generate(8, (_) => '0123456789abcdefghijklmnopqrstuvwxyz'[r.nextInt(36)]).join()}';
      _sp.setString('anonUid', uid);
    }
    return uid;
  }

  // ---------- 登录态（复刻 api.js setAuth/clearAuth 的匿名 uid 保留与合并逻辑） ----------

  String get token => _sp.getString('authToken') ?? '';

  Map<String, dynamic>? get authUser {
    final s = _sp.getString('authUser');
    if (s == null) return null;
    final u = jsonDecode(s);
    return (u is Map<String, dynamic> && u['uid'] != null) ? u : null;
  }

  void setAuth(String token, Map<String, dynamic> user) {
    final cur = _sp.getString('anonUid');
    final uid = user['uid'] as String;
    if (cur != null && cur.isNotEmpty && cur != uid && _sp.getString('deviceAnonUid') == null) {
      _sp.setString('deviceAnonUid', cur);
    }
    _sp.setString('authToken', token);
    _sp.setString('authUser', jsonEncode(user));
    _sp.setString('anonUid', uid);
  }

  void clearAuth() {
    _sp.remove('authToken');
    _sp.remove('authUser');
    final dev = _sp.getString('deviceAnonUid');
    if (dev != null && dev.isNotEmpty) {
      _sp.setString('anonUid', dev);
    } else {
      _sp.remove('anonUid');
    }
  }

  String? get deviceAnonUid => _sp.getString('deviceAnonUid');

  // ---------- 每日目标与今日进度 ----------

  int get dailyGoal => _sp.getInt('dailyGoal') ?? 20;
  set dailyGoal(int v) => _sp.setInt('dailyGoal', v);

  String _todayKey() {
    final now = DateTime.now();
    return 'todayCount:${now.year}-${now.month}-${now.day}';
  }

  int get todayCount => _sp.getInt(_todayKey()) ?? 0;

  void addTodayCount(int n) => _sp.setInt(_todayKey(), todayCount + n);

  // ---------- 主题 ----------

  String get themeMode => _sp.getString('themeMode') ?? 'system';
  set themeMode(String v) => _sp.setString('themeMode', v);
}
