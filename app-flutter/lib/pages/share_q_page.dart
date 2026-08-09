import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

const _kSite = 'https://kaogong.zalize.com';

/// 分享作答页：先作答 → 揭示对错/解析/大家的选择 → 去刷同类题（source=share）。
/// 复刻 pkgA/share/share-q.vue。
class ShareQPage extends StatefulWidget {
  const ShareQPage({super.key, required this.sid});

  final String sid;

  @override
  State<ShareQPage> createState() => _ShareQPageState();
}

class _ShareQPageState extends State<ShareQPage> {
  Map<String, dynamic>? d;
  bool loading = true;
  String? errMsg;
  String picked = '';
  Map<String, dynamic>? myResult;
  List<dynamic> answers = [];
  DateTime startTs = DateTime.now();
  bool submitting = false;
  Map<String, dynamic>? qStats;
  Map<String, dynamic>? teamInvite;
  bool teamJoined = false;
  bool joining = false;
  int joinedTeamId = 0;

  String get _beatText {
    final s = qStats;
    if (s == null || myResult == null) return '';
    final total = (s['total'] as num?)?.toInt() ?? 0;
    if (total == 0) return '';
    if (total < 5) return '🎯 你是第 $total 个作答的人，把题发给更多考友一起比比';
    if (myResult!['correct'] == true && s['beat_pct'] != null) {
      return '🏆 你击败了 ${s['beat_pct']}% 的作答者（共 $total 人做过这题）';
    }
    if (s['acc'] != null) return '共 $total 人做过这题，正确率 ${s['acc']}%，再战同类题赢回来';
    return '';
  }

  bool get revealed =>
      d != null && (d!['is_sharer'] == true || d!['answered'] == true || myResult != null);

  Map<String, dynamic> get _q => Map<String, dynamic>.from(d!['question'] as Map);

  @override
  void initState() {
    super.initState();
    Api.trackEvent('share_open', source: 'share', ref: widget.sid);
    _load();
  }

  Future<void> _load() async {
    if (widget.sid.isEmpty) {
      setState(() {
        loading = false;
        errMsg = '分享链接无效';
      });
      return;
    }
    try {
      final r = await Api.shareDetail(widget.sid);
      setState(() {
        d = r;
        answers = r['answers'] as List<dynamic>? ?? [];
        if (r['my_answer'] is Map) {
          myResult = Map<String, dynamic>.from(r['my_answer'] as Map);
        }
        if (r['q_stats'] is Map) qStats = Map<String, dynamic>.from(r['q_stats'] as Map);
        if (r['team_invite'] is Map) {
          teamInvite = Map<String, dynamic>.from(r['team_invite'] as Map);
        }
        startTs = DateTime.now();
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        errMsg = Api.errMsg(e);
      });
    }
  }

