import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'pages/ask_page.dart';
import 'pages/book_detail_page.dart';
import 'pages/book_page.dart';
import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/placeholder_page.dart';
import 'pages/practice_page.dart';
import 'pages/profile_page.dart';
import 'pages/stats_page.dart';

final router = GoRouter(
  initialLocation: '/home',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => _TabScaffold(shell: shell),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (c, s) => const HomePage())]),
        StatefulShellBranch(routes: [GoRoute(path: '/book', builder: (c, s) => const BookPage())]),
        StatefulShellBranch(routes: [GoRoute(path: '/ask', builder: (c, s) => const AskPage())]),
        StatefulShellBranch(routes: [GoRoute(path: '/stats', builder: (c, s) => const StatsPage())]),
        StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (c, s) => const ProfilePage())]),
      ],
    ),
    GoRoute(
      path: '/practice',
      builder: (c, s) => PracticePage(
        module: s.uri.queryParameters['module'],
        mode: s.uri.queryParameters['mode'] ?? 'normal',
      ),
    ),
    GoRoute(
      path: '/book/detail/:id',
      builder: (c, s) => BookDetailPage(mistakeId: int.parse(s.pathParameters['id']!)),
    ),
    GoRoute(path: '/login', builder: (c, s) => const LoginPage()),
    GoRoute(
      path: '/placeholder',
      builder: (c, s) => PlaceholderPage(
        title: s.uri.queryParameters['title'] ?? '敬请期待',
      ),
    ),
  ],
);

class _TabScaffold extends StatelessWidget {
  const _TabScaffold({required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        onDestinationSelected: (i) =>
            shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(LucideIcons.edit3), label: '刷题'),
          NavigationDestination(icon: Icon(LucideIcons.bookOpen), label: '错题本'),
          NavigationDestination(icon: Icon(LucideIcons.messageCircle), label: 'AI问答'),
          NavigationDestination(icon: Icon(LucideIcons.barChart3), label: '统计'),
          NavigationDestination(icon: Icon(LucideIcons.user), label: '我的'),
        ],
      ),
    );
  }
}
