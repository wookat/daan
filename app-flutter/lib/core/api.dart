import 'package:dio/dio.dart';

import 'storage.dart';

/// API 基座：复刻 frontend-uni/src/api.js 的 BASE_URL / anonUid / Bearer token 机制。
class Api {
  Api._();

  static const baseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://kaogong.zalize.com',
  );

  static final dio = Dio(BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 20),
    receiveTimeout: const Duration(seconds: 180),
  ))
    ..interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final t = Store.instance.token;
        if (t.isNotEmpty) options.headers['Authorization'] = 'Bearer $t';
        handler.next(options);
      },
      onError: (e, handler) {
        // 401：清登录态回到匿名 uid（与 api.js rawRequest 一致）
        if (e.response?.statusCode == 401 &&
            Store.instance.token.isNotEmpty &&
            !(e.requestOptions.path.startsWith('/api/auth/login'))) {
          Store.instance.clearAuth();
        }
        handler.next(e);
      },
    ));

  static String uid() => Store.instance.anonUid();

  static String errMsg(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['detail'] != null) return d['detail'].toString();
      if (e.response != null) return 'HTTP ${e.response!.statusCode}';
      return '网络错误';
    }
    return e.toString();
  }

  // ---------- 题目 ----------

  static Future<Map<String, dynamic>> questions({
    String? module,
    int limit = 10,
    bool adaptive = true,
  }) async {
    final r = await dio.get('/api/questions', queryParameters: {
      'limit': limit,
      if (module != null && module.isNotEmpty) 'module': module,
      'uid': uid(),
      if (adaptive) 'adaptive': 1,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> mistakesRedo({int limit = 10, String? module}) async {
    final r = await dio.get('/api/mistakes/redo', queryParameters: {
      'limit': limit,
      if (module != null && module.isNotEmpty) 'module': module,
      'uid': uid(),
    });
    return r.data['items'] as List<dynamic>;
  }

  // ---------- 作答上报 ----------

  static Future<void> answerLog(List<Map<String, dynamic>> items) async {
    if (items.isEmpty) return;
    await dio.post('/api/answer_log', data: {'uid': uid(), 'items': items});
  }

  static Future<void> practiceResult(String module, int n, int correct, int secs) async {
    await dio.post('/api/practice_result',
        data: {'module': module, 'n': n, 'correct': correct, 'secs': secs});
  }

  // ---------- 错题本 ----------

  static Future<int?> saveMistake(Map<String, dynamic> rec) async {
    final r = await dio.post('/api/mistakes', data: {'uid': uid(), ...rec});
    return r.data['id'] as int?;
  }

  static Future<List<dynamic>> mistakes() async {
    final r = await dio.get('/api/mistakes', queryParameters: {'uid': uid()});
    return r.data['items'] as List<dynamic>;
  }

  static Future<void> patchMistake(int mid, Map<String, dynamic> fields) async {
    await dio.patch('/api/mistakes/$mid', data: fields);
  }

  static Future<void> deleteMistake(int mid) async {
    await dio.delete('/api/mistakes/$mid');
  }

  static Future<Map<String, dynamic>> reviewDue() async {
    final r = await dio.get('/api/review', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> recordReview(int mid, bool correct) async {
    final r = await dio.post('/api/review/$mid', data: {'uid': uid(), 'correct': correct});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> favs() async {
    final r = await dio.get('/api/favs', queryParameters: {'uid': uid()});
    final d = r.data;
    if (d is Map && d['items'] is List) return d['items'] as List<dynamic>;
    return const [];
  }

  // ---------- 统计 ----------

  static Future<Map<String, dynamic>> growth() async {
    final r = await dio.get('/api/growth', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> recommend() async {
    final r = await dio.get('/api/recommend', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> dailyPlan() async {
    final r = await dio.get('/api/daily_plan', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- 账号 ----------

  static Future<Map<String, dynamic>> authLogin(String phone, String password) async {
    final r = await dio.post('/api/auth/login', data: {'phone': phone, 'password': password});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> authRegister(String phone, String password) async {
    final r = await dio.post('/api/auth/register', data: {'phone': phone, 'password': password});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> authLogout() async {
    try {
      await dio.post('/api/auth/logout');
    } catch (_) {/* 非关键路径 */}
  }

  static Future<void> mergeAnon(String anonUid) async {
    try {
      await dio.post('/api/auth/merge_anon', data: {'anon_uid': anonUid});
    } catch (_) {/* 非关键路径 */}
  }
}
