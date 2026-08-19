class TaskItem {
  const TaskItem({
    required this.id,
    required this.title,
    required this.status,
    required this.progressPercent,
    this.dueDate,
    this.ownerName,
    this.departmentName,
    this.attachmentUrl,
    this.assigneeId,
    this.assigneeIds = const [],
    this.assigneeNames = const [],
  });

  final String id;
  final String title;
  final String status;
  final int progressPercent;
  final DateTime? dueDate;
  final String? ownerName;
  final String? departmentName;
  final String? attachmentUrl;
  final String? assigneeId;
  final List<String> assigneeIds;
  final List<String> assigneeNames;

  bool get isOverdue {
    final due = dueDate;
    if (due == null || status == 'done') return false;
    final today = DateTime.now();
    final day = DateTime(today.year, today.month, today.day);
    return due.isBefore(day);
  }

  factory TaskItem.fromJson(Map<String, dynamic> json) {
    final dueText = json['due_date'] as String?;
    final assigneeRows = (json['task_assignees'] as List<dynamic>? ?? [])
        .map((item) => item as Map<String, dynamic>)
        .toList();

    final assigneeNames = assigneeRows
        .map((item) => item['staff_users'] as Map<String, dynamic>?)
        .whereType<Map<String, dynamic>>()
        .map((user) => (user['full_name'] as String?) ?? '')
        .where((name) => name.isNotEmpty)
        .toList();

    final assigneeIds = assigneeRows
        .map((item) => item['user_id'] as String?)
        .whereType<String>()
        .toList();

    return TaskItem(
      id: json['id'] as String,
      title: (json['title'] as String?) ?? 'Không có tiêu đề',
      status: (json['status'] as String?) ?? 'new',
      progressPercent: (json['progress_percent'] as num?)?.round() ?? 0,
      dueDate: dueText == null ? null : DateTime.tryParse(dueText),
      attachmentUrl: json['attachment_url'] as String?,
      ownerName: (json['owner'] as Map<String, dynamic>?)?['full_name'] as String?,
      departmentName: (json['departments'] as Map<String, dynamic>?)?['name'] as String?,
      assigneeId: json['assignee_id'] as String?,
      assigneeIds: assigneeIds,
      assigneeNames: assigneeNames,
    );
  }
}
