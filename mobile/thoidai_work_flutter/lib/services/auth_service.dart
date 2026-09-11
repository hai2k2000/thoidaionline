import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../app_config.dart';
import '../models/auth_session.dart';

export '../models/auth_session.dart';

class AuthService {
  static const _tokenKey = 'thoidai_work_session_token';
  static const _secureStorage = FlutterSecureStorage();

  Future<AuthSession?> restoreSession() async {
    final token = await _secureStorage.read(key: _tokenKey);
    if (token == null || token.isEmpty) return null;
    try {
      return await _loadSession(token);
    } on AuthException {
      await _secureStorage.delete(key: _tokenKey);
      return null;
    }
  }

  Future<AuthSession> login(String identifier, String password) async {
    final response = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/api/auth/mobile-login'),
      headers: const {'content-type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );
    if (response.statusCode != 200) throw AuthException(_errorMessage(response));
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final token = body['token'] as String?;
    if (token == null || token.isEmpty) throw const AuthException('Phiên đăng nhập không hợp lệ.');
    await _secureStorage.write(key: _tokenKey, value: token);
    try {
      return await _loadSession(token);
    } catch (_) {
      await _secureStorage.delete(key: _tokenKey);
      rethrow;
    }
  }

  Future<void> logout() async {
    final token = await _secureStorage.read(key: _tokenKey);
    if (token != null && token.isNotEmpty) {
      await http.post(Uri.parse('${AppConfig.apiBaseUrl}/api/auth/mobile-logout'), headers: _headers(token));
    }
    await _secureStorage.delete(key: _tokenKey);
  }

  Future<String?> readToken() => _secureStorage.read(key: _tokenKey);

  Future<AuthSession> _loadSession(String token) async {
    final response = await http.get(
      Uri.parse('${AppConfig.apiBaseUrl}/api/auth/session'),
      headers: _headers(token),
    );
    if (response.statusCode != 200) throw const AuthException('Phiên đăng nhập đã hết hạn.');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final user = body['user'];
    if (user is! Map<String, dynamic>) throw const AuthException('Phiên đăng nhập không hợp lệ.');
    return AuthSession.fromJson(user);
  }

  Map<String, String> _headers(String token) => {'authorization': 'Bearer $token'};

  String _errorMessage(http.Response response) {
    try {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return (body['error'] as String?) ?? 'Sai tài khoản hoặc mật khẩu.';
    } catch (_) {
      return 'Không kết nối được máy chủ đăng nhập.';
    }
  }
}

class AuthException implements Exception {
  const AuthException(this.message);
  final String message;
  @override
  String toString() => message;
}
