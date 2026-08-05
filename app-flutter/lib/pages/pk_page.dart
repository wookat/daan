import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

const _perQSec = 30;

/// 答题 PK：发起挑战/挑战码应战/随机匹配 → 同组 10 题限时作答 → 比分结果 + 周榜，
/// 对照 frontend-uni/src/pkgA/pk/pk.vue。
class PkPage extends StatefulWidget {
  const PkPage({super.key, this.joinCode});

  final String? joinCode;

  @override
  State<PkPage> createState() => _PkPageState();
}

class _PkPageState extends State<PkPage> {
  String view = 'home'; // home / quiz / result
  String? module;
  final joinCtrl = TextEditingController();
  Map<String, dynamic> lb = {'items': <dynamic>[], 'my_rank': null, 'my_wins': 0};
  Map<String, dynamic> mine = {'items': <dynamic>[], 'wins': 0};

  // 对局
  String code = '';
  Map<String, dynamic>? match;
  String? mySide;
  List<dynamic> questions = [];
  int qIndex = 0;
  String picked = '';
  final answers = <Map<String, dynamic>>[];
  DateTime qStart = DateTime.now();
  int timeLeft = _perQSec;
  Timer? _timer;
  String rivalName = '';
  bool rivalDone = false;
  bool submitting = false;
  late final String myName = Api.pkNickname();

  @override
  void initState() {
    super.initState();
    _loadHome();
    if (widget.joinCode != null && widget.joinCode!.isNotEmpty) {
      joinCtrl.text = widget.joinCode!;
      _joinByCode();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    joinCtrl.dispose();
    super.dispose();
  }

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _loadHome() async {
    try {
      final rs = await Future.wait([Api.pkLeaderboard(), Api.pkMine()]);
      if (mounted) {
        setState(() {
          lb = rs[0];
          mine = rs[1];
        });
      }
    } catch (_) {/* 非关键路径 */}
  }

  Future<void> _createMatch() async {
    try {
      final d = await Api.pkCreate(module);
      _startQuiz((d['code'] ?? '').toString(), d['questions'] as List<dynamic>, 'creator');
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _randomMatch() async {
    try {
      final d = await Api.pkRandomMatch(module);
      if (d['matched'] == true) {
        _toast('已匹配到对手！');
        _startQuiz((d['code'] ?? '').toString(), d['questions'] as List<dynamic>, 'opponent');
        unawaited(_loadRival((d['code'] ?? '').toString()));
      } else {
        _toast('暂无对手，已为你开局等待匹配');
        _startQuiz((d['code'] ?? '').toString(), d['questions'] as List<dynamic>, 'creator');
      }
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _joinByCode() async {
    final c = joinCtrl.text.trim().toUpperCase();
    if (c.isEmpty) {
      _toast('请输入挑战码');
      return;
    }
    try {
      final d = await Api.pkJoin(c);
      _startQuiz((d['code'] ?? '').toString(), d['questions'] as List<dynamic>, 'opponent');
      unawaited(_loadRival((d['code'] ?? '').toString()));
    } catch (e) {
      final msg = Api.errMsg(e);
      if (msg.contains('已被') || msg.contains('自己')) {
        unawaited(_viewResult(c));
      } else {
        _toast(msg);
      }
    }
  }

  Future<void> _loadRival(String c) async {
    try {
      final d = await Api.pkMatch(c);
      final m = Map<String, dynamic>.from(d['match'] as Map);
      final their = m['my_side'] == 'creator' ? m['opponent'] : m['creator'];
      if (their is Map && mounted) {
        setState(() {
          rivalName = (their['name'] ?? '').toString();
          rivalDone = their['done'] == true;
        });
      }
    } catch (_) {/* 非关键路径 */}
  }

  void _startQuiz(String c, List<dynamic> qs, String side) {
    setState(() {
      code = c;
      questions = qs;
      mySide = side;
      qIndex = 0;
      answers.clear();
      picked = '';
      rivalName = '';
      rivalDone = false;
      view = 'quiz';
    });
    _beginQ();
  }

  void _beginQ() {
    picked = '';
    qStart = DateTime.now();
    timeLeft = _perQSec;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      final left = _perQSec - DateTime.now().difference(qStart).inSeconds;
      if (!mounted) return;
      setState(() => timeLeft = left.clamp(0, _perQSec));
      if (timeLeft <= 0) _lockAnswer('');
    });
  }

  Map<String, dynamic>? get curQ => qIndex < questions.length
      ? Map<String, dynamic>.from(questions[qIndex] as Map)
      : null;

  void _pick(String k) {
    if (picked.isNotEmpty) return;
    setState(() => picked = k);
    Timer(const Duration(milliseconds: 350), () => _lockAnswer(k));
  }

  void _lockAnswer(String k) {
    if (answers.length > qIndex) return;
    _timer?.cancel();
    final ms = DateTime.now().difference(qStart).inMilliseconds.clamp(0, _perQSec * 1000);
    answers.add({'question_id': curQ?['id'], 'answer': k, 'ms': ms});
    if (qIndex < questions.length - 1) {
      setState(() => qIndex++);
      _beginQ();
    } else {
      _finishQuiz();
    }
  }

  Future<void> _finishQuiz() async {
    if (submitting) return;
    submitting = true;
    try {
      final d = await Api.pkSubmit(code, answers);
      if (mounted) {
        setState(() {
          match = Map<String, dynamic>.from(d['match'] as Map);
          view = 'result';
        });
      }
    } catch (e) {
      _toast(Api.errMsg(e));
    } finally {
      submitting = false;
    }
  }

  Future<void> _viewResult(String c) async {
    try {
      final d = await Api.pkMatch(c);
      if (mounted) {
        setState(() {
          match = Map<String, dynamic>.from(d['match'] as Map);
          mySide = (match!['my_side'] ?? '').toString();
          code = c;
          view = 'result';
        });
      }
    } catch (e) {
      _toast(Api.errMsg(e));
    }
  }

  Future<void> _refreshMatch() async {
    await _viewResult(code);
    if (match != null && match!['status'] == 'finished') {
      _toast('对手已完成！');
    } else {
      _toast('对手还没完成，稍后再看');
    }
  }

  Map<String, dynamic>? _myP() {
    final m = match;
    if (m == null) return null;
    final p = mySide == 'opponent' ? m['opponent'] : m['creator'];
    return p is Map ? Map<String, dynamic>.from(p) : null;
  }

  Map<String, dynamic>? _theirP() {
    final m = match;
    if (m == null) return null;
    final p = mySide == 'opponent' ? m['creator'] : m['opponent'];
    return p is Map ? Map<String, dynamic>.from(p) : null;
  }

  String _fmtMs(dynamic ms) =>
      ms is num ? '${(ms / 1000).toStringAsFixed(1)}s' : '—';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('答题 PK')),
      body: switch (view) {
        'quiz' => _quizView(),
        'result' => _resultView(),
        _ => _homeView(),
      },
    );
  }

