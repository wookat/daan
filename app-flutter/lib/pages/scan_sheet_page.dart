import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../theme.dart';
import 'paper_entry_page.dart' show ResultCard;

/// 扫描答题卡：拍照/相册上传 → 后端识别涂卡 → 判分结果。
class ScanSheetPage extends StatefulWidget {
  const ScanSheetPage({super.key});

  @override
  State<ScanSheetPage> createState() => _ScanSheetPageState();
}

class _ScanSheetPageState extends State<ScanSheetPage> {
  final _picker = ImagePicker();
  String? imagePath;
  bool uploading = false;
  String? error;
  Map<String, dynamic>? result;

  Future<void> _pick(ImageSource src) async {
    final f = await _picker.pickImage(source: src, maxWidth: 2400, imageQuality: 92);
    if (f == null) return;
    setState(() {
      imagePath = f.path;
      result = null;
      error = null;
    });
    await _upload(f.path);
  }

  Future<void> _upload(String path) async {
    setState(() {
      uploading = true;
      error = null;
    });
    try {
      final d = await Api.scanSheet(path);
      setState(() {
        result = d;
        uploading = false;
      });
    } catch (e) {
      setState(() {
        uploading = false;
        error = Api.errMsg(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('扫描答题卡')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _uploadCard(),
          if (uploading) ...[
            const SizedBox(height: 12),
            const Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                        width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 12),
                    Text('正在识别涂卡…', style: TextStyle(color: KgColors.t3, fontSize: 13)),
                  ],
                ),
              ),
            ),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: KgColors.errorBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('识别失败：$error',
                  style: const TextStyle(fontSize: 13, color: KgColors.error)),
            ),
          ],
          if (result != null) ...[
            const SizedBox(height: 12),
            _metaCard(),
            const SizedBox(height: 12),
            ResultCard(result: result!),
          ],
        ],
      ),
    );
  }

  Widget _uploadCard() {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 28, 16, 16),
        child: Column(
          children: [
            Container(
              width: 180,
              height: 240,
              decoration: BoxDecoration(
                color: KgColors.brand50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: const Color(0xFF8FB2F9),
                  width: 2,
                  strokeAlign: BorderSide.strokeAlignInside,
                ),
              ),
              clipBehavior: Clip.antiAlias,
              child: imagePath != null
                  ? Image.file(File(imagePath!), fit: BoxFit.cover)
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(LucideIcons.camera, size: 34, color: KgColors.brand),
                        SizedBox(height: 10),
                        Text('对准答题卡拍摄',
                            style: TextStyle(
                                fontSize: 13,
                                color: KgColors.brand,
                                fontWeight: FontWeight.w600)),
                        SizedBox(height: 4),
                        Text('自动识别涂卡 · 支持相册导入',
                            style: TextStyle(fontSize: 11, color: KgColors.t3)),
                      ],
                    ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                    onPressed: uploading ? null : () => _pick(ImageSource.gallery),
                    child: const Text('从相册选择'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(42)),
                    onPressed: uploading ? null : () => _pick(ImageSource.camera),
                    child: const Text('拍摄'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _metaCard() {
    final r = result!;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(LucideIcons.scanLine, size: 18, color: KgColors.brand),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '卷码 ${r['code'] ?? '-'}${r['page'] != null ? ' · 第 ${r['page']} 页' : ''} · ${r['title'] ?? ''}',
                style: const TextStyle(fontSize: 13, color: KgColors.t2),
              ),
            ),
            Container(
              height: 20,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: KgColors.successBg,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text('已识别 ${r['answered'] ?? 0}/${r['total'] ?? 0}',
                  style: const TextStyle(fontSize: 11, color: KgColors.success)),
            ),
          ],
        ),
      ),
    );
  }
}
