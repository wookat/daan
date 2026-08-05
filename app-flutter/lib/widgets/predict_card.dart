import 'package:flutter/material.dart';

import '../core/api.dart';
import '../theme.dart';

/// 能力预测分卡：冷启动进度 / 预测分 + 周趋势 + 五模块分项，
/// 对照 frontend-uni/src/components/predict-card/predict-card.vue。
class PredictCard extends StatefulWidget {
  const PredictCard({super.key});

  @override
  State<PredictCard> createState() => _PredictCardState();
}

class _PredictCardState extends State<PredictCard> {
  Map<String, dynamic>? data;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.predict();
      if (mounted) setState(() => data = d);
    } catch (_) {/* 非关键路径 */}
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('能力预测分',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              for (final w in const [.4, .7, .5]) ...[
                FractionallySizedBox(
                  widthFactor: w,
                  child: Container(
                    height: 14,
                    decoration: BoxDecoration(
                      color: KgColors.fill,
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      );
    }
    final d = data;
    if (d == null) return const SizedBox.shrink();
    if (d['status'] == 'cold') return _coldView(d);
    return _scoreView(d);
  }

  Widget _coldView(Map<String, dynamic> d) {
    final n = (d['n'] as num?)?.toInt() ?? 0;
    final need = (d['need'] as num?)?.toInt() ?? 30;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('能力预测分',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('数据积累中',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('再作答 ${(need - n).clamp(0, need)} 题即可解锁预测分（$n/$need）',
                style: const TextStyle(fontSize: 12, color: KgColors.t2)),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: (n / need).clamp(0, 1),
                minHeight: 6,
                backgroundColor: KgColors.fill,
                valueColor: const AlwaysStoppedAnimation(KgColors.brand),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _scoreView(Map<String, dynamic> d) {
    final history = d['history'] as List<dynamic>? ?? [];
    final modules = d['modules'] as List<dynamic>? ?? [];
    final deltaWeek = d['delta_week'] as num?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('能力预测分',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: KgColors.fill,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text('置信度 ${d['confidence'] ?? ''}',
                      style:
                          const TextStyle(fontSize: 11, color: KgColors.t2)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text.rich(TextSpan(
                  text: '${d['score'] ?? 0}',
                  style: const TextStyle(
                      fontSize: 38,
                      fontWeight: FontWeight.w800,
                      color: KgColors.brand,
                      height: 1),
                  children: const [
                    TextSpan(
                        text: ' 分',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: KgColors.t2)),
                  ],
                )),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (deltaWeek != null)
                        Text(
                          '${deltaWeek >= 0 ? '↑ 较上周+' : '↓ 较上周'}$deltaWeek',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: deltaWeek >= 0
                                  ? KgColors.success
                                  : KgColors.error),
                        ),
                      Text(
                        '基于 ${d['n'] ?? 0} 题作答${(d['n_exam'] as num?) != null && (d['n_exam'] as num) > 0 ? ' · ${d['n_exam']} 次模考' : ''}',
                        style:
                            const TextStyle(fontSize: 11, color: KgColors.t3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (history.length > 1) ...[
              const SizedBox(height: 14),
              SizedBox(height: 90, child: _chart(history)),
            ],
            if (modules.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final m in modules) _modRow(Map<String, dynamic>.from(m)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _chart(List<dynamic> history) {
    final scores = history.map((h) => (h['score'] as num).toDouble()).toList();
    final minS = scores.reduce((a, b) => a < b ? a : b);
    final maxS = scores.reduce((a, b) => a > b ? a : b);
    double barH(double s) =>
        maxS == minS ? .6 : .25 + (s - minS) / (maxS - minS) * .7;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var i = 0; i < history.length; i++)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('${scores[i].round()}',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: i == history.length - 1
                              ? FontWeight.w700
                              : FontWeight.w400,
                          color: i == history.length - 1
                              ? KgColors.brand
                              : KgColors.t3)),
                  const SizedBox(height: 2),
                  FractionallySizedBox(
                    widthFactor: .4,
                    child: Container(
                      height: 52 * barH(scores[i]),
                      decoration: BoxDecoration(
                        color: i == history.length - 1
                            ? KgColors.brand
                            : KgColors.brand100,
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(3)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text((history[i]['label'] ?? '').toString(),
                      style:
                          const TextStyle(fontSize: 10, color: KgColors.t3)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _modRow(Map<String, dynamic> m) {
    final score = (m['score'] as num?)?.toDouble() ?? 0;
    final max = (m['max'] as num?)?.toDouble() ?? 1;
    final trend = (m['trend'] as num?)?.toDouble() ?? 0;
    final (tArrow, tColor) = trend > 0.03
        ? ('↑', KgColors.success)
        : trend < -0.03
            ? ('↓', KgColors.error)
            : ('—', KgColors.t4);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text((m['name'] ?? '').toString(),
                style: const TextStyle(fontSize: 12, color: KgColors.t2)),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: (score / max).clamp(0, 1),
                minHeight: 7,
                backgroundColor: KgColors.fill,
                valueColor: const AlwaysStoppedAnimation(KgColors.brand),
              ),
            ),
          ),
          SizedBox(
            width: 52,
            child: Text.rich(
              TextSpan(
                text: '${score == score.roundToDouble() ? score.toInt() : score}',
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                children: [
                  TextSpan(
                      text: '/${max == max.roundToDouble() ? max.toInt() : max}',
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w400,
                          color: KgColors.t3)),
                ],
              ),
              textAlign: TextAlign.right,
            ),
          ),
          SizedBox(
            width: 18,
            child: Text(tArrow,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: tColor)),
          ),
        ],
      ),
    );
  }
}
