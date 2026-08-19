import 'package:flutter/material.dart';

import '../models/attendance_item.dart';
import '../models/auth_session.dart';
import '../services/work_service.dart';
import '../widgets/branded_loading.dart';

class AttendancePage extends StatefulWidget {
  const AttendancePage({
    required this.session,
    required this.workService,
    super.key,
  });

  final AuthSession session;
  final WorkService workService;

  @override
  State<AttendancePage> createState() => _AttendancePageState();
}

class _AttendancePageState extends State<AttendancePage> {
  late Future<List<AttendanceItem>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.workService.loadTodayAttendance(widget.session);
  }

  Future<void> _refresh() async {
    setState(() => _future = widget.workService.loadTodayAttendance(widget.session));
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chấm công'),
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
        child: FutureBuilder<List<AttendanceItem>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const BrandedLoading();
            }
            if (snapshot.hasError) {
              return _AttendanceMessage(message: snapshot.error.toString(), onRetry: _refresh);
            }

            final rows = snapshot.data ?? [];
            if (rows.isEmpty) {
              return _AttendanceMessage(
                message: 'Hôm nay chưa có dữ liệu chấm công.',
                onRetry: _refresh,
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: rows.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) => _AttendanceCard(item: rows[index]),
            );
          },
        ),
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({required this.item});

  final AttendanceItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.staffName ?? 'Nhân sự',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _TimeBlock(label: 'Vào', value: _time(item.checkIn))),
                const SizedBox(width: 10),
                Expanded(child: _TimeBlock(label: 'Ra', value: _time(item.checkOut))),
              ],
            ),
            if ((item.status ?? '').isNotEmpty || (item.note ?? '').isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                [item.status, item.note].where((value) => (value ?? '').isNotEmpty).join(' - '),
                style: const TextStyle(color: Color(0xff64748b)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _time(String? value) {
    if (value == null || value.isEmpty) return '--:--';
    return value.length >= 5 ? value.substring(0, 5) : value;
  }
}

class _TimeBlock extends StatelessWidget {
  const _TimeBlock({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xfff1f5f9),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(color: Color(0xff64748b))),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendanceMessage extends StatelessWidget {
  const _AttendanceMessage({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(message),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: onRetry, child: const Text('Tải lại')),
      ],
    );
  }
}
