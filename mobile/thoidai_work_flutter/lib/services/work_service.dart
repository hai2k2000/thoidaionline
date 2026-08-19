import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

import '../models/attendance_item.dart';
import '../models/auth_session.dart';
import '../models/dashboard_stats.dart';
import '../models/task_item.dart';

class WorkService {
  SupabaseClient get _client => Supabase.instance.client;

  Future<List<TaskItem>> loadTasks(AuthSession session) async {
    final rows = await _client
        .from('tasks')
        .select(
          'id,assignee_id,title,status,progress_percent,due_date,'
          'attachment_url,'
          'departments(name),owner:staff_users!tasks_owner_id_fkey(full_name),'
          'task_assignees(user_id,assignment_role,staff_users(full_name))',
        )
        .order('created_at', ascending: false)
        .limit(300);

    final tasks = (rows as List<dynamic>)
        .map((row) => TaskItem.fromJson(row as Map<String, dynamic>))
        .toList();

    if (session.canManageAllTasks) return tasks;

    return tasks.where((task) {
      return task.assigneeId == session.id || task.assigneeIds.contains(session.id);
    }).toList();
  }

  Future<String> uploadTaskAttachment({
    required String taskId,
    required Uint8List bytes,
    required String fileName,
  }) async {
    final normalizedName = fileName.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final path = '$taskId/${DateTime.now().millisecondsSinceEpoch}-$normalizedName';

    await _client.storage.from('task-files').uploadBinary(
          path,
          bytes,
          fileOptions: const FileOptions(upsert: true),
        );

    final publicUrl = _client.storage.from('task-files').getPublicUrl(path);
    await _client.from('tasks').update({'attachment_url': publicUrl}).eq('id', taskId);
    return publicUrl;
  }

  Future<List<AttendanceItem>> loadTodayAttendance(AuthSession session) async {
    final today = _dateText(DateTime.now());
    final baseQuery = _client
        .from('attendance_logs')
        .select('id,work_date,check_in,check_out,note,status,staff_users(full_name)')
        .eq('work_date', today);

    final query = session.canManageAllTasks ? baseQuery : baseQuery.eq('user_id', session.id);

    final rows = await query
        .order('check_in', ascending: true, nullsFirst: false)
        .limit(500);
    return (rows as List<dynamic>)
        .map((row) => AttendanceItem.fromJson(row as Map<String, dynamic>))
        .toList();
  }

  Future<DashboardStats> loadDashboard(AuthSession session) async {
    final today = _dateText(DateTime.now());
    final tasks = await loadTasks(session);
    final hrRows = await _safeRows(
      () => _client.from('employee_profiles').select('id').limit(10000),
    );
    final assetRows = await _safeRows(
      () => _client.from('assets').select('id').eq('status', 'in_use').limit(10000),
    );
    final docRows = await _safeRows(
      () => _client
          .from('official_documents')
          .select('id')
          .lte('processing_deadline', today)
          .neq('status', 'done')
          .limit(10000),
    );

    return DashboardStats(
      totalTasks: tasks.length,
      myTasks: tasks.where((task) => task.assigneeId == session.id).length,
      overdueTasks: tasks.where((task) => task.isOverdue).length,
      hrProfiles: hrRows.length,
      assetsInUse: assetRows.length,
      documentsOverdue: docRows.length,
    );
  }

  String _dateText(DateTime date) {
    return '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
  }

  Future<List<dynamic>> _safeRows(Future<dynamic> Function() loader) async {
    try {
      final rows = await loader();
      return rows as List<dynamic>;
    } on PostgrestException {
      return const [];
    }
  }
}
