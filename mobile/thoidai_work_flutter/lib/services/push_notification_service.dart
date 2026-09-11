import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../app_config.dart';

class PushNotificationService {
  factory PushNotificationService() => _instance;
  PushNotificationService._();
  static final PushNotificationService _instance = PushNotificationService._();
  static const _tokenKey = 'thoidai_fcm_token';
  static const _sessionKey = 'thoidai_work_session_token';
  static const _secureStorage = FlutterSecureStorage();
  bool _configured = false;

  Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      _configured = true;
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null && token.isNotEmpty) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, token);
      }
      FirebaseMessaging.onMessage.listen((message) => debugPrint('FCM foreground message: ${message.messageId}'));
    } catch (error) {
      debugPrint('Push notification is not configured: $error');
    }
  }

  Future<void> registerForUser(String _) async {
    if (!_configured) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey) ?? await FirebaseMessaging.instance.getToken();
      final session = await _secureStorage.read(key: _sessionKey);
      if (token == null || token.isEmpty || session == null || session.isEmpty) return;
      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/api/mobile/push-token'),
        headers: {'authorization': 'Bearer $session', 'content-type': 'application/json'},
        body: jsonEncode({'token': token, 'platform': defaultTargetPlatform.name}),
      );
    } catch (error) {
      debugPrint('Could not register push token: $error');
    }
  }
}