  // ---------- 入口页 ----------

  Widget _homeView() {
    final lbItems = lb['items'] as List<dynamic>? ?? [];
    final mineItems = mine['items'] as List<dynamic>? ?? [];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.swords, size: 22, color: Colors.white),
                  SizedBox(width: 8),
                  Text('答题 PK',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800)),
                ],
              ),
              SizedBox(height: 6),
              Text('同组 10 题 · 比分数拼手速 · 答对 +80，越快加成越高',
                  style: TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text('选择模块', style: TextStyle(fontSize: 12, color: KgColors.t3)),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final e in kModuleNames.entries)
              ChoiceChip(
                label: Text(e.value, style: const TextStyle(fontSize: 12.5)),
                selected: module == e.key,
                onSelected: (_) => setState(() => module = e.key),
              ),
            ChoiceChip(
              label: const Text('混合', style: TextStyle(fontSize: 12.5)),
              selected: module == null,
              onSelected: (_) => setState(() => module = null),
            ),
          ],
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: _createMatch, child: const Text('发起好友挑战')),
        const SizedBox(height: 10),
        FilledButton.tonal(onPressed: _randomMatch, child: const Text('随机匹配对手')),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: joinCtrl,
                maxLength: 8,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  hintText: '输入挑战码，如 A8X2QK',
                  counterText: '',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              style: FilledButton.styleFrom(
                  minimumSize: const Size(88, 44),
                  padding: const EdgeInsets.symmetric(horizontal: 20)),
              onPressed: _joinByCode,
              child: const Text('应战'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Text('本周胜场榜',
                style: TextStyle(fontSize: 12, color: KgColors.t3)),
            const Spacer(),
            if (lb['my_rank'] != null)
              Text('我的排名 #${lb['my_rank']} · ${lb['my_wins']} 胜',
                  style: const TextStyle(fontSize: 11.5, color: KgColors.brand)),
          ],
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: lbItems.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                        child: Text('本周还没有对局，快来抢占榜首！',
                            style:
                                TextStyle(fontSize: 12.5, color: KgColors.t3))),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < lbItems.length; i++) ...[
                        if (i > 0) const Divider(height: 1),
                        _lbRow(lbItems[i]),
                      ],
                    ],
                  ),
          ),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            const Text('我的对局', style: TextStyle(fontSize: 12, color: KgColors.t3)),
            const Spacer(),
            if ((mine['wins'] as num?) != null && (mine['wins'] as num) > 0)
              Text('累计 ${mine['wins']} 胜',
                  style: const TextStyle(fontSize: 11.5, color: KgColors.brand)),
          ],
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: mineItems.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Center(
                        child: Text('还没有对局记录',
                            style:
                                TextStyle(fontSize: 12.5, color: KgColors.t3))),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < mineItems.length; i++) ...[
                        if (i > 0) const Divider(height: 1),
                        _mineRow(Map<String, dynamic>.from(mineItems[i] as Map)),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _lbRow(dynamic e) {
    final rank = (e['rank'] as num?)?.toInt() ?? 0;
    final (bg, fg) = switch (rank) {
      1 => (const Color(0xFFFEF3C7), const Color(0xFFD97706)),
      2 => (const Color(0xFFE5E7EB), const Color(0xFF6B7280)),
      3 => (const Color(0xFFFDE8D7), const Color(0xFFC2632B)),
      _ => (KgColors.fill, KgColors.t3),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Text('$rank',
                style: TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text((e['name'] ?? '').toString(),
                style: const TextStyle(fontSize: 13.5)),
          ),
          Text('${e['wins']} 胜',
              style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: KgColors.brand)),
        ],
      ),
    );
  }

  Widget _mineRow(Map<String, dynamic> m) {
    final (bt, bbg, bfg) = _matchBadge(m);
    return InkWell(
      onTap: () => _openMatch(m),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                      '${kModuleNames[m['module']] ?? '混合'} · ${m['code']}',
                      style: const TextStyle(
                          fontSize: 13.5, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(_matchDesc(m),
                      style:
                          const TextStyle(fontSize: 11.5, color: KgColors.t3)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                  color: bbg, borderRadius: BorderRadius.circular(99)),
              child: Text(bt,
                  style: TextStyle(
                      fontSize: 11, fontWeight: FontWeight.w700, color: bfg)),
            ),
          ],
        ),
      ),
    );
  }

  String _matchDesc(Map<String, dynamic> m) {
    final my = m['my_side'] == 'opponent' ? m['opponent'] : m['creator'];
    final their = m['my_side'] == 'opponent' ? m['creator'] : m['opponent'];
    if (m['status'] == 'finished') {
      return '${my?['score']} : ${their?['score']} · ${their?['name']}';
    }
    if (my is! Map || my['done'] != true) return '待作答';
    return their is Map ? '等待 ${their['name']} 完成' : '等待对手应战';
  }

  (String, Color, Color) _matchBadge(Map<String, dynamic> m) {
    if (m['status'] != 'finished') {
      return ('等待中', KgColors.warningBg, KgColors.warning);
    }
    if (m['winner'] == 'draw') return ('平局', KgColors.fill, KgColors.t3);
    return m['winner'] == m['my_side']
        ? ('胜', KgColors.successBg, KgColors.success)
        : ('负', KgColors.errorBg, KgColors.error);
  }

  void _openMatch(Map<String, dynamic> m) {
    final my = m['my_side'] == 'opponent' ? m['opponent'] : m['creator'];
    if (m['my_side'] != null && !(my is Map && my['done'] == true)) {
      joinCtrl.text = (m['code'] ?? '').toString();
      _joinByCode();
      return;
    }
    _viewResult((m['code'] ?? '').toString());
  }

  // ---------- 答题页 ----------

  Widget _quizView() {
    final q = curQ;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _player(myName.isEmpty ? '我' : myName, '我',
                      '${answers.length}/${questions.length}', false),
                  const Text('VS',
                      style: TextStyle(
                          color: Colors.white70,
                          fontSize: 20,
                          fontWeight: FontWeight.w800)),
                  _player(rivalName.isEmpty ? '等待对手' : rivalName,
                      rivalName.isEmpty ? '?' : rivalName.substring(0, 1),
                      rivalDone ? '完成' : '—', true),
                ],
              ),
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: timeLeft / _perQSec,
                  minHeight: 7,
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation(Colors.white),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '本题剩余 $timeLeft 秒 · 答对+80，越快加成越高 · 第 ${qIndex + 1}/${questions.length} 题',
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < questions.length; i++)
              Container(
                width: 22,
                height: 6,
                margin: const EdgeInsets.symmetric(horizontal: 2.5),
                decoration: BoxDecoration(
                  color: i < answers.length
                      ? KgColors.brand
                      : i == qIndex
                          ? KgColors.brand.withValues(alpha: .4)
                          : KgColors.fill,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (q != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _tag(kModuleNames[q['module']] ?? (q['module'] ?? '').toString(),
                          KgColors.brand),
                      if ((q['submodule'] ?? '').toString().isNotEmpty) ...[
                        const SizedBox(width: 8),
                        _tag((q['submodule'] ?? '').toString(), KgColors.t3),
                      ],
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text((q['question'] ?? '').toString(),
                      style: const TextStyle(fontSize: 15, height: 1.7)),
                  const SizedBox(height: 12),
                  for (final e
                      in Map<String, dynamic>.from(q['options'] as Map? ?? {})
                          .entries)
                    _opt(e.key, e.value.toString()),
                ],
              ),
            ),
          ),
        if (rivalDone) ...[
          const SizedBox(height: 10),
          Card(
            color: KgColors.brand50,
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(LucideIcons.zap, size: 15, color: KgColors.brand),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text('对手已完成全部作答 —— 锁定你的答案！',
                        style:
                            TextStyle(fontSize: 12.5, color: KgColors.brand)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _player(String name, String avatar, String score, bool rival) {
    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration:
              const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: Text(avatar,
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: rival ? const Color(0xFFD97706) : KgColors.brand)),
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: 96,
          child: Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 11)),
        ),
        Text(score,
            style: const TextStyle(
                color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
      ],
    );
  }

  Widget _opt(String k, String t) {
    final on = picked == k;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => _pick(k),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: on
                ? (dark ? KgColors.brandDeep : KgColors.brand50)
                : (dark ? const Color(0xFF1A1C22) : Colors.white),
            border: Border.all(color: on ? KgColors.brand : KgColors.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Text('$k.', style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(width: 8),
              Expanded(
                  child:
                      Text(t, style: const TextStyle(fontSize: 14.5, height: 1.5))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tag(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(text,
          style:
              TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }

  // ---------- 结果 / 等待页 ----------

  Widget _resultView() {
    final m = match;
    if (m == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final finished = m['status'] == 'finished';
    final winner = (m['winner'] ?? '').toString();
    final String title;
    final List<Color> colors;
    if (!finished) {
      title = '⏳ 等待对手应战';
      colors = [const Color(0xFFF59E0B), const Color(0xFFD97706)];
    } else if (winner == 'draw') {
      title = '🤝 平局！';
      colors = [const Color(0xFF64748B), const Color(0xFF475569)];
    } else if (winner == mySide) {
      title = '🏆 胜利！';
      colors = [const Color(0xFF34D399), const Color(0xFF12B76A)];
    } else {
      title = '💪 惜败，再战一局';
      colors = [const Color(0xFF94A3B8), const Color(0xFF64748B)];
    }
    final my = _myP();
    final their = _theirP();
    final n = (m['n_questions'] as num?)?.toInt() ?? questions.length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: colors),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text('${kModuleNames[m['module']] ?? '混合模块'} · 挑战码 ${m['code']}',
                  style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: _resSide('${my?['name'] ?? myName}（我）',
                      '${my?['score'] ?? '—'}',
                      '答对 ${my?['correct'] ?? '—'}/$n · 用时 ${_fmtMs(my?['time_ms'])}'),
                ),
                const Text('VS',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: KgColors.t4)),
                Expanded(
                  child: their != null && their['done'] == true
                      ? _resSide((their['name'] ?? '').toString(),
                          '${their['score']}',
                          '答对 ${their['correct']}/$n · 用时 ${_fmtMs(their['time_ms'])}')
                      : _resSide(
                          their != null
                              ? (their['name'] ?? '').toString()
                              : '虚位以待',
                          '?',
                          '等待对手完成同组 $n 题'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (!finished) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const Text('把挑战发给考友，等 TA 应战',
                      style:
                          TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(
                          ClipboardData(text: (m['code'] ?? '').toString()));
                      _toast('挑战码已复制');
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 10),
                      decoration: BoxDecoration(
                        color: KgColors.fill,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text((m['code'] ?? '').toString(),
                              style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 3,
                                  color: KgColors.t1)),
                          const SizedBox(width: 10),
                          const Text('复制',
                              style: TextStyle(
                                  fontSize: 12, color: KgColors.brand)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () => Share.share(
                        '我在考公助手向你发起答题 PK（挑战码 ${m['code']}），敢来应战吗？https://kaogong.zalize.com/#/pkgA/pk/pk?code=${m['code']}'),
                    child: const Text('分享挑战给好友'),
                  ),
                  const SizedBox(height: 10),
                  FilledButton.tonal(
                      onPressed: _refreshMatch, child: const Text('刷新对局状态')),
                ],
              ),
            ),
          ),
        ] else
          FilledButton(
            onPressed: () {
              setState(() {
                module = (m['module'] ?? '') == '' ? null : m['module'] as String?;
                view = 'home';
              });
              _loadHome();
              _createMatch();
            },
            child: const Text('再来一局'),
          ),
        const SizedBox(height: 10),
        OutlinedButton(
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          onPressed: () {
            setState(() => view = 'home');
            _loadHome();
          },
          child: const Text('返回 PK 大厅'),
        ),
      ],
    );
  }

  Widget _resSide(String name, String score, String meta) {
    return Column(
      children: [
        Text(name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, color: KgColors.t2)),
        const SizedBox(height: 4),
        Text(score,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(meta,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 10.5, color: KgColors.t3)),
      ],
    );
  }
}
