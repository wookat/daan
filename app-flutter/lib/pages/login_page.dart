import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api.dart';
import '../core/providers.dart';
import '../theme.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _nickname = TextEditingController();
  bool isRegister = false;
  bool busy = false;
  String? error;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    _nickname.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final phone = _phone.text.trim();
    final pwd = _password.text;
    if (!RegExp(r'^1\d{10}$').hasMatch(phone)) {
      setState(() => error = '请输入 11 位手机号');
      return;
    }
    if (pwd.length < 6) {
      setState(() => error = '密码至少 6 位');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final auth = ref.read(authProvider.notifier);
      if (isRegister) {
        await auth.register(phone, pwd, nickname: _nickname.text.trim());
      } else {
        await auth.login(phone, pwd);
      }
      if (mounted) context.pop();
    } catch (e) {
      setState(() => error = Api.errMsg(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(isRegister ? '注册' : '登录')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 12),
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: kBrandGradient,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Text('考',
                style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            maxLength: 11,
            decoration: const InputDecoration(
              labelText: '手机号',
              counterText: '',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: '密码（至少 6 位）',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _submit(),
          ),
          if (isRegister) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _nickname,
              maxLength: 20,
              decoration: const InputDecoration(
                labelText: '昵称（选填）',
                counterText: '',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => _submit(),
            ),
          ],
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!, style: const TextStyle(color: KgColors.error, fontSize: 13)),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: busy ? null : _submit,
            child: busy
                ? const SizedBox(
                    width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(isRegister ? '注册并登录' : '登录'),
          ),
          const SizedBox(height: 16),
          Center(
            child: TextButton(
              onPressed: () => setState(() {
                isRegister = !isRegister;
                error = null;
              }),
              child: Text(isRegister ? '已有账号？去登录' : '没有账号？去注册',
                  style: const TextStyle(color: KgColors.brand)),
            ),
          ),
          const SizedBox(height: 8),
          const Center(
            child: Text('登录后本机做题记录会自动合并到账号',
                style: TextStyle(fontSize: 12, color: KgColors.t4)),
          ),
        ],
      ),
    );
  }
}
