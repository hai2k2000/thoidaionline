import 'package:flutter/material.dart';

import '../models/auth_session.dart';
import '../services/work_service.dart';
import 'attendance_page.dart';
import 'dashboard_page.dart';
import 'profile_page.dart';
import 'tasks_page.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    required this.session,
    required this.onLogout,
    super.key,
  });

  final AuthSession session;
  final Future<void> Function() onLogout;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final _workService = WorkService();
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardPage(session: widget.session, workService: _workService),
      TasksPage(session: widget.session, workService: _workService),
      AttendancePage(session: widget.session, workService: _workService),
      ProfilePage(session: widget.session, onLogout: widget.onLogout),
    ];

    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _index != 0) {
          setState(() => _index = 0);
        }
      },
      child: Scaffold(
        body: IndexedStack(index: _index, children: pages),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (value) => setState(() => _index = value),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Tổng quan',
            ),
            NavigationDestination(
              icon: Icon(Icons.task_alt_outlined),
              selectedIcon: Icon(Icons.task_alt),
              label: 'Công việc',
            ),
            NavigationDestination(
              icon: Icon(Icons.event_available_outlined),
              selectedIcon: Icon(Icons.event_available),
              label: 'Chấm công',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Tài khoản',
            ),
          ],
        ),
      ),
    );
  }
}
