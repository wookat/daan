import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../theme.dart';

/// AI 问答（本期占位，下一批次接 /api/explain/stream 会话式问答）
class AskPage extends StatelessWidget {
  const AskPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI 问答')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(LucideIcons.messageCircle, size: 56, color: KgColors.brand),
              SizedBox(height: 16),
              Text('AI 问答 · 拍题讲解',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              SizedBox(height: 8),
              Text(
                '下一批次上线：拍照/输入题目，AI 按花生十三方法体系流式分步讲解，并可追问、存入错题本。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: KgColors.t3, height: 1.6),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
