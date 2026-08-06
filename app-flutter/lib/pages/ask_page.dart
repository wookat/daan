import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 「继续问 AI」触发信号：AskPage 已挂载（IndexedStack 常驻）时也能弹出预填表单。
final ValueNotifier<int> askRedoTick = ValueNotifier(0);

/// AI 问答会话式：拍题/文字讲解（流式）+ 答案卡 + 追问 + 出同款题 + 入错题本 + 历史会话/最近讲解。
class AskPage extends StatefulWidget {
  const AskPage({super.key});

  @override
  State<AskPage> createState() => AskPageState();
}

/// 单条讲解记录（对应 uni-app results 元素）
class ExplainItem {
  ExplainItem({required this.ts});

  final int ts;
  String module = '';
  String moduleName = '';
  String questionType = '';
  String questionText = '';
  String explanation = '';
  String explainKey = '';
  String userAnswer = '';
  String userText = '';
  String userImage = '';
  bool saved = false;
  bool streaming = true;
  String? rated;
  Map<String, String>? ansCard; // {ans, method, brief}
  String body = ''; // 去掉答案卡后的正文
  List<Map<String, String>> fu = [];
  bool fuLoading = false;
  Map<String, dynamic>? sim;
  bool simLoading = false;

  Map<String, dynamic> toJson() => {
        'ts': ts,
        'module': module,
        'module_name': moduleName,
        'question_type': questionType,
        'question_text': questionText,
        'explanation': explanation,
        'explain_key': explainKey,
        'user_answer': userAnswer,
        'userText': userText,
        'saved': saved,
        'fu': fu,
      };

  static ExplainItem fromJson(Map<String, dynamic> j) {
    final r = ExplainItem(ts: (j['ts'] ?? 0) as int);
    r.module = (j['module'] ?? '').toString();
    r.moduleName = (j['module_name'] ?? '').toString();
    r.questionType = (j['question_type'] ?? '').toString();
    r.questionText = (j['question_text'] ?? '').toString();
    r.explanation = (j['explanation'] ?? '').toString();
    r.explainKey = (j['explain_key'] ?? '').toString();
    r.userAnswer = (j['user_answer'] ?? '').toString();
    r.userText = (j['userText'] ?? '').toString();
    r.saved = j['saved'] == true;
    r.streaming = false;
    r.fu = (j['fu'] as List<dynamic>? ?? [])
        .map((m) => {
              'role': (m['role'] ?? '').toString(),
              'content': (m['content'] ?? '').toString(),
            })
        .toList();
    return r;
  }
}

