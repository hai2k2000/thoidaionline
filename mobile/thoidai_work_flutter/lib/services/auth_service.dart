import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/auth_session.dart';

export '../models/auth_session.dart';

class AuthService {
  static const _sessionKey = 'thoidai_work_user_id';

  SupabaseClient get _client => Supabase.instance.client;

  Future<AuthSession?> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString(_sessionKey);
    if (userId == null || userId.isEmpty) return null;
    return _loadById(userId);
  }

  Future<AuthSession> login(String identifier, String password) async {
    final normalizedIdentifier = identifier.trim().toLowerCase();
    final normalizedPassword = password.trim();

    final row = await _client
        .from('staff_users')
        .select(
          'id,full_name,email,phone,username,password,active,roles(code,name)',
        )
        .or(
          'username.eq.$normalizedIdentifier,email.ilike.$normalizedIdentifier,phone.eq.$normalizedIdentifier',
        )
        .limit(1)
        .maybeSingle();

    if (row == null) {
      throw AuthException('Sai tài khoản hoặc mật khẩu.');
    }

    final active = (row['active'] as bool?) ?? false;
    if (!active) {
      throw AuthException('Tài khoản đã bị khóa.');
    }

    final storedPassword = ((row['password'] as String?) ?? '123456').trim();
    if (storedPassword != normalizedPassword) {
      throw AuthException('Sai tài khoản hoặc mật khẩu.');
    }

    final session = AuthSession.fromJson(row);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_sessionKey, session.id);
    return session;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
  }

  Future<AuthSession?> _loadById(String userId) async {
    final row = await _client
        .from('staff_users')
        .select('id,full_name,email,phone,username,active,roles(code,name)')
        .eq('id', userId)
        .maybeSingle();

    if (row == null) return null;
    final session = AuthSession.fromJson(row);
    return session.active ? session : null;
  }
}
