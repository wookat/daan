import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';

/// 制定学习计划 3 步设置（考试信息/目标/每日时长）。复刻 home.vue 的 setup sheet。
/// 返回保存后的 profile；取消返回 null。
Future<Map<String, dynamic>?> showPlanSetupSheet(
  BuildContext context, {
  Map<String, dynamic>? profile,
}) {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18))),
    builder: (c) => _PlanSetupSheet(profile: profile),
  );
}

class _PlanSetupSheet extends StatefulWidget {
  const _PlanSetupSheet({this.profile});

  final Map<String, dynamic>? profile;

  @override
  State<_PlanSetupSheet> createState() => _PlanSetupSheetState();
}

class _PlanSetupSheetState extends State<_PlanSetupSheet> {
  int step = 1;
  bool busy = false;
  late String examType;
  late String examDate;
  late int targetScore;
  late int dailyMinutes;
  late String baseLevel;
  late final TextEditingController regionCtrl;

  @override
  void initState() {
    super.initState();
    final p = widget.profile ?? {};
    examType = (p['exam_type'] ?? '国考').toString();
    examDate = (p['exam_date'] ?? '').toString();
    targetScore = (p['target_score'] as num?)?.toInt() ?? 70;
    dailyMinutes = (p['daily_minutes'] as num?)?.toInt() ?? 60;
    baseLevel = (p['base_level'] ?? '零基础').toString();
    regionCtrl =
        TextEditingController(text: (p['target_region'] ?? '').toString());
  }

  @override
  void dispose() {
    regionCtrl.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    if (step == 1 && examDate.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请先选择考试日期')));
      return;
    }
    if (step < 3) {
      setState(() => step++);
      return;
    }
    if (busy) return;
    setState(() => busy = true);
    try {
      final profile = await Api.saveProfile({
        'exam_type': examType,
        'target_region': regionCtrl.text.trim(),
        'exam_date': examDate,
        'target_score': targetScore,
        'daily_minutes': dailyMinutes,
        'base_level': baseLevel,
      });
      if (mounted) Navigator.pop(context, profile);
    } catch (e) {
      setState(() => busy = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('保存失败：${Api.errMsg(e)}')));
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final init = DateTime.tryParse(examDate) ?? now.add(const Duration(days: 90));
    final d = await showDatePicker(
      context: context,
      initialDate: init.isBefore(now) ? now : init,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (d != null) {
      setState(() => examDate =
          '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: KgColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                '制定学习计划 · ${['考试信息', '目标', '每日时长'][step - 1]}（$step/3）',
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(LucideIcons.x, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (step == 1) ...[
            _row('考试类型',
                _chips(['国考', '省考', '事业单位', '其他'], examType,
                    (v) => setState(() => examType = v))),
            _row(
              '目标地区',
              TextField(
                controller: regionCtrl,
                maxLength: 20,
                decoration: const InputDecoration(
                  hintText: '如 广东 / 全国（选填）',
                  counterText: '',
                  isDense: true,
                  border: OutlineInputBorder(),
                ),
                style: const TextStyle(fontSize: 14),
              ),
            ),
            _row(
              '考试日期',
              OutlinedButton(
                onPressed: _pickDate,
                child: Text(examDate.isEmpty ? '选择日期 ›' : examDate),
              ),
            ),
          ] else if (step == 2) ...[
            _row('目标分',
                _chips(['60', '65', '70', '75', '80'], '$targetScore',
                    (v) => setState(() => targetScore = int.parse(v)),
                    suffix: '+')),
            _row('基础自评',
                _chips(['零基础', '有基础', '二战'], baseLevel,
                    (v) => setState(() => baseLevel = v))),
          ] else ...[
            _row('每日可用时长',
                _chips(['30', '60', '90', '120'], '$dailyMinutes',
                    (v) => setState(() => dailyMinutes = int.parse(v)),
                    suffix: ' 分钟'),
                sub: '决定每日任务量'),
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: KgColors.brand50,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$examType${regionCtrl.text.trim().isNotEmpty ? ' · ${regionCtrl.text.trim()}' : ''} · $examDate · 目标 $targetScore+ · $baseLevel · 每天 $dailyMinutes 分钟',
                style: const TextStyle(fontSize: 13, color: KgColors.brandDeep),
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : _next,
            child: Text(step < 3 ? '下一步' : (busy ? '生成中…' : '生成我的学习计划')),
          ),
          if (step > 1)
            Center(
              child: TextButton(
                onPressed: () => setState(() => step--),
                child: const Text('上一步',
                    style: TextStyle(color: KgColors.t3, fontSize: 13)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _row(String k, Widget v, {String? sub}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 96,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(k,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                if (sub != null)
                  Text(sub,
                      style: const TextStyle(
                          fontSize: 11, color: KgColors.t3)),
              ],
            ),
          ),
          Expanded(child: v),
        ],
      ),
    );
  }

  Widget _chips(List<String> opts, String cur, void Function(String) onPick,
      {String suffix = ''}) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final o in opts)
          GestureDetector(
            onTap: () => onPick(o),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: cur == o ? KgColors.brand : KgColors.fill,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$o$suffix',
                  style: TextStyle(
                      fontSize: 12,
                      color: cur == o ? Colors.white : KgColors.t2)),
            ),
          ),
      ],
    );
  }
}
