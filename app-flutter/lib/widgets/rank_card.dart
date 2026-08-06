import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../theme.dart';

/// 模考成绩排名卡：击败百分比 + 排名/平均分 + 分数分布直方图。复刻 components/rank-card。
class RankCard extends StatefulWidget {
  const RankCard({super.key, required this.attemptId});

  final int attemptId;

  @override
  State<RankCard> createState() => _RankCardState();
}

class _RankCardState extends State<RankCard> {
  Map<String, dynamic>? data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await Api.examRank(widget.attemptId);
      if (mounted) setState(() => data = d);
    } catch (_) {
      // 非关键路径：加载失败不展示
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = data;
    if (d == null) return const SizedBox.shrink();
    final dist = (d['distribution'] as List<dynamic>? ?? [])
        .map((e) => (e as num).toInt())
        .toList();
    final myBucket = ((d['my_bucket'] ?? 0) as num).toInt();
    final maxN = dist.isEmpty ? 1 : math.max(dist.reduce(math.max), 1);
    final smallSample = d['small_sample'] == true;
    final tinySample = ((d['total'] ?? 0) as num).toInt() < 10;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('全卷排名', style: TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                if (smallSample)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: KgColors.warningBg,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('样本 ${d['total']} 人',
                        style: const TextStyle(fontSize: 11, color: KgColors.warning)),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (tinySample)
                  Expanded(
                    child: Text('参与人数仍较少（${d['total']} 人），暂不计算击败比例',
                        style: const TextStyle(fontSize: 12, color: KgColors.t3)),
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${d['beaten_pct']}%',
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w700,
                              color: KgColors.brand,
                              height: 1.1)),
                      Text(smallSample ? '已击败（样本 ${d['total']} 人）' : '已击败考生',
                          style: const TextStyle(fontSize: 11, color: KgColors.t3)),
                    ],
                  ),
                const SizedBox(width: 28),
                _kv('排名', '${d['rank']}', suffix: '/${d['total']}'),
                const SizedBox(width: 28),
                _kv('平均分', '${d['avg']}'),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 72,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (var i = 0; i < dist.length; i++) ...[
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Container(
                            height: dist[i] > 0 ? 8 + 46.0 * dist[i] / maxN : 2,
                            decoration: BoxDecoration(
                              color: i == myBucket ? KgColors.brand : KgColors.fill,
                              borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(3)),
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text('${i * 10}',
                              style: const TextStyle(fontSize: 8, color: KgColors.t4)),
                        ],
                      ),
                    ),
                    if (i < dist.length - 1) const SizedBox(width: 3),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 6),
            Text('你在 ${myBucket * 10}-${myBucket * 10 + 10} 分段（蓝色）',
                style: const TextStyle(fontSize: 11, color: KgColors.t4)),
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v, {String? suffix}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(k, style: const TextStyle(fontSize: 11, color: KgColors.t4)),
        const SizedBox(height: 2),
        Text.rich(TextSpan(
          text: v,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          children: [
            if (suffix != null)
              TextSpan(
                  text: suffix,
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w400,
                      color: KgColors.t4)),
          ],
        )),
      ],
    );
  }
}
