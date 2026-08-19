import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class PushNotificationService {
  factory PushNotificationService() => _instance;
  PushNotificationService._();

  static final PushNotificationService _instance = PushNotificationService._();
  static const _tokenKey = 'thoidai_fcm_token';
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

      FirebaseMessaging.onMessage.listen((message) {
        debugPrint('FCM foreground message: ${message.messageId}');
      });
    } catch (error) {
      debugPrint('Push notification is not configured: $error');
    }
  }

  Future<void> registerForUser(String userId) async {
    if (!_configured) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString(_tokenKey) ?? await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;

      await Supabase.instance.client.from('mobile_push_tokens').upsert({
        'user_id': userId,
        'fcm_token': token,
        'platform': defaultTargetPlatform.name,
        'updated_at': DateTime.now().toIso8601String(),
      }, onConflict: 'fcm_token');
    } catch (error) {
      debugPrint('Could not register push token: $error');
    }
  }
}