  Future<void> _pick(String k) async {
    if (revealed || submitting) return;
    setState(() {
      picked = k;
      submitting = true;
    });
    try {
      final secs = DateTime.now().difference(startTs).inSeconds;
      final r = await Api.shareAnswer(widget.sid, k, secs);
      setState(() {
        myResult = {'picked': k, 'correct': r['correct'] == true};
        d!['question'] = {
          ..._q,
          'answer': r['answer'],
          'explanation': r['explanation'],
        };
        answers = r['answers'] as List<dynamic>? ?? [];
        if (r['q_stats'] is Map) qStats = Map<String, dynamic>.from(r['q_stats'] as Map);
        if (r['team_invite'] is Map) {
          teamInvite = Map<String, dynamic>.from(r['team_invite'] as Map);
        }
      });
      Api.trackEvent('share_answer', source: 'share', ref: widget.sid);
    } catch (e) {
      setState(() => picked = '');
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
    if (mounted) setState(() => submitting = false);
  }

  Future<void> _joinTeam() async {
    final inv = teamInvite;
    if (inv == null || joining) return;
    setState(() => joining = true);
    try {
      final r = await Api.teamJoin((inv['code'] ?? '').toString());
      final team = r['team'];
      setState(() {
        teamJoined = true;
        if (team is Map) joinedTeamId = (team['id'] as num?)?.toInt() ?? 0;
      });
      Api.trackEvent('share_team_join', source: 'share_q', ref: widget.sid);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(r['already'] == true ? '你已在该小队' : '加入成功！')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
    if (mounted) setState(() => joining = false);
  }

  Future<void> _copyShareLink() async {
    final q = _q;
    final mod = (q['submodule'] ?? '').toString().isNotEmpty
        ? q['submodule'].toString()
        : moduleName((q['module'] ?? '').toString());
    Api.trackEvent('share_copy', source: 'share_q', ref: widget.sid);
    final text =
        '【$mod】我刚在考公助手做了一道题，你能做对吗？答完就能看到大家选了啥：$_kSite/#/pkgA/share/share-q?sid=${widget.sid}';
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('分享链接已复制')));
    }
    unawaited(Share.share(text).catchError((_) => ShareResult.unavailable));
  }

  void _goSimilar() {
    final q = _q;
    final params = Uri(queryParameters: {
      if ((q['module'] ?? '').toString().isNotEmpty) 'module': q['module'].toString(),
      if ((q['submodule'] ?? '').toString().isNotEmpty)
        'submodule': q['submodule'].toString(),
      'count': '10',
      'source': 'share',
    }).query;
    context.push('/practice?$params');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('题目分享')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : errMsg != null
              ? Center(child: Text(errMsg!, style: TextStyle(color: context.kg.t3)))
              : _body(),
    );
  }

  Widget _body() {
    final kg = context.kg;
    final q = _q;
    final options = Map<String, dynamic>.from(q['options'] as Map? ?? {});
    final keys = options.keys.toList()..sort();
    final fromName = (d!['from_name'] ?? '考友').toString();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration:
                    const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                child: Text(fromName.isEmpty ? '?' : fromName.substring(0, 1),
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: KgColors.brand)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$fromName 分享了一道题',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white)),
                    const SizedBox(height: 2),
                    Text(
                        revealed
                            ? '${answers.isNotEmpty ? answers.length : (d!['n_answered'] ?? 0)} 人已作答'
                            : '先作答，再看答案和大家的选择',
                        style:
                            const TextStyle(fontSize: 11, color: Colors.white70)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _tag(moduleName((q['module'] ?? '').toString()), KgColors.brand),
                    if ((q['submodule'] ?? '').toString().isNotEmpty) ...[
                      const SizedBox(width: 6),
                      _tag(q['submodule'].toString(), kg.t3),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Text((q['question'] ?? '').toString(),
                    style: const TextStyle(fontSize: 15, height: 1.7)),
                const SizedBox(height: 14),
                for (final k in keys) _option(k, options[k].toString()),
              ],
            ),
          ),
        ),
        if (revealed) ..._revealedWidgets(),
      ],
    );
  }

  List<Widget> _revealedWidgets() {
    final kg = context.kg;
    final q = _q;
    final answer = (q['answer'] ?? '').toString();
    final explanation = (q['explanation'] ?? '').toString();
    final ok = myResult == null || myResult!['correct'] == true;
    return [
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: ok ? kg.successBg : kg.errorBg,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          myResult == null
              ? '正确答案：$answer'
              : (myResult!['correct'] == true
                  ? '✅ 答对了！正确答案 $answer'
                  : '❌ 答错了，正确答案是 $answer，你选了 ${myResult!['picked']}'),
          style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: ok ? KgColors.success : KgColors.error),
        ),
      ),
      if (explanation.isNotEmpty) ...[
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('解析', style: TextStyle(fontSize: 12, color: kg.t3, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(explanation, style: const TextStyle(fontSize: 14, height: 1.7)),
              ],
            ),
          ),
        ),
      ],
      const SizedBox(height: 12),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('大家的作答（${answers.length} 人）',
                  style: TextStyle(
                      fontSize: 12, color: kg.t3, fontWeight: FontWeight.w600)),
              if (answers.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text('还没有人作答，把链接再发给几个考友吧',
                      style: TextStyle(fontSize: 12, color: kg.t4)),
                ),
              for (final a in answers) _answerRow(Map<String, dynamic>.from(a as Map)),
            ],
          ),
        ),
      ),
      if (_beatText.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: kg.warningBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(_beatText,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: KgColors.warning)),
        ),
      ],
      if (teamInvite != null) ...[
        const SizedBox(height: 12),
        _teamCta(),
      ],
      const SizedBox(height: 16),
      FilledButton(onPressed: _goSimilar, child: const Text('去刷同类题')),
      const SizedBox(height: 10),
      OutlinedButton(
          onPressed: _copyShareLink, child: const Text('复制分享链接，喊更多人来答')),
    ];
  }

  Widget _teamCta() {
    final kg = context.kg;
    final fromName = (d!['from_name'] ?? '考友').toString();
    final teamName = (teamInvite!['name'] ?? '').toString();
    return Card(
      color: teamJoined ? kg.successBg : null,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(teamJoined ? '🎉 已加入「$teamName」' : '和 $fromName 组队刷题',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(
                      teamJoined
                          ? '每天刷题就是打卡，队友都能看到你的进度'
                          : '加入小队「$teamName」，每天互相监督打卡',
                      style: TextStyle(fontSize: 11, color: kg.t3)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            teamJoined
                ? OutlinedButton(
                    onPressed: joinedTeamId > 0
                        ? () => context.push('/team/panel/$joinedTeamId')
                        : null,
                    child: const Text('看队友 ›'))
                : FilledButton(
                    onPressed: joining ? null : _joinTeam,
                    child: Text(joining ? '加入中…' : '一键加入')),
          ],
        ),
      ),
    );
  }

  Widget _answerRow(Map<String, dynamic> a) {
    final kg = context.kg;
    final ok = a['correct'] == true || a['correct'] == 1;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Expanded(
            child: Text((a['nickname'] ?? '').toString(),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13)),
          ),
          Text('选 ${a['picked']}', style: TextStyle(fontSize: 12, color: kg.t3)),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: ok ? kg.successBg : kg.errorBg,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(ok ? '对' : '错',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: ok ? KgColors.success : KgColors.error)),
          ),
        ],
      ),
    );
  }

  Widget _option(String k, String v) {
    final kg = context.kg;
    Color border = kg.border;
    Color? bg;
    if (!revealed) {
      if (picked == k) {
        border = KgColors.brand;
        bg = kg.brandBg;
      }
    } else {
      final answer = (_q['answer'] ?? '').toString();
      final myPick = myResult != null ? (myResult!['picked'] ?? '').toString() : '';
      if (k == answer) {
        border = KgColors.success;
        bg = kg.successBg;
      } else if (myPick.isNotEmpty && k == myPick) {
        border = KgColors.error;
        bg = kg.errorBg;
      }
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _pick(k),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            border: Border.all(color: border),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(k,
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w700, color: kg.t2)),
              const SizedBox(width: 12),
              Expanded(child: Text(v, style: const TextStyle(fontSize: 14, height: 1.6))),
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
          style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
    );
  }
}
