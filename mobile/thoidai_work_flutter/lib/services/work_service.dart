import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../app_config.dart';
import '../models/attendance_item.dart';
import '../models/auth_session.dart';
import '../models/dashboard_stats.dart';
import '../models/task_item.dart';

class WorkService {
  static const _secureStorage = FlutterSecureStorage();
  static const _tokenKey = 'thoidai_work_session_token';

  Future<List<TaskItem>> loadTasks(AuthSession session) async {
    final body = await _getJson('/api/tasks?pageSize=300');
    final payload = body['tasks'];
    final rows = payload is Map<String, dynamic> ? payload['items'] : payload;
    if (rows is! List) return const [];
    return rows.whereType<Map<String, dynamic>>().map(TaskItem.fromJson).toList();
  }

  Future<String> uploadTaskAttachment({
    required String taskId,
    required Uint8List bytes,
    required String fileName,
  }) async {
    final token = await _token();
    if (token == null) throw Exception('Phiên đăng nhập đã hết hạn.');
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${AppConfig.apiBaseUrl}/api/tasks/$taskId/attachments'),
    )..headers['authorization'] = 'Bearer $token';
    request.files.add(http.MultipartFile.fromBytes('file', bytes, filename: fileName));
    final response = await http.Response.fromStream(await request.send());
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Không thể tải tệp lên.');
    final body = jsonDecode(response.body);
    final attachment = body is Map<String, dynamic> ? body['attachment'] : null;
    return attachment is Map<String, dynamic> && attachment['file_name'] is String
        ? attachment['file_name'] as String
        : fileName;
  }

  Future<List<AttendanceItem>> loadTodayAttendance(AuthSession session) async {
    final today = _dateText(DateTime.now());
    final body = await _getJson('/api/attendance?date=$today&period=day&scope=personal');
    final rows = body['rows'];
    if (rows is! List) return const [];
    return rows.whereType<Map<String, dynamic>>().map(AttendanceItem.fromJson).toList();
  }

  Future<DashboardStats> loadDashboard(AuthSession session) async {
    final body = await _getJson('/api/mobile/dashboard');
    return DashboardStats(
      totalTasks: (body['totalTasks'] as num?)?.toInt() ?? 0,
      myTasks: (body['myTasks'] as num?)?.toInt() ?? 0,
      overdueTasks: (body['overdueTasks'] as num?)?.toInt() ?? 0,
      hrProfiles: (body['hrProfiles'] as num?)?.toInt() ?? 0,
      assetsInUse: (body['assetsInUse'] as num?)?.toInt() ?? 0,
      documentsOverdue: (body['documentsOverdue'] as num?)?.toInt() ?? 0,
    );
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final token = await _token();
    if (token == null) throw Exception('Phiên đăng nhập đã hết hạn.');
    final response = await http.get(Uri.parse('${AppConfig.apiBaseUrl}$path'), headers: {'authorization': 'Bearer $token'});
    if (response.statusCode == 401) throw Exception('Phiên đăng nhập đã hết hạn.');
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Không thể tải dữ liệu.');
    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) throw Exception('Dữ liệu máy chủ không hợp lệ.');
    return decoded;
  }

  Future<String?> _token() => _secureStorage.read(key: _tokenKey);

  String _dateText(DateTime date) {
    return '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
  }
}
