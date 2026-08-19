class AuthSession {
  const AuthSession({
    required this.id,
    required this.fullName,
    required this.active,
    this.email,
    this.phone,
    this.username,
    this.roleCode,
    this.roleName,
  });

  final String id;
  final String fullName;
  final bool active;
  final String? email;
  final String? phone;
  final String? username;
  final String? roleCode;
  final String? roleName;

  bool get canManageAllTasks {
    return roleCode == 'tong_bien_tap' ||
        roleCode == 'pho_tong_bien_tap' ||
        roleCode == 'phu_trach_phong_tri_su' ||
        roleCode == 'phu_trach_phong_phong_vien' ||
        roleCode == 'phu_trach_phong_bien_tap';
  }

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    final role = json['roles'] as Map<String, dynamic>?;
    return AuthSession(
      id: json['id'] as String,
      fullName: (json['full_name'] as String?) ?? 'Người dùng',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      username: json['username'] as String?,
      active: (json['active'] as bool?) ?? false,
      roleCode: role?['code'] as String?,
      roleName: role?['name'] as String?,
    );
  }
}
