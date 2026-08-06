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
        // 仅登录态本身失效才清登录（访问码/管理令牌等 401 不应踢登录），与 api.js rawRequest 一致
        final data = e.response?.data;
        final detail =
            (data is Map && data['detail'] != null) ? data['detail'].toString() : '';
        if (e.response?.statusCode == 401 &&
            Store.instance.token.isNotEmpty &&
            !(e.requestOptions.path.startsWith('/api/auth/')) &&
            (detail.contains('未登录') || detail.contains('登录已过期'))) {
          Store.instance.clearAuth();
          Store.instance.notifyAuthExpired();
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
    String? submodule,
    String? tag3,
    int limit = 10,
    bool adaptive = true,
    bool real = false,
    int? year,
    String? region,
    bool grouped = false,
  }) async {
    final r = await dio.get('/api/questions', queryParameters: {
      'limit': limit,
      if (module != null && module.isNotEmpty) 'module': module,
      if (submodule != null && submodule.isNotEmpty) 'submodule': submodule,
      if (tag3 != null && tag3.isNotEmpty) 'tag3': tag3,
      'uid': uid(),
      if (adaptive) 'adaptive': 1,
      if (real) 'real': 1,
      if (real && year != null) 'year': year,
      if (real && region != null && region.isNotEmpty) 'region': region,
      if (grouped) 'grouped': 1,
    });
    return Map<String, dynamic>.from(r.data);
  }

  /// 真题筛选项（年份/地区）。
  static Future<Map<String, dynamic>> realFilters() async {
    final r = await dio.get('/api/real_filters');
    return Map<String, dynamic>.from(r.data);
  }

  /// 真题卷库列表。
  static Future<List<dynamic>> papers() async {
    final r = await dio.get('/api/papers');
    return r.data['items'] as List<dynamic>;
  }

  /// 按卷取题（整卷连做）。
  static Future<List<dynamic>> paperQuestions(String source) async {
    final r = await dio.get('/api/paper_questions',
        queryParameters: {'src': source});
    return r.data['items'] as List<dynamic>;
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

  /// 保存一次刷题结果，返回 {percentile, samples}（全站正确率分位）。
  static Future<Map<String, dynamic>> practiceResult(
      String module, int n, int correct, int secs) async {
    final r = await dio.post('/api/practice_result',
        data: {'module': module, 'n': n, 'correct': correct, 'secs': secs});
    return Map<String, dynamic>.from(r.data);
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

  /// 当前用户错题统计（by_module / by_type / by_reason）。
  static Future<Map<String, dynamic>> stats() async {
    final r = await dio.get('/api/stats', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  /// 后端是否开启访问码（旧后端 404 时按未开启处理）。
  static Future<bool> accessRequired() async {
    try {
      final r = await dio.get('/api/access_info');
      return r.data is Map && r.data['required'] == true;
    } catch (_) {
      return false;
    }
  }

  /// AI 学习教练建议（需访问码）。
  static Future<String> coach(Map<String, dynamic> statsData) async {
    final r = await dio.post('/api/coach', data: {'stats': statsData});
    return (r.data['advice'] ?? '').toString();
  }

  /// 申论学习统计。
  static Future<Map<String, dynamic>> shenlunStats() async {
    final r = await dio.get('/api/shenlun/stats', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  /// 数据备份：上传本地数据，返回恢复码。
  static Future<String> backupSave(Map<String, dynamic> data, {String? code}) async {
    final r = await dio.post('/api/backup', data: {
      if (code != null && code.isNotEmpty) 'code': code,
      'data': data,
    });
    return (r.data['code'] ?? '').toString();
  }

  /// 用恢复码取回备份数据。
  static Future<Map<String, dynamic>> backupGet(String code) async {
    final r = await dio.get('/api/backup', queryParameters: {'code': code});
    return Map<String, dynamic>.from(r.data['data'] as Map);
  }

  /// 二级题型（考点）掌握度：{submodule: {n, c}}。
  static Future<Map<String, dynamic>> submoduleProgress({String? module}) async {
    final r = await dio.get('/api/submodule_progress', queryParameters: {
      'uid': uid(),
      if (module != null && module.isNotEmpty) 'module': module,
    });
    final items = r.data['items'];
    return items is Map ? Map<String, dynamic>.from(items) : <String, dynamic>{};
  }

  /// 模块下二级题型题量列表。
  static Future<List<dynamic>> submodules(String module) async {
    final r = await dio.get('/api/submodules', queryParameters: {'module': module});
    return r.data['items'] as List<dynamic>;
  }

  /// 题目纠错上报。
  static Future<void> questionReport(int questionId, String rtype, String detail) async {
    await dio.post('/api/question_report', data: {
      'uid': uid(),
      'question_id': questionId,
      'type': rtype,
      'detail': detail,
    });
  }

  /// 模考成绩排名（全站分位与分布）。
  static Future<Map<String, dynamic>> examRank(int attemptId) async {
    final r = await dio.get('/api/exam/rank/$attemptId', queryParameters: {'uid': uid()});
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

  /// 花生十三方法解析评价（有用/有误）。
  static Future<void> rateQuestionHs(int questionId, bool up) async {
    await dio.post('/api/rate', data: {'question_id': questionId, 'up': up});
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

  // ---------- 时政每日一练 ----------

  static Future<Map<String, dynamic>> shizhengDaily() async {
    final r = await dio.get('/api/shizheng/daily');
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- 申论 ----------

  static Future<Map<String, dynamic>> shenlunQuestions({
    int limit = 20,
    int offset = 0,
    String? qtype,
    int? year,
    String? region,
  }) async {
    final r = await dio.get('/api/shenlun/questions', queryParameters: {
      'limit': limit,
      'offset': offset,
      if (qtype != null && qtype.isNotEmpty) 'qtype': qtype,
      if (year != null && year > 0) 'year': year,
      if (region != null && region.isNotEmpty) 'region': region,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> shenlunFilters() async {
    final r = await dio.get('/api/shenlun/filters');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> shenlunQuestion(int qid) async {
    final r = await dio.get('/api/shenlun/questions/$qid');
    return Map<String, dynamic>.from(r.data['item']);
  }

  static Future<String> shenlunGrade(int qid, String answer) async {
    final r = await dio.post('/api/shenlun/grade',
        data: {'qid': qid, 'answer': answer, 'uid': uid()},
        options: Options(receiveTimeout: const Duration(seconds: 180)));
    return (r.data['result'] ?? '').toString();
  }

  static Future<Map<String, dynamic>> shenlunMaterials({
    int limit = 20,
    int offset = 0,
    String? type,
  }) async {
    final r = await dio.get('/api/shenlun/materials', queryParameters: {
      'limit': limit,
      'offset': offset,
      if (type != null && type.isNotEmpty) 'type': type,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> shenlunHistory({int? qid, int limit = 50}) async {
    final r = await dio.get('/api/shenlun/history', queryParameters: {
      'uid': uid(),
      'limit': limit,
      if (qid != null) 'qid': qid,
    });
    return r.data['items'] as List<dynamic>;
  }

  static Future<Map<String, dynamic>> shenlunMatFavs() async {
    final r = await dio.get('/api/shenlun/mat_favs', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> shenlunMatFavSet(int mid, bool on) async {
    await dio.post('/api/shenlun/mat_favs', data: {'uid': uid(), 'mid': mid, 'on': on});
  }

  // ---------- 学习计划 / 报考画像 ----------

  static Future<Map<String, dynamic>?> profile() async {
    final r = await dio.get('/api/profile', queryParameters: {'uid': uid()});
    final p = r.data['profile'];
    return p is Map ? Map<String, dynamic>.from(p) : null;
  }

  static Future<Map<String, dynamic>?> saveProfile(Map<String, dynamic> pf) async {
    final r = await dio.post('/api/profile', data: {'uid': uid(), ...pf});
    final p = r.data['profile'];
    return p is Map ? Map<String, dynamic>.from(p) : null;
  }

  static Future<Map<String, dynamic>> planToday() async {
    final r = await dio.get('/api/plan/today', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> setFocus(String focus) async {
    await dio.post('/api/user_state', data: {'uid': uid(), 'focus': focus});
  }

  // ---------- 全局搜索 ----------

  static Future<Map<String, dynamic>> search(String q,
      {String type = 'all', int offset = 0}) async {
    final r = await dio.get('/api/search', queryParameters: {
      'q': q,
      'type': type,
      if (offset > 0) 'offset': offset,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> searchQuestion(int qid) async {
    final r = await dio.get('/api/search/question/$qid');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>?> question(int qid) async {
    final r = await dio.get('/api/question/$qid');
    final it = r.data['item'];
    return it is Map ? Map<String, dynamic>.from(it) : null;
  }

  // ---------- 讨论区 ----------

  static Future<Map<String, dynamic>> comments(int questionId,
      {String sort = 'hot'}) async {
    final r = await dio.get('/api/comments', queryParameters: {
      'question_id': questionId,
      'sort': sort,
      'uid': uid(),
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<int> commentCount(int questionId) async {
    final r = await dio
        .get('/api/comments/count', queryParameters: {'question_id': questionId});
    return (r.data['n'] as num?)?.toInt() ?? 0;
  }

  static Future<Map<String, dynamic>> postComment(int questionId, String content,
      {int? parentId}) async {
    final r = await dio.post('/api/comments', data: {
      'question_id': questionId,
      'content': content,
      if (parentId != null) 'parent_id': parentId,
    });
    return Map<String, dynamic>.from(r.data['item']);
  }

  static Future<Map<String, dynamic>> likeComment(int cid) async {
    final r = await dio.post('/api/comments/$cid/like');
    return Map<String, dynamic>.from(r.data);
  }

  static Future<void> deleteComment(int cid) async {
    await dio.delete('/api/comments/$cid');
  }

  // ---------- 收藏夹 / 笔记 ----------

  static Future<List<dynamic>> favFolders() async {
    final r = await dio.get('/api/favs/folders', queryParameters: {'uid': uid()});
    return r.data['items'] as List<dynamic>;
  }

  static Future<void> createFavFolder(String name, {String? icon}) async {
    await dio.post('/api/favs/folders',
        data: {'uid': uid(), 'name': name, if (icon != null) 'icon': icon});
  }

  static Future<void> renameFavFolder(int fid, String name) async {
    await dio.patch('/api/favs/folders/$fid', data: {'uid': uid(), 'name': name});
  }

  static Future<void> deleteFavFolder(int fid) async {
    await dio.delete('/api/favs/folders/$fid', queryParameters: {'uid': uid()});
  }

  static Future<void> setFav(int questionId, {int? folderId}) async {
    await dio.post('/api/favs',
        data: {'uid': uid(), 'question_id': questionId, 'folder_id': folderId});
  }

  static Future<void> removeFav(int questionId) async {
    await dio.delete('/api/favs',
        queryParameters: {'uid': uid(), 'question_id': questionId});
  }

  static Future<Map<String, dynamic>> favStatus(int questionId) async {
    final r = await dio.get('/api/favs/status',
        queryParameters: {'uid': uid(), 'question_id': questionId});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<List<dynamic>> notes({int? questionId}) async {
    final r = await dio.get('/api/notes', queryParameters: {
      'uid': uid(),
      if (questionId != null) 'question_id': questionId,
    });
    return r.data['items'] as List<dynamic>;
  }

  static Future<void> saveNote(int questionId, String content) async {
    await dio.post('/api/notes',
        data: {'uid': uid(), 'question_id': questionId, 'content': content});
  }

  // ---------- 打卡海报 ----------

  static Future<Map<String, dynamic>> checkinSummary() async {
    final r = await dio.get('/api/checkin/summary', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- PDF 导出 ----------

  /// 调用后端导出接口，返回 PDF 字节。复刻 api.js exportPdf。
  static Future<List<int>> exportPdf(Map<String, dynamic> body) async {
    final r = await dio.post<List<int>>('/api/export/pdf',
        data: body,
        options: Options(
          responseType: ResponseType.bytes,
          receiveTimeout: const Duration(seconds: 120),
        ));
    return r.data ?? const [];
  }

  // ---------- AI 面试陪练 ----------

  static Future<Map<String, dynamic>> interviewCategories() async {
    final r = await dio.get('/api/interview/categories', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> interviewDraw({String? category, int? excludeId}) async {
    final r = await dio.get('/api/interview/question', queryParameters: {
      'uid': uid(),
      if (category != null && category.isNotEmpty) 'category': category,
      if (excludeId != null) 'exclude_id': excludeId,
    });
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> interviewHistory({int limit = 50}) async {
    final r = await dio.get('/api/interview/history',
        queryParameters: {'uid': uid(), 'limit': limit});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> interviewSession(int id) async {
    final r = await dio.get('/api/interview/sessions/$id', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  /// 面试作答流式点评（SSE）：meta 一次（scores/total/summary），message 增量，done 带 session_id。
  static Future<Map<String, dynamic>> interviewAnswerStream({
    required int questionId,
    required String answer,
    required int durationSec,
    required void Function(Map<String, dynamic> meta) onMeta,
    required void Function(String full) onDelta,
  }) async {
    final Response<ResponseBody> r;
    try {
      r = await dio.post<ResponseBody>(
        '/api/interview/answer/stream',
        data: {
          'uid': uid(),
          'question_id': questionId,
          'answer': answer,
          'duration_sec': durationSec,
        },
        options: Options(responseType: ResponseType.stream),
      );
    } on DioException catch (e) {
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
    Map<String, dynamic> done = {};
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
          throw Exception((m is Map ? m['message'] : null) ?? '点评失败');
        } else if (event == 'done') {
          final m = jsonDecode(payload);
          if (m is Map) done = Map<String, dynamic>.from(m);
        } else if (event == 'message') {
          final m = jsonDecode(payload);
          if (m is Map && m['d'] != null) {
            full.write(m['d']);
            onDelta(full.toString());
          }
        }
      }
    }
    return {...meta, ...done, 'review': full.toString()};
  }

  // ---------- 答题 PK ----------

  /// PK 昵称：登录昵称 > 考友+手机尾号 > 本地随机昵称（复刻 api.js pkNickname）。
  static String pkNickname() {
    final u = Store.instance.authUser;
    if (u != null) {
      final nick = (u['nickname'] ?? '').toString();
      if (nick.isNotEmpty) return nick;
      final phone = (u['phone'] ?? '').toString();
      if (phone.length >= 4) return '考友${phone.substring(phone.length - 4)}';
    }
    return Store.instance.pkNickname();
  }

  static Future<Map<String, dynamic>> pkCreate(String? module) async {
    final r = await dio.post('/api/pk/create',
        data: {'uid': uid(), 'nickname': pkNickname(), 'module': module});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkJoin(String code) async {
    final r = await dio.post('/api/pk/join',
        data: {'uid': uid(), 'nickname': pkNickname(), 'code': code});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkRandomMatch(String? module) async {
    final r = await dio.post('/api/pk/random_match',
        data: {'uid': uid(), 'nickname': pkNickname(), 'module': module});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkMatch(String code) async {
    final r = await dio.get('/api/pk/match/${Uri.encodeComponent(code)}',
        queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkSubmit(
      String code, List<Map<String, dynamic>> items) async {
    final r = await dio.post('/api/pk/submit',
        data: {'uid': uid(), 'code': code, 'items': items});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkMine() async {
    final r = await dio.get('/api/pk/mine', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> pkLeaderboard() async {
    final r = await dio.get('/api/pk/leaderboard', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  // ---------- 能力预测分 / 公告 ----------

  static Future<Map<String, dynamic>> predict() async {
    final r = await dio.get('/api/predict', queryParameters: {'uid': uid()});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>?> announcement() async {
    final r = await dio.get('/api/announcement');
    final it = r.data['item'];
    return it is Map ? Map<String, dynamic>.from(it) : null;
  }

  // ---------- 账号 ----------

  static Future<Map<String, dynamic>> authLogin(String phone, String password) async {
    final r = await dio.post('/api/auth/login', data: {'phone': phone, 'password': password});
    return Map<String, dynamic>.from(r.data);
  }

  static Future<Map<String, dynamic>> authRegister(String phone, String password,
      {String nickname = ''}) async {
    final r = await dio.post('/api/auth/register', data: {
      'phone': phone,
      'password': password,
      if (nickname.isNotEmpty) 'nickname': nickname,
    });
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
