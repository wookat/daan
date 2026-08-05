import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/offline.dart';
import 'core/providers.dart';
import 'core/reminders.dart';
import 'core/storage.dart';
import 'router.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Store.init();
  unawaited(Reminders.reschedule());
  unawaited(Offline.flushQueue());
  // 网络恢复后自动同步离线作答队列
  Connectivity().onConnectivityChanged.listen((results) {
    if (results.any((r) => r != ConnectivityResult.none)) {
      unawaited(Offline.flushQueue());
    }
  });
  runApp(const ProviderScope(child: KgApp()));
}

class KgApp extends ConsumerWidget {
  const KgApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    return MaterialApp.router(
      title: '考公助手',
      debugShowCheckedModeBanner: false,
      theme: kgTheme(Brightness.light),
      darkTheme: kgTheme(Brightness.dark),
      themeMode: mode,
      routerConfig: router,
    );
  }
}
