import 'package:flutter/material.dart';

import '../models/auth_session.dart';
import '../models/dashboard_stats.dart';
import '../services/work_service.dart';
import '../widgets/branded_loading.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({
    required this.session,
    required this.workService,
    super.key,
  });

  final AuthSession session;
  final WorkService workService;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late Future<DashboardStats> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.workService.loadDashboard(widget.session);
  }

  Future<void> _refresh() async {
    setState(() => _future = widget.workService.loadDashboard(widget.session));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tổng quan'),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<DashboardStats>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const BrandedLoading();
            }
            if (snapshot.hasError) {
              return _ErrorView(message: snapshot.error.toString(), onRetry: _refresh);
            }

            final stats = snapshot.data!;
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Xin chào, ${widget.session.fullName}',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.session.roleName ?? 'Thành viên',
                  style: const TextStyle(color: Color(0xff64748b)),
                ),
                const SizedBox(height: 18),
                _StatsGrid(stats: stats),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final DashboardStats stats;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Công việc', stats.totalTasks, Icons.assignment_outlined),
      ('Việc của tôi', stats.myTasks, Icons.person_pin_circle_outlined),
      ('Quá hạn', stats.overdueTasks, Icons.warning_amber_outlined),
      ('Nhân sự', stats.hrProfiles, Icons.badge_outlined),
      ('Tài sản đang dùng', stats.assetsInUse, Icons.inventory_2_outlined),
      ('Công văn quá hạn', stats.documentsOverdue, Icons.mark_email_unread_outlined),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 520 ? 3 : 2;
        return GridView.builder(
          itemCount: items.length,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.25,
          ),
          itemBuilder: (context, index) {
            final item = items[index];
            return Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(item.$3, color: Theme.of(context).colorScheme.primary),
                    const Spacer(),
                    Text(
                      '${item.$2}',
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      item.$1,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Color(0xff64748b)),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(message),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
      ],
    );
  }
}
