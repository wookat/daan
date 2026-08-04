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

  // ---------- 访问码（复刻 api.js accessCode，AI 端点需 X-Access-Code） ----------

  String get accessCode => _sp.getString('accessCode') ?? '';
  set accessCode(String v) => _sp.setString('accessCode', v);

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

  // ---------- 模考进度（复刻 examProgress 键） ----------

  Map<String, dynamic>? get examProgress {
    final s = _sp.getString('examProgress');
    if (s == null || s.isEmpty) return null;
    final d = jsonDecode(s);
    return d is Map<String, dynamic> ? d : null;
  }

  set examProgress(Map<String, dynamic>? v) {
    if (v == null) {
      _sp.remove('examProgress');
    } else {
      _sp.setString('examProgress', jsonEncode(v));
    }
  }

  // ---------- AI 问答会话（复刻 askSessions / askCurSession / recentExplains 键） ----------

  List<dynamic> _jsonList(String key) {
    final s = _sp.getString(key);
    if (s == null || s.isEmpty) return [];
    final d = jsonDecode(s);
    return d is List ? d : [];
  }

  List<dynamic> get askSessions => _jsonList('askSessions');
  set askSessions(List<dynamic> v) => _sp.setString('askSessions', jsonEncode(v));

  List<dynamic> get askCurSession => _jsonList('askCurSession');
  set askCurSession(List<dynamic> v) => _sp.setString('askCurSession', jsonEncode(v));
  void clearAskCurSession() => _sp.remove('askCurSession');

  List<dynamic> get recentExplains => _jsonList('recentExplains');
  set recentExplains(List<dynamic> v) => _sp.setString('recentExplains', jsonEncode(v));

  String get redoQuestion => _sp.getString('redoQuestion') ?? '';
  set redoQuestion(String v) => _sp.setString('redoQuestion', v);
  void clearRedoQuestion() => _sp.remove('redoQuestion');

  // ---------- 最近导出的试卷（复刻 recentPapers 键） ----------

  List<dynamic> get recentPapers => _jsonList('recentPapers');

  // ---------- 时政每日一练完成记录（复刻 szDaily 键） ----------

  Map<String, dynamic> get szDaily {
    final s = _sp.getString('szDaily');
    if (s == null || s.isEmpty) return {'days': <String, dynamic>{}};
    final d = jsonDecode(s);
    if (d is Map<String, dynamic> && d['days'] is Map) return d;
    return {'days': <String, dynamic>{}};
  }

  set szDaily(Map<String, dynamic> v) => _sp.setString('szDaily', jsonEncode(v));

  // ---------- 申论草稿 / 收藏（复刻 slDraft: / slMatFavIds / slMatFavs / slQFavIds 键） ----------

  String slDraft(int qid) => _sp.getString('slDraft:$qid') ?? '';

  void setSlDraft(int qid, String v) {
    if (v.isEmpty) {
      _sp.remove('slDraft:$qid');
    } else {
      _sp.setString('slDraft:$qid', v);
    }
  }

  List<int> get slMatFavIds =>
      _jsonList('slMatFavIds').map((e) => (e as num).toInt()).toList();
  set slMatFavIds(List<int> v) => _sp.setString('slMatFavIds', jsonEncode(v));

  List<dynamic> get slMatFavs => _jsonList('slMatFavs');
  set slMatFavs(List<dynamic> v) => _sp.setString('slMatFavs', jsonEncode(v));

  List<int> get slQFavIds =>
      _jsonList('slQFavIds').map((e) => (e as num).toInt()).toList();
  set slQFavIds(List<int> v) => _sp.setString('slQFavIds', jsonEncode(v));

  // ---------- 学习计划引导（复刻 planGuideHide 键） ----------

  bool get planGuideHide => (_sp.getString('planGuideHide') ?? '').isNotEmpty;
  set planGuideHide(bool v) =>
      v ? _sp.setString('planGuideHide', '1') : _sp.remove('planGuideHide');

  // ---------- 主题 ----------

  String get themeMode => _sp.getString('themeMode') ?? 'system';
  set themeMode(String v) => _sp.setString('themeMode', v);
}
