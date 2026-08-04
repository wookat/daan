import 'dart:convert';

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
        final code = Store.instance.accessCode;
        if (code.isNotEmpty) options.headers['X-Access-Code'] = code;
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

  // ---------- 模考 ----------

  static Future<Map<String, dynamic>> examPapers({int? year, String? region}) async {
    final r = await dio.get('/api/exam/papers', queryParameters: {
      'kind': 'zhenti',
      'uid': uid(),
      if (year != null) 'year': year,
      if (region != null && region.isNotEmpty) 'region': region,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> examAttempts({int? paperId, int limit = 10}) async {
    final r = await dio.get('/api/exam/attempts', queryParameters: {
      'uid': uid(),
      if (paperId != null) 'paper_id': paperId,
      'limit': limit,
    });
    return r.data['items'] as List<dynamic>;
  }

  static Future<Map<String, dynamic>> examStart({int? paperId, bool mini = false}) async {
    final r = await dio.post('/api/exam/start', data: {
      'uid': uid(),
      if (mini) 'mini': true,
      if (!mini) 'paper_id': paperId,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> examSubmit(
      int attemptId, Map<String, String> picks, Map<String, int> secs) async {
    final r = await dio.post('/api/exam/submit', data: {
      'uid': uid(),
      'attempt_id': attemptId,
      'picks': picks,
      'secs': secs,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> examReport(int attemptId) async {
    final r = await dio.get('/api/exam/report/$attemptId', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- AI 问答 ----------

  /// 拍题/文字讲解（SSE 流式）。onMeta 返回识题元信息；onDelta 返回累计全文。
  /// 返回完整讲解元信息（含 explanation）。
  static Future<Map<String, dynamic>> explainStream({
    String? imagePath,
    String? text,
    String? userAnswer,
    required void Function(Map<String, dynamic> meta) onMeta,
    required void Function(String full) onDelta,
  }) async {
    final form = FormData();
    if (imagePath != null && imagePath.isNotEmpty) {
      form.files.add(MapEntry('image', await MultipartFile.fromFile(imagePath)));
    }
    if (text != null && text.isNotEmpty) form.fields.add(MapEntry('text', text));
    if (userAnswer != null && userAnswer.isNotEmpty) {
      form.fields.add(MapEntry('user_answer', userAnswer));
    }
    final Response<ResponseBody> r;
    try {
      r = await dio.post<ResponseBody>(
        '/api/explain/stream',
        data: form,
        options: Options(responseType: ResponseType.stream),
      );
    } on DioException catch (e) {
      // 流式请求出错时 response.data 是 ResponseBody，需解码后才能拿到 detail
      final body = e.response?.data;
      if (body is ResponseBody) {
        final bytes = await body.stream
            .cast<List<int>>()
            .fold<List<int>>([], (a, b) => a..addAll(b));
        try {
          final m = jsonDecode(utf8.decode(bytes));
          if (m is Map && m['detail'] != null) {
            throw Exception(m['detail'].toString());
          }
        } on FormatException {
          // ignore: 非 JSON 错误体
        }
      }
      throw Exception(errMsg(e));
    }
    Map<String, dynamic> meta = {};
    final full = StringBuffer();
    var buf = '';
    final textStream = r.data!.stream
        .cast<List<int>>()
        .transform(const Utf8Decoder(allowMalformed: true));
    await for (final chunk in textStream) {
      buf += chunk;
      while (true) {
        final idx = buf.indexOf('\n\n');
        if (idx < 0) break;
        final block = buf.substring(0, idx);
        buf = buf.substring(idx + 2);
        String event = 'message';
        final datas = <String>[];
        for (final line in block.split('\n')) {
          if (line.startsWith('event:')) event = line.substring(6).trim();
          if (line.startsWith('data:')) datas.add(line.substring(5).trim());
        }
        if (datas.isEmpty) continue;
        final payload = datas.join('\n');
        if (event == 'meta') {
          meta = Map<String, dynamic>.from(jsonDecode(payload));
          onMeta(meta);
        } else if (event == 'error') {
          final m = jsonDecode(payload);
          throw Exception((m is Map ? m['message'] : null) ?? '讲解失败');
        } else if (event == 'message') {
          final m = jsonDecode(payload);
          if (m is Map && m['d'] != null) {
            full.write(m['d']);
            onDelta(full.toString());
          }
        }
      }
    }
    return {...meta, 'explanation': full.toString()};
  }

  static Future<String> followup({
    required String questionText,
    required String explanation,
    required List<Map<String, String>> history,
    required String query,
  }) async {
    final r = await dio.post('/api/followup', data: {
      'question_text': questionText,
      'explanation': explanation,
      'history': history,
      'query': query,
    });
    return (r.data['answer'] ?? '').toString();
  }

  static Future<String> similar(String questionText, String? questionType) async {
    final r = await dio.post('/api/similar', data: {
      'question_text': questionText,
      if (questionType != null) 'question_type': questionType,
    });
    return (r.data['content'] ?? '').toString();
  }

  static Future<void> rateExplain(String key, bool up) async {
    await dio.post('/api/rate', data: {'key': key, 'up': up});
  }

  // ---------- 错题增强 ----------

  static Future<List<dynamic>> questionAttempts(int questionId) async {
    final r = await dio.get('/api/attempts',
        queryParameters: {'uid': uid(), 'question_id': questionId});
    return r.data['items'] as List<dynamic>;
  }

  static Future<Map<String, dynamic>> mistakeAnalysis() async {
    final r = await dio.post('/api/mistakes/analysis', data: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- 手动录入 / 扫描答题卡 ----------

  static Future<Map<String, dynamic>> paperInfo(String code) async {
    final r = await dio.get('/api/paper/${Uri.encodeComponent(code)}');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> paperAnswers(
      String code, Map<String, String> picks) async {
    final r = await dio.post('/api/paper_answers',
        data: {'uid': uid(), 'code': code, 'picks': picks});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> scanSheet(String filePath) async {
    final form = FormData.fromMap({
      'uid': uid(),
      'image': await MultipartFile.fromFile(filePath),
    });
    final r = await dio.post('/api/scan_sheet',
        data: form, options: Options(receiveTimeout: const Duration(seconds: 120)));
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
