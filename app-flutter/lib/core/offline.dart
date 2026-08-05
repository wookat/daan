import 'dart:convert';
import 'dart:math';

import 'api.dart';
import 'storage.dart';

/// 离线做题：题包下载到本地存储，断网时本地出题判分；
/// 作答/错题进入本地队列，恢复网络后自动同步（按 key 去重）。
/// 复刻 frontend-uni/src/offline.js。
class Offline {
  Offline._();

  static const packSize = 50;

  static const packModules = [
    ('ziliao', '资料分析'),
    ('shuliang', '数量关系'),
    ('yanyu', '言语理解'),
    ('panduan', '判断推理'),
    ('changshi', '常识判断'),
  ];

  // ---------- 题包 ----------

  static List<dynamic> listPacks() => Store.instance.offlinePacks;

  static Map<String, dynamic>? getPack(String module) =>
      Store.instance.offlinePack(module);

  static Future<Map<String, dynamic>> downloadPack(String module) async {
    final d = await Api.questions(module: module, limit: packSize, adaptive: false);
    final items = (d['items'] as List<dynamic>? ?? [])
        .where((q) =>
            q is Map &&
            (q['question'] ?? '').toString().isNotEmpty &&
            q['options'] is Map &&
            (q['answer'] ?? '').toString().isNotEmpty)
        .toList();
    if (items.isEmpty) throw Exception('该模块暂无题目');
    final pack = {
      'module': module,
      'ts': DateTime.now().millisecondsSinceEpoch,
      'items': items,
    };
    Store.instance.setOfflinePack(module, pack);
    final idx = listPacks().where((p) => p['module'] != module).toList();
    idx.add({
      'module': module,
      'count': items.length,
      'ts': pack['ts'],
      'size': jsonEncode(pack).length,
    });
    Store.instance.offlinePacks = idx;
    return pack;
  }

  static void removePack(String module) {
    Store.instance.setOfflinePack(module, null);
    Store.instance.offlinePacks =
        listPacks().where((p) => p['module'] != module).toList();
  }

  static int packUsageBytes() => listPacks()
      .fold<int>(0, (a, p) => a + ((p['size'] as num?)?.toInt() ?? 0));

  /// 无网启动练习：从题包随机抽一组。
  static List<Map<String, dynamic>>? drawOffline(String? module, int count) {
    List<dynamic> pool = [];
    if (module != null && module.isNotEmpty) {
      final pack = getPack(module);
      if (pack == null) return null;
      pool = pack['items'] as List<dynamic>? ?? [];
    } else {
      for (final (m, _) in packModules) {
        final pack = getPack(m);
        if (pack != null) pool.addAll(pack['items'] as List<dynamic>? ?? []);
      }
    }
    if (pool.isEmpty) return null;
    final arr = pool.toList()..shuffle(Random());
    return arr
        .take(min(count, arr.length))
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
  }

  // ---------- 离线作答队列（联网后自动同步，按 key 去重） ----------

  static int pendingCount() {
    final q = Store.instance.offlineQueue;
    return (q['answers'] as List).length + (q['mistakes'] as List).length;
  }

  /// items: answer_log 条目；key = uid|qid|时间戳 防重复入队/重复上传。
  static void enqueueAnswers(String uid, List<Map<String, dynamic>> items) {
    final q = Store.instance.offlineQueue;
    final answers = (q['answers'] as List).toList();
    final seen = answers.map((a) => a['key']).toSet();
    for (final it in items) {
      final key =
          '$uid|${it['qid'] ?? 'x'}|${it['t'] ?? DateTime.now().millisecondsSinceEpoch}';
      if (seen.contains(key)) continue;
      seen.add(key);
      answers.add({'key': key, 'uid': uid, 'item': it});
    }
    q['answers'] = answers;
    Store.instance.offlineQueue = q;
  }

  static void enqueueMistake(Map<String, dynamic> data) {
    final q = Store.instance.offlineQueue;
    final mistakes = (q['mistakes'] as List).toList();
    final key =
        '${data['uid']}|${data['question_id'] ?? data['question_text'] ?? ''}';
    if (mistakes.any((m) => m['key'] == key)) return;
    mistakes.add({'key': key, 'data': data});
    q['mistakes'] = mistakes;
    Store.instance.offlineQueue = q;
  }

  static bool _flushing = false;

  /// 上传离线队列；成功后按 key 出队。返回是否全部同步完成。
  static Future<bool> flushQueue() async {
    if (_flushing) return false;
    var q = Store.instance.offlineQueue;
    if ((q['answers'] as List).isEmpty && (q['mistakes'] as List).isEmpty) {
      return true;
    }
    _flushing = true;
    try {
      // answer_log：按 uid 分组批量上传，成功后出队
      final byUid = <String, List<dynamic>>{};
      for (final a in q['answers'] as List) {
        byUid.putIfAbsent((a['uid'] ?? '').toString(), () => []).add(a);
      }
      for (final e in byUid.entries) {
        await Api.dio.post('/api/answer_log', data: {
          'uid': e.key,
          'items': e.value.map((a) => a['item']).toList(),
        });
        final done = e.value.map((a) => a['key']).toSet();
        q = Store.instance.offlineQueue;
        q['answers'] =
            (q['answers'] as List).where((a) => !done.contains(a['key'])).toList();
        Store.instance.offlineQueue = q;
      }
      // 错题：逐条补传（后端按 uid+question_text 合并，无重复风险）
      for (final m in (Store.instance.offlineQueue['mistakes'] as List).toList()) {
        await Api.dio.post('/api/mistakes', data: m['data']);
        q = Store.instance.offlineQueue;
        q['mistakes'] =
            (q['mistakes'] as List).where((x) => x['key'] != m['key']).toList();
        Store.instance.offlineQueue = q;
      }
      return pendingCount() == 0;
    } catch (_) {
      // 仍无网络：下次联网/前台时再试
      return false;
    } finally {
      _flushing = false;
    }
  }
}
