import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

const _kSite = 'https://kaogong.zalize.com';

/// PK 公开战绩落地页（pk-result?rid=code）。复刻 pkgA/share/pk-result.vue。
class PkResultPage extends StatefulWidget {
  const PkResultPage({super.key, required this.code});

  final String code;

  @override
  State<PkResultPage> createState() => _PkResultPageState();
}

class _PkResultPageState extends State<PkResultPage> {
  Map<String, dynamic>? d;
  bool loading = true;
  String? errMsg;

  @override
  void initState() {
    super.initState();
    Api.trackEvent('pk_result_open', source: 'pk_share', ref: widget.code);
    _load();
  }

  Future<void> _load() async {
    if (widget.code.isEmpty) {
      setState(() {
        loading = false;
        errMsg = '战绩链接无效';
      });
      return;
    }
    try {
      final r = await Api.pkResult(widget.code);
      setState(() {
        d = r;
        loading = false;
      });
    } catch (e) {
      setState(() {
        loading = false;
        errMsg = Api.errMsg(e);
      });
    }
  }

  Map<String, dynamic> _side(String role) =>
      Map<String, dynamic>.from(d![role] as Map);

  // 同名对局用角色区分（对齐轮24：服务端返回 role）
  String _name(String role) {
    final c = _side('creator');
    final o = _side('opponent');
    final sameName = c['name'] == o['name'];
    final n = (_side(role)['name'] ?? '').toString();
    if (!sameName) return n;
    return role == 'creator' ? '$n（发起方）' : '$n（应战方）';
  }

  String _fmtMs(dynamic ms) =>
      ms is num ? '${(ms / 1000).toStringAsFixed(1)}s' : '—';

  String get _resultText {
    final w = (d!['winner'] ?? '').toString();
    if (w == 'draw' || w.isEmpty) return '平局';
    return '${_name(w)} 获胜';
  }

  Future<void> _copyLink() async {
    Api.trackEvent('pk_result_copy', source: 'pk_share', ref: widget.code);
    final c = _side('creator');
    final o = _side('opponent');
    final text =
        '【答题PK战绩】${_name('creator')} ${c['score']} : ${o['score']} ${_name('opponent')}，不服来战：$_kSite/#/pkgA/share/pk-result?rid=${widget.code}';
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('战绩链接已复制，发给考友吧')));
    }
    Share.share(text).catchError((_) => ShareResult.unavailable);
  }

  void _challenge() {
    Api.trackEvent('pk_result_challenge', source: 'pk_share', ref: widget.code);
    context.push('/pk');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('PK 战绩')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : errMsg != null
              ? Center(
                  child: Text(errMsg!, style: TextStyle(color: context.kg.t3)))
              : _body(),
    );
  }

  Widget _body() {
    final kg = context.kg;
    final nQ = (d!['n_questions'] as num?)?.toInt() ?? 0;
    final winner = (d!['winner'] ?? '').toString();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: kBrandGradient,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('⚔️ 答题 PK 战绩',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
              const SizedBox(height: 6),
              Text(
                  '${moduleName((d!['module'] ?? '').toString())} · 同组 $nQ 题 · 挑战码 ${d!['code']}',
                  style: const TextStyle(fontSize: 12, color: Colors.white70)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _player('creator', winner == 'creator', nQ)),
                Column(
                  children: [
                    const SizedBox(height: 26),
                    Text('VS',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: kg.t4)),
                    const SizedBox(height: 6),
                    SizedBox(
                      width: 72,
                      child: Text(_resultText,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 10, color: kg.t3)),
                    ),
                  ],
                ),
                Expanded(child: _player('opponent', winner == 'opponent', nQ)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('不服来战？',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('同组 10 题拼手速，答对 +80 分，越快加成越高',
                    style: TextStyle(fontSize: 12, color: kg.t3)),
                const SizedBox(height: 14),
                FilledButton(
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(44)),
                    onPressed: _challenge,
                    child: const Text('发起 PK 挑战')),
                const SizedBox(height: 8),
                OutlinedButton(
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(44)),
                    onPressed: _copyLink,
                    child: const Text('复制 / 分享战绩链接')),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _player(String role, bool win, int nQ) {
    final kg = context.kg;
    final p = _side(role);
    final name = _name(role);
    return Column(
      children: [
        if (win)
          const Text('👑', style: TextStyle(fontSize: 18))
        else
          const SizedBox(height: 24),
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: role == 'creator' ? kg.brandBg : kg.warningBg,
            border: win ? Border.all(color: const Color(0xFFFBBF24), width: 2) : null,
          ),
          child: Text(name.isEmpty ? '?' : name.substring(0, 1),
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color:
                      role == 'creator' ? KgColors.brand : KgColors.warning)),
        ),
        const SizedBox(height: 6),
        Text(name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12)),
        Text('${p['score'] ?? 0}',
            style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: win ? KgColors.brand : null)),
        Text('答对 ${p['correct'] ?? 0}/$nQ · ${_fmtMs(p['time_ms'])}',
            style: TextStyle(fontSize: 10, color: kg.t3)),
      ],
    );
  }
}
