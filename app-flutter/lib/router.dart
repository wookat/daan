import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'pages/ask_page.dart';
import 'pages/book_detail_page.dart';
import 'pages/calendar_page.dart';
import 'pages/exam_list_page.dart';
import 'pages/exam_page.dart';
import 'pages/exam_report_page.dart';
import 'pages/paper_entry_page.dart';
import 'pages/scan_sheet_page.dart';
import 'pages/book_page.dart';
import 'pages/discuss_page.dart';
import 'pages/favorites_page.dart';
import 'pages/poster_page.dart';
import 'pages/search_page.dart';
import 'pages/shenlun_detail_page.dart';
import 'pages/shenlun_page.dart';
import 'pages/shizheng_page.dart';
import 'pages/home_page.dart';
import 'pages/interview_history_page.dart';
import 'pages/interview_page.dart';
import 'pages/offline_page.dart';
import 'pages/pk_page.dart';
import 'pages/reminders_page.dart';
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
    GoRoute(path: '/exam/list', builder: (c, s) => const ExamListPage()),
    GoRoute(
      path: '/exam/run',
      builder: (c, s) => ExamPage(
        paperId: int.tryParse(s.uri.queryParameters['paper_id'] ?? ''),
        mini: s.uri.queryParameters['mini'] == '1',
      ),
    ),
    GoRoute(
      path: '/exam/report/:id',
      builder: (c, s) => ExamReportPage(attemptId: int.parse(s.pathParameters['id']!)),
    ),
    GoRoute(path: '/paper/entry', builder: (c, s) => const PaperEntryPage()),
    GoRoute(path: '/paper/scan', builder: (c, s) => const ScanSheetPage()),
    GoRoute(path: '/shizheng', builder: (c, s) => const ShizhengPage()),
    GoRoute(
      path: '/shenlun',
      builder: (c, s) =>
          ShenlunPage(initialTab: s.uri.queryParameters['tab'] ?? 'q'),
    ),
    GoRoute(
      path: '/shenlun/detail/:id',
      builder: (c, s) =>
          ShenlunDetailPage(qid: int.parse(s.pathParameters['id']!)),
    ),
    GoRoute(path: '/search', builder: (c, s) => const SearchPage()),
    GoRoute(path: '/favorites', builder: (c, s) => const FavoritesPage()),
    GoRoute(
      path: '/discuss',
      builder: (c, s) =>
          DiscussPage(qid: int.parse(s.uri.queryParameters['qid'] ?? '0')),
    ),
    GoRoute(
      path: '/interview',
      builder: (c, s) => InterviewPage(
        sessionId: int.tryParse(s.uri.queryParameters['session_id'] ?? ''),
      ),
    ),
    GoRoute(
        path: '/interview/history',
        builder: (c, s) => const InterviewHistoryPage()),
    GoRoute(
      path: '/pk',
      builder: (c, s) => PkPage(joinCode: s.uri.queryParameters['code']),
    ),
    GoRoute(path: '/reminders', builder: (c, s) => const RemindersPage()),
    GoRoute(path: '/offline', builder: (c, s) => const OfflinePage()),
    GoRoute(path: '/poster', builder: (c, s) => const PosterPage()),
    GoRoute(path: '/calendar', builder: (c, s) => const CalendarPage()),
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
