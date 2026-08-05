import 'package:flutter/material.dart';

import '../theme.dart';

/// 统一空态：品牌色晕圈插画 + 标题 + 说明 + 主行动按钮。
/// 竞品（粉笔/华图）的空态都带插画与「去刷题」CTA，裸文字空态会让用户在此断流。
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.description,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String? description;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// 嵌在卡片内时使用更紧凑的留白与更小的插画。
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final kg = context.kg;
    final size = compact ? 56.0 : 84.0;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: compact ? 16 : 40, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  KgColors.brand.withValues(alpha: .14),
                  KgColors.brand.withValues(alpha: .04),
                ],
              ),
            ),
            child: Icon(icon, size: size * .42, color: KgColors.brand),
          ),
          SizedBox(height: compact ? 10 : 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: compact ? 14 : 15.5,
              fontWeight: FontWeight.w600,
              color: kg.t1,
            ),
          ),
          if (description != null) ...[
            const SizedBox(height: 6),
            Text(
              description!,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, height: 1.5, color: kg.t3),
            ),
          ],
          if (actionLabel != null && onAction != null) ...[
            SizedBox(height: compact ? 12 : 20),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: Size(compact ? 132 : 160, compact ? 38 : 44),
              ),
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
