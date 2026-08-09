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

  /// 登录过期回调（由 UI 层注册，提示“请重新登录”）
  void Function()? onAuthExpired;

  void notifyAuthExpired() => onAuthExpired?.call();

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

  /// 指定日期的做题数（复刻 pstats.days，用于断卡风险判断）。
  int dayCount(DateTime d) =>
      _sp.getInt('todayCount:${d.year}-${d.month}-${d.day}') ?? 0;

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

  // ---------- PK 昵称（复刻 pkNickname 键） ----------

  String pkNickname() {
    var n = _sp.getString('pkNickname');
    if (n == null || n.isEmpty) {
      final r = Random();
      n = '考友${List.generate(4, (_) => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[r.nextInt(36)]).join()}';
      _sp.setString('pkNickname', n);
    }
    return n;
  }

  // ---------- 学习提醒（复刻 remindOn / remindTime 键） ----------

  bool get remindOn => (_sp.getString('remindOn') ?? '').isNotEmpty;
  set remindOn(bool v) =>
      v ? _sp.setString('remindOn', '1') : _sp.setString('remindOn', '');

  String get remindTime => _sp.getString('remindTime') ?? '20:30';
  set remindTime(String v) => _sp.setString('remindTime', v);

  // ---------- 字号 / 音效（复刻 fontLv / sfxOff 键） ----------

  int get fontLv => _sp.getInt('fontLv') ?? 1;
  set fontLv(int v) => _sp.setInt('fontLv', v);

  bool get sfxOn => (_sp.getString('sfxOff') ?? '').isEmpty;
  set sfxOn(bool v) =>
      v ? _sp.setString('sfxOff', '') : _sp.setString('sfxOff', '1');

  // ---------- 背题 / 限时训练 / 答对自动跳题（复刻 beiMode / timedMode / autoNextOff 键） ----------

  bool get beiMode => (_sp.getString('beiMode') ?? '').isNotEmpty;
  set beiMode(bool v) =>
      v ? _sp.setString('beiMode', '1') : _sp.setString('beiMode', '');

  bool get timedMode => (_sp.getString('timedMode') ?? '').isNotEmpty;
  set timedMode(bool v) =>
      v ? _sp.setString('timedMode', '1') : _sp.setString('timedMode', '');

  bool get autoNext => (_sp.getString('autoNextOff') ?? '').isEmpty;
  set autoNext(bool v) =>
      v ? _sp.setString('autoNextOff', '') : _sp.setString('autoNextOff', '1');

  // ---------- 每日一组完成记录（复刻 dailyPlan 键） ----------

  Map<String, dynamic> get dailyPlanDays {
    final s = _sp.getString('dailyPlan');
    if (s == null || s.isEmpty) return {'days': <String, dynamic>{}};
    final d = jsonDecode(s);
    if (d is Map<String, dynamic> && d['days'] is Map) return d;
    return {'days': <String, dynamic>{}};
  }

  set dailyPlanDays(Map<String, dynamic> v) =>
      _sp.setString('dailyPlan', jsonEncode(v));

  // ---------- 离线题包 / 离线队列（复刻 offlinePacks / offlinePack: / offlineQueue 键） ----------

  List<dynamic> get offlinePacks => _jsonList('offlinePacks');
  set offlinePacks(List<dynamic> v) =>
      _sp.setString('offlinePacks', jsonEncode(v));

  Map<String, dynamic>? offlinePack(String module) {
    final s = _sp.getString('offlinePack:$module');
    if (s == null || s.isEmpty) return null;
    final d = jsonDecode(s);
    return d is Map<String, dynamic> ? d : null;
  }

  void setOfflinePack(String module, Map<String, dynamic>? v) {
    if (v == null) {
      _sp.remove('offlinePack:$module');
    } else {
      _sp.setString('offlinePack:$module', jsonEncode(v));
    }
  }

  Map<String, dynamic> get offlineQueue {
    final s = _sp.getString('offlineQueue');
    if (s == null || s.isEmpty) return {'answers': <dynamic>[], 'mistakes': <dynamic>[]};
    final d = jsonDecode(s);
    if (d is Map<String, dynamic> && d['answers'] is List && d['mistakes'] is List) {
      return d;
    }
    return {'answers': <dynamic>[], 'mistakes': <dynamic>[]};
  }

  set offlineQueue(Map<String, dynamic> v) =>
      _sp.setString('offlineQueue', jsonEncode(v));

  // ---------- 练习设置（复刻 groupSize / realMode / realYear / realRegion 键） ----------

  int get groupSize => _sp.getInt('groupSize') ?? 10;
  set groupSize(int v) => _sp.setInt('groupSize', v);

  bool get realMode => _sp.getBool('realMode') ?? false;
  set realMode(bool v) => _sp.setBool('realMode', v);

  int? get realYear => _sp.getInt('realYear');
  set realYear(int? v) =>
      v == null ? _sp.remove('realYear') : _sp.setInt('realYear', v);

  String get realRegion => _sp.getString('realRegion') ?? '';
  set realRegion(String v) =>
      v.isEmpty ? _sp.remove('realRegion') : _sp.setString('realRegion', v);

  // ---------- 公告关闭记录（复刻 annDismissed 键） ----------

  String get annDismissed => _sp.getString('annDismissed') ?? '';
  set annDismissed(String v) => _sp.setString('annDismissed', v);

  // ---------- 各模块本地做题统计（复刻 pstats.byModule） ----------

  Map<String, dynamic> get moduleStats {
    final s = _sp.getString('moduleStats');
    if (s == null || s.isEmpty) return {};
    final d = jsonDecode(s);
    return d is Map<String, dynamic> ? d : {};
  }

  void addModuleStat(String module, int done, int correct) {
    if (module.isEmpty) return;
    final all = moduleStats;
    final cur = Map<String, dynamic>.from(all[module] as Map? ?? {});
    all[module] = {
      'done': ((cur['done'] ?? 0) as num).toInt() + done,
      'correct': ((cur['correct'] ?? 0) as num).toInt() + correct,
    };
    _sp.setString('moduleStats', jsonEncode(all));
  }

  // ---------- 练习记录 / 最高连对（复刻 practiceHistory / pstats.bestStreak） ----------

  List<dynamic> get practiceHistory => _jsonList('practiceHistory');
  set practiceHistory(List<dynamic> v) =>
      _sp.setString('practiceHistory', jsonEncode(v));

  void addPracticeHistory(Map<String, dynamic> rec) {
    practiceHistory = [rec, ...practiceHistory].take(50).toList();
  }

  int get bestStreak => _sp.getInt('bestStreak') ?? 0;
  set bestStreak(int v) => _sp.setInt('bestStreak', v);

  /// 已弹过解锁提示的最高徽章里程碑（复刻 badgeSeenMax）
  int get badgeSeenMax => _sp.getInt('badgeSeenMax') ?? 0;
  set badgeSeenMax(int v) => _sp.setInt('badgeSeenMax', v);

  // ---------- AI 学习教练 / 备份恢复码（复刻 coachAdvice / backupCode 键） ----------

  String get coachAdvice => _sp.getString('coachAdvice') ?? '';
  set coachAdvice(String v) => _sp.setString('coachAdvice', v);

  String get backupCode => _sp.getString('backupCode') ?? '';
  set backupCode(String v) => _sp.setString('backupCode', v);

  /// 备份数据（复刻 stats.vue localData 键集合，取本端有意义的键）。
  Map<String, dynamic> backupData() {
    final out = <String, dynamic>{
      'dailyGoal': dailyGoal,
      'fontLv': fontLv,
      'bestStreak': bestStreak,
    };
    if (practiceHistory.isNotEmpty) out['practiceHistory'] = practiceHistory;
    if (coachAdvice.isNotEmpty) out['coachAdvice'] = coachAdvice;
    if (backupCode.isNotEmpty) out['backupCode'] = backupCode;
    return out;
  }

  void restoreBackup(Map<String, dynamic> data) {
    if (data['dailyGoal'] is num) dailyGoal = (data['dailyGoal'] as num).toInt();
    if (data['fontLv'] is num) fontLv = (data['fontLv'] as num).toInt();
    if (data['bestStreak'] is num) bestStreak = (data['bestStreak'] as num).toInt();
    if (data['practiceHistory'] is List) practiceHistory = data['practiceHistory'] as List;
    if (data['coachAdvice'] is String) coachAdvice = data['coachAdvice'] as String;
  }

  // ---------- 主题 ----------

  String get themeMode => _sp.getString('themeMode') ?? 'system';
  set themeMode(String v) => _sp.setString('themeMode', v);
}
