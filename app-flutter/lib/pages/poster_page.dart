import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../core/api.dart';
import '../theme.dart';

const _kQuotes = [
  '上岸的路上，每一道题都算数。',
  '不怕慢，就怕站。今天也在进步。',
  '日拱一卒，功不唐捐。',
  '你刷过的每道题，都是登岸的台阶。',
  '与其焦虑，不如刷题。',
  '坚持打卡的人，运气不会太差。',
];

/// 打卡分享海报：连续天数/今日战报/倒计时/励志语录 + 保存/分享。复刻 pkgA/social/poster.vue。
class PosterPage extends StatefulWidget {
  const PosterPage({super.key});

  @override
  State<PosterPage> createState() => _PosterPageState();
}

class _PosterPageState extends State<PosterPage> {
  final _posterKey = GlobalKey();
  Map<String, dynamic>? summary;
  bool loading = true;
  bool saving = false;
  late final String quote;

  @override
  void initState() {
    super.initState();
    quote = _kQuotes[DateTime.now().day % _kQuotes.length];
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.checkinSummary();
      if (mounted) {
        setState(() {
          summary = d;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(Api.errMsg(e))));
      }
    }
  }

  Future<void> _share() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      final boundary = _posterKey.currentContext!.findRenderObject()!
          as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final dir = await getTemporaryDirectory();
      final file = File(
          '${dir.path}/checkin_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      await Share.shareXFiles([XFile(file.path)], text: '考公刷题打卡');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('生成海报失败：$e')));
      }
    }
    if (mounted) setState(() => saving = false);
  }

  static String _today() {
    final n = DateTime.now();
    const weeks = ['一', '二', '三', '四', '五', '六', '日'];
    return '${n.year} 年 ${n.month} 月 ${n.day} 日 · 星期${weeks[n.weekday - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final s = summary ?? {};
    final streak = (s['streak'] as num?)?.toInt() ?? 0;
    final todayN = (s['today_n'] as num?)?.toInt() ?? 0;
    final todayRight = (s['today_right'] as num?)?.toInt() ?? 0;
    final totalN = (s['total_n'] as num?)?.toInt() ?? 0;
    final daysLeft = (s['days_left'] as num?)?.toInt();
    final acc = todayN > 0 ? (todayRight * 100 / todayN).round() : 0;
    return Scaffold(
      backgroundColor: const Color(0xFF1B2540),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('打卡海报'),
      ),
      body: loading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.white))
          : Column(
              children: [
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: RepaintBoundary(
                        key: _posterKey,
                        child: Container(
                          width: 320,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF3B6FF5), Color(0xFF2F5CD8)],
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(LucideIcons.flame,
                                      color: Color(0xFFFF9F1C), size: 20),
                                  const SizedBox(width: 6),
                                  Text('连续打卡 $streak 天',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(_today(),
                                  style: const TextStyle(
                                      color: Colors.white70, fontSize: 12)),
                              if (daysLeft != null && daysLeft > 0) ...[
                                const SizedBox(height: 2),
                                Text('距考试还有 $daysLeft 天',
                                    style: const TextStyle(
                                        color: Color(0xFFFFD59E),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600)),
                              ],
                              const SizedBox(height: 18),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: .12),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Row(
                                  children: [
                                    _stat('$todayN', '今日刷题'),
                                    _stat('$acc%', '今日正确率'),
                                    _stat('$totalN', '累计刷题'),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),
                              Text('「$quote」',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 14,
                                      height: 1.7,
                                      fontWeight: FontWeight.w500)),
                              const SizedBox(height: 18),
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: const [
                                        Text('考公刷题',
                                            style: TextStyle(
                                                color: Colors.white,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w700)),
                                        Text('AI 驱动的行测申论备考助手',
                                            style: TextStyle(
                                                color: Colors.white70,
                                                fontSize: 10)),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: QrImageView(
                                      data: 'https://kaogong.zalize.com',
                                      size: 52,
                                      padding: EdgeInsets.zero,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: KgColors.brand,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed: saving ? null : _share,
                      icon: const Icon(LucideIcons.share2, size: 18),
                      label: Text(saving ? '生成中…' : '保存 / 分享海报'),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _stat(String v, String k) {
    return Expanded(
      child: Column(
        children: [
          Text(v,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(k,
              style: const TextStyle(color: Colors.white70, fontSize: 10)),
        ],
      ),
    );
  }
}
