import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../app_config.dart';
import 'push_bridge.dart';

const nativeChannel = MethodChannel('com.thoidaionline/native');

Uri? trustedPushUrl(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  final base = Uri.parse(AppConfig.apiBaseUrl);
  try {
    final uri = base.resolve(value);
    return uri.scheme == 'https' && uri.host == base.host &&
        uri.port == base.port && uri.userInfo.isEmpty ? uri : null;
  } on FormatException { return null; }
}

class NativePushService {
  NativePushService({required this.controller, required this.onMessage});

  final InAppWebViewController? Function() controller;
  final void Function(String message) onMessage;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  Timer? _debounce;
  Timer? _poll;
  String? _token;
  String? _userId;
  Uri? _pendingUrl;
  bool _ready = false;
  bool _pageReady = false;
  bool _disposed = false;
  bool _syncing = false;
  bool _invalidating = false;
  bool _mustDeleteToken = false;
  int _identityGeneration = 0;

  Future<void> start() async {
    if (!Platform.isAndroid) return;
    try {
      await nativeChannel.invokeMethod<bool>('createNotificationChannel');
      nativeChannel.setMethodCallHandler((call) async {
        if (call.method == 'notificationOpened') _queueNotificationUrl(call.arguments);
      });
      _queueNotificationUrl(await nativeChannel.invokeMethod<String>('initialNotificationUrl'));
      if (await nativeChannel.invokeMethod<bool>('firebaseConfigured') != true) return;
      await Firebase.initializeApp();
      if (_disposed) return;
      final messaging = FirebaseMessaging.instance;
      // Auto-init stays disabled so logout cannot silently recreate an unbound token.
      await messaging.setAutoInitEnabled(false);
      final permission = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (_disposed) return;
      _subscriptions.add(messaging.onTokenRefresh.listen((token) {
        if (_disposed || _invalidating || _mustDeleteToken) return;
        _token = token;
        schedule();
      }, onError: (_) {}));
      _subscriptions.add(FirebaseMessaging.onMessage.listen((message) {
        if (_disposed || _userId == null) return;
        final notification = message.notification;
        final text = [notification?.title, notification?.body]
            .whereType<String>().where((text) => text.isNotEmpty).join('\n');
        if (text.isNotEmpty) unawaited(_showForeground(message, text));
      }));
      _subscriptions.add(FirebaseMessaging.onMessageOpenedApp.listen(_openMessage));
      final initial = await messaging.getInitialMessage();
      if (initial != null) _openMessage(initial);
      if (permission.authorizationStatus != AuthorizationStatus.denied) {
        try { _token = await messaging.getToken(); } catch (_) { /* Retry after session validation. */ }
      } else {
        try { await messaging.deleteToken(); } catch (_) { _mustDeleteToken = true; }
      }
      if (_disposed) return;
      _ready = true;
      _poll = Timer.periodic(const Duration(seconds: 30), (_) => schedule());
      schedule();
    } catch (_) {
      // Missing configuration or Google Play services must not prevent the web app opening.
    }
  }

  void pageStarted() { _pageReady = false; }
  void pageLoaded() { _pageReady = true; schedule(); }

  void schedule() {
    if (_disposed || !_ready || !_pageReady) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () => unawaited(_sync()));
  }

  Future<void> logout({bool preservePendingUrl = false}) async {
    if (!_ready || _disposed || _invalidating) return;
    _invalidating = true;
    _identityGeneration++;
    _mustDeleteToken = true;
    _token = null;
    _userId = null;
    if (!preservePendingUrl) _pendingUrl = null;
    try {
      await FirebaseMessaging.instance.deleteToken().timeout(const Duration(seconds: 10));
      _mustDeleteToken = false;
    } catch (_) { /* Retry before registering another account; never reuse the old token. */ }
    finally { _invalidating = false; }
  }

  Future<void> _sync() async {
    final web = controller();
    if (_disposed || !_ready || !_pageReady || _syncing || _invalidating || web == null) return;
    _syncing = true;
    try {
      final current = await web.getUrl();
      if (current == null || trustedPushUrl(current.toString()) == null) return;
      if (_mustDeleteToken) {
        await logout(preservePendingUrl: true);
        if (_mustDeleteToken) return;
      }
      final generation = _identityGeneration;
      final result = await web.callAsyncJavaScript(functionBody: pushRegistrationScript, arguments: {
        'token': _token,
        'priorUserId': _userId,
        'expectedOrigin': Uri.parse(AppConfig.apiBaseUrl).origin,
      });
      if (_disposed || generation != _identityGeneration || result?.error != null || result?.value is! Map) return;
      final state = result!.value as Map;
      switch (state['status']) {
        case 'loggedOut':
          if (_token != null || _userId != null) await logout(preservePendingUrl: true);
          break;
        case 'accountChanged':
          if (_token != null || _userId != null) await logout();
          schedule();
          break;
        case 'needsToken':
          final settings = await FirebaseMessaging.instance.getNotificationSettings();
          if (settings.authorizationStatus == AuthorizationStatus.denied) break;
          _userId = state['userId'] as String;
          final token = await FirebaseMessaging.instance.getToken();
          if (generation != _identityGeneration) break;
          _token = token;
          if (token != null) schedule();
          break;
        case 'registered':
          _userId = state['userId'] as String;
          await _navigatePending();
          break;
      }
    } catch (_) { /* Retry on the next page, resume, or bounded session poll. */ }
    finally { _syncing = false; }
  }

  void _openMessage(RemoteMessage message) {
    _queueNotificationUrl(message.data['url']);
  }

  void _queueNotificationUrl(Object? value) {
    final url = trustedPushUrl(value);
    if (url == null || !(RegExp(r'^/(tasks|projects)/[A-Za-z0-9_-]+$').hasMatch(url.path) || url.path == '/my-tasks')) return;
    _pendingUrl = url.replace(query: '', fragment: '');
    schedule();
  }

  Future<void> _showForeground(RemoteMessage message, String text) async {
    try {
      final shown = await nativeChannel.invokeMethod<bool>('showTaskNotification', {
        'title': message.notification?.title ?? 'Thông báo mới',
        'body': message.notification?.body ?? text,
        'url': trustedPushUrl(message.data['url'])?.toString() ?? '/my-tasks',
        'tag': message.data['tag'] ?? message.messageId ?? 'task',
      });
      if (shown != true && !_disposed) onMessage(text);
    } catch (_) { if (!_disposed) onMessage(text); }
  }

  Future<void> _navigatePending() async {
    final url = _pendingUrl;
    if (url == null || !_pageReady || _userId == null || _disposed) return;
    _pendingUrl = null;
    await controller()?.loadUrl(urlRequest: URLRequest(url: WebUri(url.toString())));
  }

  void dispose() {
    _disposed = true;
    nativeChannel.setMethodCallHandler(null);
    _debounce?.cancel();
    _poll?.cancel();
    for (final subscription in _subscriptions) { unawaited(subscription.cancel()); }
  }
}