class AskPageState extends State<AskPage> {
  final List<ExplainItem> results = [];
  List<dynamic> sessions = [];
  List<dynamic> recent = [];
  bool loading = false;
  String loadingText = '';
  String? error;
  Timer? _loadTimer;
  final _fuCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    sessions = Store.instance.askSessions;
    recent = Store.instance.recentExplains;
    for (final j in Store.instance.askCurSession) {
      final r = ExplainItem.fromJson(Map<String, dynamic>.from(j));
      _applyExplain(r, r.explanation);
      results.add(r);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkRedo());
    askRedoTick.addListener(_checkRedo);
  }

  @override
  void dispose() {
    askRedoTick.removeListener(_checkRedo);
    _loadTimer?.cancel();
    _fuCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _checkRedo() {
    final redo = Store.instance.redoQuestion;
    if (redo.isEmpty) return;
    Store.instance.clearRedoQuestion();
    _openTextSheet(prefill: redo);
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('题目已填入，先自己做一遍再点讲解')));
  }

  // ---------- 答案卡解析（复刻 splitAnswer） ----------

  String _stripStop(String s) =>
      s.replaceAll(RegExp(r'<\|[a-z_]+\|>', caseSensitive: false), '').trimRight();

  void _applyExplain(ExplainItem r, String raw) {
    final full = _stripStop(raw);
    if (r.ansCard == null) {
      final first = full.split('\n').first;
      if (first.startsWith('【答案】') && !full.contains('\n')) {
        r.body = '';
        return;
      }
    }
    final m = RegExp(
            r'^\s*【答案】\s*([^｜|\n]+?)\s*[｜|]\s*【方法】\s*([^｜|\n]+?)\s*[｜|]\s*【一句话】\s*([^\n]*)\n?')
        .firstMatch(full);
    if (m != null) {
      r.ansCard = {
        'ans': m.group(1)!.trim(),
        'method': m.group(2)!.trim(),
        'brief': m.group(3)!.trim(),
      };
      r.body = full.substring(m.end);
      return;
    }
    final lines = full.split('\n');
    for (var i = 0; i < lines.length && i < 6; i++) {
      final am = RegExp(r'【答案】\s*[:：]?\s*([^｜|【\n]+)').firstMatch(lines[i]);
      if (am == null) continue;
      final mm = RegExp(r'【方法】\s*[:：]?\s*([^｜|【\n]+)').firstMatch(lines[i]);
      final bm = RegExp(r'【一句话】\s*[:：]?\s*([^｜|【\n]+)').firstMatch(lines[i]);
      r.ansCard = {
        'ans': am.group(1)!.trim(),
        'method': mm?.group(1)?.trim() ?? '',
        'brief': bm?.group(1)?.trim() ?? '',
      };
      r.body = [...lines.sublist(0, i), ...lines.sublist(i + 1)].join('\n');
      return;
    }
    r.body = full;
  }

  void _saveRecent(ExplainItem r) {
    if (recent.any((x) => x['ts'] == r.ts)) return;
    final brief = r.ansCard?['brief'] ?? '';
    recent = [
      {
        'ts': r.ts,
        'module_name': r.moduleName,
        'question_type': r.questionType,
        'ans': r.ansCard?['ans'] ?? '',
        'brief': brief.length > 40 ? brief.substring(0, 40) : brief,
      },
      ...recent,
    ].take(10).toList();
    Store.instance.recentExplains = recent;
  }

  // ---------- 会话持久化（复刻 askCurSession / askSessions） ----------

  void _persistSession() {
    Store.instance.askCurSession = results.map((r) => r.toJson()).toList();
  }

  void _archiveCurrent() {
    if (results.isEmpty) return;
    final first = results.last;
    var title = first.ansCard?['brief'] ?? '';
    if (title.isEmpty) title = first.userText;
    if (title.isEmpty) title = first.questionText;
    if (title.isEmpty) title = '问答会话';
    if (title.length > 30) title = title.substring(0, 30);
    final items = Store.instance.askCurSession;
    if (items.isEmpty) return;
    sessions = [
      {
        'id': DateTime.now().millisecondsSinceEpoch,
        'ts': DateTime.now().millisecondsSinceEpoch,
        'title': title,
        'n': items.length,
        'items': items,
      },
      ...sessions,
    ].take(20).toList();
    Store.instance.askSessions = sessions;
  }

  void _newSession() {
    _archiveCurrent();
    setState(() {
      results.clear();
      error = null;
    });
    Store.instance.clearAskCurSession();
  }

  void _loadSession(int i) {
    final s = Map<String, dynamic>.from(sessions[i]);
    _archiveCurrent();
    sessions.removeAt(i);
    Store.instance.askSessions = sessions;
    setState(() {
      results
        ..clear()
        ..addAll((s['items'] as List<dynamic>).map((j) {
          final r = ExplainItem.fromJson(Map<String, dynamic>.from(j));
          _applyExplain(r, r.explanation);
          return r;
        }));
    });
    _persistSession();
    _scrollBottom();
  }

  void _delSession(int i) {
    setState(() => sessions.removeAt(i));
    Store.instance.askSessions = sessions;
  }

  void _scrollBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      }
    });
  }

  // ---------- 提问入口 ----------

  Future<void> _pickImage(ImageSource src) async {
    final f = await _picker.pickImage(source: src, maxWidth: 2000, imageQuality: 88);
    if (f == null) return;
    _doExplain(img: f.path);
  }

  void _openImageSheet() {
    showModalBottomSheet(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(LucideIcons.camera, color: KgColors.brand),
              title: const Text('拍照识题'),
              onTap: () {
                Navigator.pop(c);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(LucideIcons.image, color: KgColors.brand),
              title: const Text('从相册选择'),
              onTap: () {
                Navigator.pop(c);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _openTextSheet({String prefill = '', String prefillAnswer = ''}) {
    final qCtrl = TextEditingController(text: prefill);
    final aCtrl = TextEditingController(text: prefillAnswer);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(c).viewInsets.bottom),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('粘贴题目文字',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(
                controller: qCtrl,
                maxLines: 5,
                decoration: const InputDecoration(
                  hintText: '粘贴或输入题干与选项…',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: aCtrl,
                decoration: const InputDecoration(
                  hintText: '我的答案（选填，如 B）',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              FilledButton(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(46)),
                onPressed: () {
                  final txt = qCtrl.text.trim();
                  if (txt.isEmpty) return;
                  Navigator.pop(c);
                  _doExplain(text: txt, userAnswer: aCtrl.text.trim());
                },
                child: const Text('开始讲解'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _startLoadTimer() {
    var secs = 0;
    loadingText = '⏳ AI 识题中…（0秒）';
    _loadTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      secs++;
      if (!mounted) return;
      setState(() {
        loadingText = secs < 8
            ? '⏳ AI 识题中…（$secs秒）'
            : secs < 25
                ? '已识题，正在匹配花生十三方法…（$secs秒）'
                : '正在生成分步讲解，马上好…（$secs秒）';
      });
    });
  }

  /// AI 问答需访问码（内测）：提前提示；取消时不丢失已输入内容
  Future<bool> _ensureAccess() async {
    if (Store.instance.accessCode.isNotEmpty) return true;
    if (!await Api.accessRequired()) return true;
    if (!mounted) return false;
    await _promptAccessCode();
    if (Store.instance.accessCode.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('已取消，输入的内容已保留')));
      }
      return false;
    }
    return true;
  }

  Future<void> _doExplain({String img = '', String text = '', String userAnswer = ''}) async {
    if (img.isEmpty && text.isEmpty) return;
    if (!await _ensureAccess()) {
      // 取消访问码：回填粘贴弹层，不丢失已输入内容
      if (text.isNotEmpty && mounted) {
        _openTextSheet(prefill: text, prefillAnswer: userAnswer);
      }
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    _startLoadTimer();
    final rec = ExplainItem(ts: DateTime.now().millisecondsSinceEpoch)
      ..userImage = img
      ..userText = text
      ..userAnswer = userAnswer;
    var inserted = false;
    try {
      final d = await Api.explainStream(
        imagePath: img.isEmpty ? null : img,
        text: text.isEmpty ? null : text,
        userAnswer: userAnswer.isEmpty ? null : userAnswer,
        onMeta: (m) {
          rec
            ..module = (m['module'] ?? '').toString()
            ..moduleName = (m['module_name'] ?? '').toString()
            ..questionType = (m['question_type'] ?? '').toString()
            ..questionText = (m['question_text'] ?? '').toString()
            ..explainKey = (m['explain_key'] ?? '').toString();
          if ((m['user_answer'] ?? '').toString().isNotEmpty) {
            rec.userAnswer = m['user_answer'].toString();
          }
          if (mounted) {
            setState(() {
              results.insert(0, rec);
              inserted = true;
              loading = false;
            });
            _loadTimer?.cancel();
            _scrollBottom();
          }
        },
        onDelta: (full) {
          rec.explanation = full;
          _applyExplain(rec, full);
          if (mounted) setState(() {});
        },
      );
      if (!inserted && mounted) setState(() => results.insert(0, rec));
      rec
        ..explanation = (d['explanation'] ?? '').toString()
        ..streaming = false;
      _applyExplain(rec, rec.explanation);
      _saveRecent(rec);
      _persistSession();
    } catch (e) {
      setState(() => error = e is DioException
          ? Api.errMsg(e)
          : e is Exception
              ? e.toString().replaceFirst('Exception: ', '')
              : Api.errMsg(e));
    }
    _loadTimer?.cancel();
    if (mounted) {
      setState(() => loading = false);
      _scrollBottom();
    }
  }

  // ---------- 行动 ----------

  Future<void> _rate(ExplainItem r, bool up) async {
    setState(() => r.rated = up ? 'up' : 'down');
    try {
      await Api.rateExplain(r.explainKey, up);
    } catch (_) {/* 静默失败 */}
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(up ? '感谢反馈' : '已记录，我们会核查这条解析')));
    }
  }

  Future<void> _save(ExplainItem r) async {
    if (r.saved) return;
    try {
      await Api.saveMistake({
        'module': r.module,
        'question_type': r.questionType,
        'question_text': r.questionText,
        'user_answer': r.userAnswer,
        'explanation': r.explanation,
      });
      setState(() => r.saved = true);
      _persistSession();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已存入错题本')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('保存失败：${Api.errMsg(e)}')));
      }
    }
  }

  Future<void> _genSimilar(ExplainItem r) async {
    if (r.simLoading) return;
    setState(() => r.simLoading = true);
    try {
      final content = await Api.similar(r.questionText, r.questionType);
      final parts = content.split('<!--answer-->');
      final m = RegExp(r'答案[：:\s*]*([A-D])').firstMatch(parts.length > 1 ? parts[1] : '');
      setState(() {
        r.sim = {
          'raw': parts[0],
          'rawAns': parts.length > 1 ? parts[1] : '',
          'correct': m?.group(1),
          'picked': '',
          'saved': false,
        };
      });
      _scrollBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('出题失败：${Api.errMsg(e)}')));
      }
    }
    if (mounted) setState(() => r.simLoading = false);
  }

  Future<void> _saveSim(ExplainItem r) async {
    final sim = r.sim!;
    if (sim['saved'] == true) return;
    final qtext = (sim['raw'] ?? '')
        .toString()
        .replaceFirst(RegExp(r'^##\s*练习题\s*'), '')
        .replaceFirst(RegExp(r'##\s*提示[\s\S]*$'), '')
        .trim();
    try {
      await Api.saveMistake({
        'module': r.module,
        'question_type': r.questionType,
        'question_text': qtext,
        'user_answer': sim['picked'],
        'correct_answer': sim['correct'],
        'explanation': '${sim['raw'] ?? ''}\n${sim['rawAns'] ?? ''}'.trim(),
      });
      setState(() => sim['saved'] = true);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已存入错题本')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('保存失败：${Api.errMsg(e)}')));
      }
    }
  }

  Future<void> _followup(ExplainItem r, String q) async {
    if (r.fuLoading || r.streaming || q.trim().isEmpty) return;
    setState(() {
      r.fu.add({'role': 'user', 'content': q});
      r.fuLoading = true;
    });
    _scrollBottom();
    try {
      final ans = await Api.followup(
        questionText: r.questionText,
        explanation: r.explanation,
        history: r.fu
            .sublist(0, r.fu.length - 1)
            .map((m) => {
                  'role': m['role'] == 'ai' ? 'assistant' : 'user',
                  'content': m['content'] ?? '',
                })
            .toList(),
        query: q,
      );
      setState(() => r.fu.add({'role': 'ai', 'content': _stripStop(ans)}));
      _persistSession();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('追问失败：${Api.errMsg(e)}')));
      }
    }
    if (mounted) {
      setState(() => r.fuLoading = false);
      _scrollBottom();
    }
  }

  void _openHistory() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => StatefulBuilder(
        builder: (c, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                      color: KgColors.border, borderRadius: BorderRadius.circular(2)),
                ),
                const Text('历史会话',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                if (sessions.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Text('暂无历史会话', style: TextStyle(color: KgColors.t3)),
                  )
                else
                  Flexible(
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: sessions.length,
                      itemBuilder: (context, i) {
                        final s = Map<String, dynamic>.from(sessions[i]);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading:
                              const Icon(LucideIcons.messageSquare, color: KgColors.brand),
                          title: Text((s['title'] ?? '').toString(),
                              maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text('${s['n']} 条 · ${_fmtTs(s['ts'])}',
                              style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                          trailing: IconButton(
                            icon:
                                const Icon(LucideIcons.trash2, size: 18, color: KgColors.t4),
                            onPressed: () {
                              _delSession(i);
                              setSheet(() {});
                            },
                          ),
                          onTap: () {
                            Navigator.pop(c);
                            _loadSession(i);
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _fmtTs(dynamic ts) {
    if (ts is! num) return '';
    final d = DateTime.fromMillisecondsSinceEpoch(ts.toInt());
    return '${d.month}/${d.day} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  // ---------- UI ----------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 问答'),
        actions: [
          if (results.isNotEmpty)
            TextButton(onPressed: _newSession, child: const Text('新对话')),
          IconButton(
              onPressed: _openHistory, icon: const Icon(LucideIcons.history, size: 20)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: results.isEmpty && !loading && error == null
                ? _emptyGuide()
                : ListView(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final r in results.reversed) ..._convoItem(r),
                      if (loading) _loadingBubble(),
                      if (error != null) _errorBubble(),
                    ],
                  ),
          ),
          _bottomBar(),
        ],
      ),
    );
  }

  Widget _emptyGuide() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 16),
      children: [
        const Center(child: Text('💬', style: TextStyle(fontSize: 56))),
        const SizedBox(height: 16),
        const Center(
          child: Text('拍题讲解 · 会话式 AI 问答',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 10),
        const Center(
          child: Text(
            '拍照或粘贴题目，AI 按花生十三方法体系分步讲解\n讲完可追问、出同款题、一键存入错题本',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: KgColors.t3, height: 1.7),
          ),
        ),
        const SizedBox(height: 28),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: _openImageSheet,
                icon: const Icon(LucideIcons.camera, size: 18),
                label: const Text('拍题 / 相册'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: () => _openTextSheet(),
                icon: const Icon(LucideIcons.clipboard, size: 18),
                label: const Text('粘贴文字'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Center(
          child: InkWell(
            onTap: () => context.push('/interview'),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.mic, size: 14, color: Color(0xFF7C3AED)),
                SizedBox(width: 4),
                Text('AI 面试陪练：抽真题 · 考官打分点评 ›',
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF7C3AED))),
              ],
            ),
          ),
        ),
        if (recent.isNotEmpty) ...[
          const SizedBox(height: 28),
          const Text('最近讲解', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          for (final it in recent) _recentRow(Map<String, dynamic>.from(it)),
        ],
      ],
    );
  }

  Widget _recentRow(Map<String, dynamic> it) {
    final tag = [it['module_name'], it['question_type']]
        .where((e) => e != null && e.toString().isNotEmpty)
        .join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            const Icon(LucideIcons.sparkles, size: 16, color: KgColors.brand),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tag.isEmpty ? '讲解记录' : tag,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  if ((it['brief'] ?? '').toString().isNotEmpty)
                    Text((it['brief'] ?? '').toString(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                ],
              ),
            ),
            if ((it['ans'] ?? '').toString().isNotEmpty)
              Container(
                height: 20,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: KgColors.successBg,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text('答案 ${it['ans']}',
                    style: const TextStyle(fontSize: 11, color: KgColors.success)),
              ),
            const SizedBox(width: 4),
            Text(_fmtTs(it['ts']), style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
        ),
      ),
    );
  }

  List<Widget> _convoItem(ExplainItem r) {
    return [
      // 用户消息
      if (r.userText.isNotEmpty) _meBubble(Text(r.userText, style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.6))),
      if (r.userImage.isNotEmpty)
        _meBubble(ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Image.file(File(r.userImage),
              width: 150,
              fit: BoxFit.cover,
              errorBuilder: (c, e, s) => Container(
                    width: 150,
                    height: 90,
                    color: KgColors.fill,
                    alignment: Alignment.center,
                    child: const Text('🖼 题目截图',
                        style: TextStyle(fontSize: 12, color: KgColors.t4)),
                  )),
        )),
      // AI 回答
      _aiBubble(r),
      // 追问对话
      for (final m in r.fu)
        m['role'] == 'user'
            ? _meBubble(Text(m['content'] ?? '',
                style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.6)))
            : _plainAiBubble(m['content'] ?? ''),
      if (r.fuLoading) _plainAiBubble('思考中…'),
      // 同款题
      if (r.sim != null) _simCard(r),
      // 追问 chips
      if (!r.streaming)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip('再讲细一点', () => _followup(r, '再讲细一点')),
              _chip(r.simLoading ? '出题中…' : '出一道同款题', () => _genSimilar(r)),
              _chip(r.saved ? '已存入错题本' : '存入错题本', () => _save(r)),
            ],
          ),
        ),
    ];
  }

  Widget _chip(String label, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: KgColors.fill,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label, style: const TextStyle(fontSize: 12, color: KgColors.t2)),
      ),
    );
  }

  Widget _meBubble(Widget child) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .82),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: const BoxDecoration(
          color: KgColors.brand,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(14),
            topRight: Radius.circular(14),
            bottomLeft: Radius.circular(14),
            bottomRight: Radius.circular(4),
          ),
        ),
        child: child,
      ),
    );
  }

  BoxDecoration get _aiDeco => BoxDecoration(
        color: Theme.of(context).cardTheme.color ?? Colors.white,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(14),
          topRight: Radius.circular(14),
          bottomLeft: Radius.circular(4),
          bottomRight: Radius.circular(14),
        ),
        boxShadow: [
          BoxShadow(
              color: const Color(0xFF17181C).withValues(alpha: .05),
              blurRadius: 4,
              offset: const Offset(0, 1)),
        ],
      );

  Widget _plainAiBubble(String text) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .82),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: _aiDeco,
        child: Text(text, style: const TextStyle(fontSize: 14, height: 1.7)),
      ),
    );
  }

  Widget _aiBubble(ExplainItem r) {
    final tag = [r.moduleName, r.questionType]
        .where((e) => e.isNotEmpty)
        .join(' · ');
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .88),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: _aiDeco,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (tag.isNotEmpty)
              Container(
                height: 20,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                margin: const EdgeInsets.only(bottom: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: KgColors.brand50,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(tag,
                    style: const TextStyle(fontSize: 11, color: KgColors.brand)),
              ),
            if (r.ansCard != null) _answerCard(r.ansCard!),
            if (r.body.trim().isNotEmpty)
              Text(r.body.trim(), style: const TextStyle(fontSize: 14, height: 1.7)),
            if (r.streaming)
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text('▍生成中…', style: TextStyle(fontSize: 12, color: KgColors.t3)),
              ),
            if (!r.streaming && r.explainKey.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Text('这条讲解有用吗？',
                      style: TextStyle(fontSize: 12, color: KgColors.t4)),
                  const SizedBox(width: 8),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: r.rated != null ? null : () => _rate(r, true),
                    icon: Icon(LucideIcons.thumbsUp,
                        size: 16,
                        color: r.rated == 'up' ? KgColors.brand : KgColors.t4),
                  ),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: r.rated != null ? null : () => _rate(r, false),
                    icon: Icon(LucideIcons.thumbsDown,
                        size: 16,
                        color: r.rated == 'down' ? KgColors.error : KgColors.t4),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _answerCard(Map<String, String> card) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KgColors.brand50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: KgColors.brand100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('答案', style: TextStyle(fontSize: 12, color: KgColors.t3)),
              const SizedBox(width: 8),
              Text(card['ans'] ?? '',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w800, color: KgColors.brand)),
              const Spacer(),
              if ((card['method'] ?? '').isNotEmpty)
                Container(
                  height: 20,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(card['method']!,
                      style: const TextStyle(fontSize: 11, color: KgColors.brand)),
                ),
            ],
          ),
          if ((card['brief'] ?? '').isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(card['brief']!,
                style: const TextStyle(fontSize: 13, color: KgColors.t2, height: 1.6)),
          ],
        ],
      ),
    );
  }

  Widget _simCard(ExplainItem r) {
    final sim = r.sim!;
    final raw = (sim['raw'] ?? '').toString();
    final picked = (sim['picked'] ?? '').toString();
    final correct = sim['correct']?.toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: _aiDeco,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('同款练习题', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: 8),
          Text(
            raw
                .replaceFirst(RegExp(r'^##\s*练习题\s*'), '')
                .replaceFirst(RegExp(r'##\s*提示[\s\S]*$'), '')
                .trim(),
            style: const TextStyle(fontSize: 14, height: 1.7),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              for (final o in const ['A', 'B', 'C', 'D'])
                InkWell(
                  borderRadius: BorderRadius.circular(999),
                  onTap: picked.isEmpty
                      ? () => setState(() => sim['picked'] = o)
                      : null,
                  child: Container(
                    width: 40,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: picked.isEmpty
                          ? KgColors.fill
                          : o == correct
                              ? KgColors.successBg
                              : o == picked
                                  ? KgColors.errorBg
                                  : KgColors.fill,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(o,
                        style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: picked.isEmpty
                                ? KgColors.t2
                                : o == correct
                                    ? KgColors.success
                                    : o == picked
                                        ? KgColors.error
                                        : KgColors.t4)),
                  ),
                ),
            ],
          ),
          if (picked.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              (sim['rawAns'] ?? '').toString().trim(),
              style: const TextStyle(fontSize: 13, height: 1.6, color: KgColors.t2),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _chip(sim['saved'] == true ? '已存入错题本' : '存入错题本', () => _saveSim(r)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _loadingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: _aiDeco,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
                width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
            const SizedBox(width: 10),
            Text(loadingText, style: const TextStyle(fontSize: 13, color: KgColors.t3)),
          ],
        ),
      ),
    );
  }

  Widget _errorBubble() {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: KgColors.errorBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('讲解失败：$error',
              style: const TextStyle(fontSize: 13, color: KgColors.error)),
          if ('$error'.contains('访问码'))
            TextButton(
              onPressed: _promptAccessCode,
              child: const Text('填写访问码', style: TextStyle(fontSize: 13)),
            ),
        ],
      ),
    );
  }

  Future<void> _promptAccessCode() async {
    final ctrl = TextEditingController(text: Store.instance.accessCode);
    final code = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('需要访问码（内测功能）'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: '请输入访问码，可联系管理员获取'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('取消')),
          FilledButton(
            onPressed: () => Navigator.pop(c, ctrl.text.trim()),
            child: const Text('保存'),
          ),
        ],
      ),
    );
    if (code != null && code.isNotEmpty) {
      Store.instance.accessCode = code;
      setState(() => error = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('访问码已保存，请重新发起讲解')));
      }
    }
  }

  Widget _bottomBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
        child: Row(
          children: [
            IconButton(
              onPressed: _openImageSheet,
              icon: const Icon(LucideIcons.camera, color: KgColors.brand),
            ),
            IconButton(
              onPressed: () => _openTextSheet(),
              icon: const Icon(LucideIcons.clipboard, color: KgColors.brand),
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).cardTheme.color ?? Colors.white,
                  border: Border.all(color: KgColors.border),
                  borderRadius: BorderRadius.circular(999),
                ),
                padding: const EdgeInsets.only(left: 16, right: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _fuCtrl,
                        enabled: results.isNotEmpty,
                        decoration: InputDecoration(
                          hintText: results.isEmpty ? '先拍题或粘贴题目开始…' : '继续追问这道题…',
                          hintStyle:
                              const TextStyle(fontSize: 14, color: KgColors.t4),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onSubmitted: (v) {
                          _fuCtrl.clear();
                          if (results.isNotEmpty) _followup(results.first, v);
                        },
                      ),
                    ),
                    InkWell(
                      borderRadius: BorderRadius.circular(999),
                      onTap: results.isEmpty
                          ? null
                          : () {
                              final v = _fuCtrl.text;
                              _fuCtrl.clear();
                              _followup(results.first, v);
                            },
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                              colors: [KgColors.gradStart, KgColors.brand]),
                        ),
                        child: const Icon(LucideIcons.arrowUp,
                            size: 18, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
