import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../models/auth_session.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    required this.session,
    required this.onLogout,
    super.key,
  });

  final AuthSession session;
  final Future<void> Function() onLogout;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String _version = 'Đang tải...';

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (!mounted) return;
    setState(() => _version = '${info.version}+${info.buildNumber}');
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 28,
                        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                        child: Text(
                          session.fullName.isEmpty ? '?' : session.fullName.characters.first,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              session.fullName,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                            ),
                            Text(
                              session.roleName ?? 'Thành viên',
                              style: const TextStyle(color: Color(0xff64748b)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  _InfoRow(label: 'Username', value: session.username ?? '-'),
                  _InfoRow(label: 'Email', value: session.email ?? '-'),
                  _InfoRow(label: 'Số điện thoại', value: session.phone ?? '-'),
                  _InfoRow(label: 'Mã vai trò', value: session.roleCode ?? '-'),
                  _InfoRow(label: 'Phiên bản app', value: _version),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout),
            label: const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Đăng xuất'),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(label, style: const TextStyle(color: Color(0xff64748b))),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
