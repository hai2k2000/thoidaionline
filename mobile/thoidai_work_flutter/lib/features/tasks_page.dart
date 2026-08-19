import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/auth_session.dart';
import '../models/task_item.dart';
import '../services/file_open_service.dart';
import '../services/work_service.dart';
import '../widgets/branded_loading.dart';

class TasksPage extends StatefulWidget {
  const TasksPage({
    required this.session,
    required this.workService,
    super.key,
  });

  final AuthSession session;
  final WorkService workService;

  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  late Future<List<TaskItem>> _future;
  final _fileOpenService = FileOpenService();
  String _status = 'all';
  String? _uploadingTaskId;
  String? _openingTaskId;

  @override
  void initState() {
    super.initState();
    _future = widget.workService.loadTasks(widget.session);
  }

  Future<void> _refresh() async {
    setState(() => _future = widget.workService.loadTasks(widget.session));
    await _future;
  }

  Future<void> _pickFile(TaskItem task) async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    final file = result?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;
    await _upload(task: task, bytes: bytes, fileName: file.name);
  }

  Future<void> _upload({
    required TaskItem task,
    required Uint8List bytes,
    required String fileName,
  }) async {
    setState(() => _uploadingTaskId = task.id);
    try {
      await widget.workService.uploadTaskAttachment(
        taskId: task.id,
        bytes: bytes,
        fileName: fileName,
      );
      _showMessage('Đã upload tệp đính kèm.');
      await _refresh();
    } catch (error) {
      _showMessage('Upload lỗi: $error');
    } finally {
      if (mounted) setState(() => _uploadingTaskId = null);
    }
  }

  Future<void> _openAttachment(TaskItem task) async {
    final url = task.attachmentUrl;
    if (url == null || url.isEmpty) return;

    setState(() => _openingTaskId = task.id);
    try {
      if (_isDownloadableDocument(url)) {
        await _fileOpenService.downloadAndOpen(url);
      } else {
        await _fileOpenService.openUrl(url);
      }
    } catch (error) {
      _showMessage('Không mở được tệp: $error');
    } finally {
      if (mounted) setState(() => _openingTaskId = null);
    }
  }

  bool _isDownloadableDocument(String url) {
    final lower = url.toLowerCase();
    return lower.contains('.pdf') ||
        lower.contains('.doc') ||
        lower.contains('.docx') ||
        lower.contains('.xls') ||
        lower.contains('.xlsx') ||
        lower.contains('.ppt') ||
        lower.contains('.pptx');
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Công việc'),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 52,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              scrollDirection: Axis.horizontal,
              children: [
                _FilterChip(label: 'Tất cả', value: 'all', groupValue: _status, onChanged: _setStatus),
                _FilterChip(label: 'Mới', value: 'new', groupValue: _status, onChanged: _setStatus),
                _FilterChip(label: 'Đang làm', value: 'in_progress', groupValue: _status, onChanged: _setStatus),
                _FilterChip(label: 'Chờ duyệt', value: 'pending_review', groupValue: _status, onChanged: _setStatus),
                _FilterChip(label: 'Hoàn thành', value: 'done', groupValue: _status, onChanged: _setStatus),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: FutureBuilder<List<TaskItem>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const BrandedLoading();
                  }
                  if (snapshot.hasError) {
                    return _ErrorList(message: snapshot.error.toString(), onRetry: _refresh);
                  }

                  final tasks = (snapshot.data ?? [])
                      .where((task) => _status == 'all' || task.status == _status)
                      .toList();

                  if (tasks.isEmpty) {
                    return const Center(child: Text('Không có công việc phù hợp.'));
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    itemCount: tasks.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final task = tasks[index];
                      return _TaskCard(
                        task: task,
                        uploading: _uploadingTaskId == task.id,
                        opening: _openingTaskId == task.id,
                        onPickFile: () => _pickFile(task),
                        onOpenAttachment: () => _openAttachment(task),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _setStatus(String value) {
    setState(() => _status = value);
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.value,
    required this.groupValue,
    required this.onChanged,
  });

  final String label;
  final String value;
  final String groupValue;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: value == groupValue,
        onSelected: (_) => onChanged(value),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.uploading,
    required this.opening,
    required this.onPickFile,
    required this.onOpenAttachment,
  });

  final TaskItem task;
  final bool uploading;
  final bool opening;
  final VoidCallback onPickFile;
  final VoidCallback onOpenAttachment;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final dueDate = task.dueDate == null ? 'Chưa có hạn' : dateFormat.format(task.dueDate!);
    final assignees = task.assigneeNames.isEmpty ? 'Chưa rõ người nhận' : task.assigneeNames.join(', ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    task.title,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 8),
                _StatusBadge(status: task.status),
              ],
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(value: task.progressPercent.clamp(0, 100) / 100),
            const SizedBox(height: 8),
            Text('Tiến độ ${task.progressPercent}%'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoPill(
                  icon: task.isOverdue ? Icons.warning_amber_outlined : Icons.calendar_today_outlined,
                  label: dueDate,
                  danger: task.isOverdue,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              assignees,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xff475569)),
            ),
            if (task.departmentName != null) ...[
              const SizedBox(height: 4),
              Text(task.departmentName!, style: const TextStyle(color: Color(0xff64748b))),
            ],
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: uploading ? null : onPickFile,
              icon: uploading
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.attach_file),
              label: Text(task.attachmentUrl == null ? 'Đính kèm tệp' : 'Đổi tệp'),
            ),
            if (task.attachmentUrl != null) ...[
              const SizedBox(height: 6),
              OutlinedButton.icon(
                onPressed: opening ? null : onOpenAttachment,
                icon: opening
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.open_in_new),
                label: const Text('Mở/tải tệp đính kèm'),
              ),
            ],
          ],
        ),
      ),
    );
  }

}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'in_progress' => 'Đang làm',
      'pending_review' => 'Chờ duyệt',
      'done' => 'Hoàn thành',
      'rejected' => 'Trả lại',
      _ => 'Mới',
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xfffff7ed),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xffffedd5)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xff9a3412),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({
    required this.icon,
    required this.label,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xffb91c1c) : const Color(0xff475569);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(color: color)),
      ],
    );
  }
}

class _ErrorList extends StatelessWidget {
  const _ErrorList({required this.message, required this.onRetry});

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
