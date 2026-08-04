import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/api.dart';
import '../core/storage.dart';
import '../theme.dart';

/// 每题讨论区：评论/回复/点赞，热门/最新排序，登录门槛。复刻 pkgA/social/discuss.vue。
class DiscussPage extends StatefulWidget {
  const DiscussPage({super.key, required this.qid});

  final int qid;

  @override
  State<DiscussPage> createState() => _DiscussPageState();
}

class _DiscussPageState extends State<DiscussPage> {
  Map<String, dynamic>? question;
  List<dynamic> comments = [];
  String sort = 'hot';
  bool loading = true;
  bool posting = false;
  int? replyTo;
  String replyName = '';
  bool showAnswer = false;
  final _ctrl = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _loadQuestion();
    _loadComments();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _loadQuestion() async {
    try {
      final d = await Api.question(widget.qid);
      if (mounted) setState(() => question = d);
    } catch (_) {/* 题目加载失败仍可看评论 */}
  }

  Future<void> _loadComments() async {
    try {
      final d = await Api.comments(widget.qid, sort: sort);
      if (mounted) {
        setState(() {
          comments = d['items'] as List<dynamic>? ?? [];
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        _toast(Api.errMsg(e));
      }
    }
  }

  bool get loggedIn => Store.instance.token.isNotEmpty;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<bool> _requireLogin() async {
    if (loggedIn) return true;
    final go = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('需要登录'),
        content: const Text('登录后即可发表评论和点赞'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false), child: const Text('取消')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true), child: const Text('去登录')),
        ],
      ),
    );
    if (go == true && mounted) context.push('/login');
    return false;
  }

  Future<void> _post() async {
    final content = _ctrl.text.trim();
    if (content.isEmpty || posting) return;
    if (!await _requireLogin()) return;
    setState(() => posting = true);
    try {
      await Api.postComment(widget.qid, content, parentId: replyTo);
      _ctrl.clear();
      setState(() {
        replyTo = null;
        replyName = '';
      });
      _loadComments();
    } catch (e) {
      _toast(Api.errMsg(e));
    }
    if (mounted) setState(() => posting = false);
  }

  Future<void> _like(Map<String, dynamic> c) async {
    if (!await _requireLogin()) return;
    final liked = c['liked'] == true || c['liked'] == 1;
    setState(() {
      c['liked'] = !liked;
      c['likes'] = ((c['likes'] as num?)?.toInt() ?? 0) + (liked ? -1 : 1);
    });
    try {
      final d = await Api.likeComment((c['id'] as num).toInt());
      if (mounted && d['likes'] != null) {
        setState(() {
          c['likes'] = (d['likes'] as num).toInt();
          if (d['liked'] != null) c['liked'] = d['liked'];
        });
      }
    } catch (e) {
      setState(() {
        c['liked'] = liked;
        c['likes'] = ((c['likes'] as num?)?.toInt() ?? 0) + (liked ? 1 : -1);
      });
      _toast(Api.errMsg(e));
    }
  }

  void _reply(Map<String, dynamic> c) {
    setState(() {
      replyTo = (c['id'] as num).toInt();
      replyName = (c['nickname'] ?? '匿名').toString();
    });
    _focus.requestFocus();
  }

  static String _fmtTime(num? ts) {
    final t = DateTime.fromMillisecondsSinceEpoch(((ts ?? 0) * 1000).toInt());
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    if (diff.inDays < 30) return '${diff.inDays} 天前';
    return '${t.year}-${t.month}-${t.day}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('讨论区')),
      body: Column(
        children: [
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (question != null) _qCard(),
                      Row(
                        children: [
                          Text('${comments.length} 条讨论',
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600)),
                          const Spacer(),
                          _sortBtn('hot', '热门'),
                          const SizedBox(width: 8),
                          _sortBtn('new', '最新'),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (comments.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 40),
                          child: Center(
                            child: Text('还没有讨论，来发第一条思路吧',
                                style: TextStyle(
                                    fontSize: 13, color: KgColors.t3)),
                          ),
                        )
                      else
                        for (final c in comments)
                          _commentItem(Map<String, dynamic>.from(c)),
                    ],
                  ),
          ),
          _inputBar(),
        ],
      ),
    );
  }

  Widget _qCard() {
    final q = question!;
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((q['question'] ?? '').toString(),
                maxLines: showAnswer ? null : 3,
                overflow: showAnswer ? null : TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, height: 1.65)),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => setState(() => showAnswer = !showAnswer),
              child: Text(showAnswer ? '收起 ▲' : '展开题目与答案 ▼',
                  style: const TextStyle(
                      fontSize: 12, color: KgColors.brand)),
            ),
            if (showAnswer) ...[
              const SizedBox(height: 6),
              if (q['options'] is Map)
                for (final e in (q['options'] as Map).entries)
                  Text('${e.key}. ${e.value}',
                      style: TextStyle(
                          fontSize: 13,
                          height: 1.6,
                          color: '${e.key}' == '${q['answer']}'
                              ? KgColors.success
                              : KgColors.t2)),
              Text('答案：${q['answer'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 12.5,
                      color: KgColors.success,
                      fontWeight: FontWeight.w600)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _sortBtn(String k, String label) {
    final on = sort == k;
    return GestureDetector(
      onTap: () {
        setState(() => sort = k);
        _loadComments();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: on ? KgColors.brand50 : KgColors.fill,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 12,
                color: on ? KgColors.brand : KgColors.t3,
                fontWeight: on ? FontWeight.w600 : FontWeight.w400)),
      ),
    );
  }

  Widget _commentItem(Map<String, dynamic> c, {bool isReply = false}) {
    final name = (c['nickname'] ?? '匿名').toString();
    final replies = c['replies'] as List<dynamic>? ?? [];
    final liked = c['liked'] == true || c['liked'] == 1;
    return Padding(
      padding: EdgeInsets.only(bottom: isReply ? 8 : 14, left: isReply ? 36 : 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: isReply ? 12 : 15,
            backgroundColor: KgColors.brand50,
            child: Text(name.characters.first,
                style: TextStyle(
                    fontSize: isReply ? 10 : 12, color: KgColors.brand)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(name,
                        style: const TextStyle(
                            fontSize: 12.5, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 8),
                    Text(_fmtTime(c['created_at'] as num?),
                        style: const TextStyle(
                            fontSize: 11, color: KgColors.t3)),
                  ],
                ),
                const SizedBox(height: 3),
                Text((c['content'] ?? '').toString(),
                    style: const TextStyle(fontSize: 13.5, height: 1.6)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    InkWell(
                      onTap: () => _like(c),
                      child: Row(
                        children: [
                          Icon(LucideIcons.thumbsUp,
                              size: 13,
                              color:
                                  liked ? KgColors.brand : KgColors.t3),
                          const SizedBox(width: 3),
                          Text('${c['likes'] ?? 0}',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: liked
                                      ? KgColors.brand
                                      : KgColors.t3)),
                        ],
                      ),
                    ),
                    if (!isReply) ...[
                      const SizedBox(width: 20),
                      InkWell(
                        onTap: () => _reply(c),
                        child: const Text('回复',
                            style: TextStyle(
                                fontSize: 12, color: KgColors.t3)),
                      ),
                    ],
                  ],
                ),
                if (replies.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  for (final r in replies)
                    _commentItem(Map<String, dynamic>.from(r), isReply: true),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _inputBar() {
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color ?? Colors.white,
          border: const Border(top: BorderSide(color: KgColors.fill)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (replyTo != null)
              Row(
                children: [
                  Text('回复 @$replyName',
                      style: const TextStyle(
                          fontSize: 12, color: KgColors.brand)),
                  const Spacer(),
                  InkWell(
                    onTap: () => setState(() {
                      replyTo = null;
                      replyName = '';
                    }),
                    child: const Icon(LucideIcons.x,
                        size: 14, color: KgColors.t3),
                  ),
                ],
              ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ctrl,
                    focusNode: _focus,
                    maxLength: 500,
                    decoration: InputDecoration(
                      hintText: loggedIn ? '写下你的思路…' : '登录后参与讨论',
                      hintStyle:
                          const TextStyle(fontSize: 13, color: KgColors.t4),
                      counterText: '',
                      isDense: true,
                      filled: true,
                      fillColor: KgColors.fill,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(999),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 9),
                    ),
                    style: const TextStyle(fontSize: 14),
                    onSubmitted: (_) => _post(),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 38),
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                  ),
                  onPressed: posting ? null : _post,
                  child: const Text('发送'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
