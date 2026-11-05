import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../app_config.dart';
import 'native_push_service.dart' show nativeChannel;

class ApkManifest {
  ApkManifest(Map<String, dynamic> data)
      : version = data['version'] as String,
        versionCode = data['versionCode'] as int,
        size = data['size'] as int,
        sha = (data['sha256'] as String).toLowerCase() {
    if (!RegExp(r'^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$').hasMatch(version) ||
        versionCode < 1 || size < 1 || size > 512 * 1024 * 1024 ||
        !RegExp(r'^[a-f0-9]{64}$').hasMatch(sha)) {
      throw const FormatException('Invalid APK manifest');
    }
  }
  final String version;
  final int versionCode;
  final int size;
  final String sha;
}

class ApkUpdateService {
  ApkUpdateService({required this.controller, required this.installedVersionCode,
    required this.onMessage, required this.onProgress}) {
    _ready = _initialize().then((_) => true, onError: (Object _) => false);
  }
  final InAppWebViewController? Function() controller;
  final int installedVersionCode;
  final void Function(String message) onMessage;
  final void Function(bool active, double? progress) onProgress;
  final _client = http.Client();
  late final Future<bool> _ready;
  late Directory _directory;
  late File _stateFile;
  int _lastCheck = 0;
  int _snoozeUntil = 0;
  bool _busy = false;
  bool _disposed = false;
  File? _pendingFile;
  ApkManifest? _pendingManifest;

  bool _sameHost(Uri uri) {
    final base = Uri.parse(AppConfig.apiBaseUrl);
    return base.scheme == 'https' && base.userInfo.isEmpty &&
        uri.scheme == 'https' && uri.host == base.host &&
        uri.port == base.port && uri.userInfo.isEmpty;
  }

  Future<void> _initialize() async {
    final documents = await getApplicationDocumentsDirectory();
    _directory = Directory('${documents.path}/apk-updates');
    await _directory.create(recursive: true);
    // Only this updater's private files are eligible for cleanup.
    await for (final entity in _directory.list(followLinks: false)) {
      if (entity is File && (entity.path.endsWith('.apk') || entity.path.endsWith('.part'))) {
        await entity.delete();
      }
    }
    final support = await getApplicationSupportDirectory();
    _stateFile = File('${support.path}/apk-update-state.json');
    try {
      final state = jsonDecode(await _stateFile.readAsString()) as Map<String, dynamic>;
      _lastCheck = state['lastCheck'] as int? ?? 0;
      _snoozeUntil = state['snoozeUntil'] as int? ?? 0;
    } on FileSystemException { /* First launch. */ }
      on FormatException { /* A damaged preference file can be replaced. */ }
  }

  Future<void> _saveState() async {
    await _stateFile.writeAsString(jsonEncode({
      'lastCheck': _lastCheck, 'snoozeUntil': _snoozeUntil,
    }), flush: true);
  }

  Future<http.StreamedResponse> _get(String path) async {
    final uri = Uri.parse(AppConfig.apiBaseUrl).resolve(path);
    if (!_sameHost(uri)) throw const FormatException('HTTPS same-host only');
    final cookies = await CookieManager.instance().getCookies(url: WebUri(uri.toString()));
    if (!cookies.any((cookie) => cookie.name == 'thoidai_work_session' && cookie.value.isNotEmpty)) {
      throw const HttpException('Login required');
    }
    final request = http.Request('GET', uri)..followRedirects = false;
    request.headers['Cookie'] = cookies.where((cookie) => cookie.name == 'thoidai_work_session').map((cookie) => '${cookie.name}=${cookie.value}').join('; ');
    request.headers['Cache-Control'] = 'no-store';
    final response = await _client.send(request).timeout(const Duration(seconds: 30));
    if (response.statusCode != 200) {
      await response.stream.listen((_) {}).cancel();
      throw const HttpException('Update unavailable');
    }
    return response;
  }

  Future<void> check(BuildContext context, {bool manual = false}) async {
    if (!Platform.isAndroid || _busy || _disposed) return;
    _busy = true;
    try {
      if (!await _ready) throw const FileSystemException('Update storage unavailable');
      if (_disposed || !context.mounted) return;
      if (_pendingFile != null && _pendingManifest != null) {
        if (await nativeChannel.invokeMethod<bool>('canInstallPackages') == true) {
          if (context.mounted) await _install(context, _pendingFile!, _pendingManifest!);
        } else if (manual && context.mounted) {
          await _install(context, _pendingFile!, _pendingManifest!);
        }
        return;
      }
      if (installedVersionCode < 1) {
        if (manual) onMessage('Không xác định được phiên bản đã cài. Vui lòng mở lại ứng dụng.');
        return;
      }
      final now = DateTime.now().millisecondsSinceEpoch;
      if (!manual && (now - _lastCheck < const Duration(hours: 6).inMilliseconds || now < _snoozeUntil)) return;
      final current = await controller()?.getUrl();
      if (current == null || !_sameHost(Uri.parse(current.toString())) || current.path == '/login') {
        if (manual) onMessage('Vui lòng đăng nhập để kiểm tra cập nhật.');
        return;
      }
      final cookies = await CookieManager.instance().getCookies(url: WebUri(AppConfig.apiBaseUrl));
      if (!cookies.any((cookie) => cookie.name == 'thoidai_work_session' && cookie.value.isNotEmpty)) {
        if (manual) onMessage('Vui lòng đăng nhập để kiểm tra cập nhật.');
        return;
      }
      _lastCheck = now;
      await _saveState();
      final response = await _get('/api/mobile/apk/latest');
      final bytes = <int>[];
      await for (final chunk in response.stream.timeout(const Duration(seconds: 30))) {
        bytes.addAll(chunk);
        if (bytes.length > 64 * 1024) throw const FormatException('Manifest too large');
      }
      final manifest = ApkManifest(jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>);
      if (manifest.versionCode <= installedVersionCode) {
        if (manual) onMessage('Ứng dụng đang ở phiên bản mới nhất.');
        return;
      }
      if (_disposed || !context.mounted || WidgetsBinding.instance.lifecycleState != AppLifecycleState.resumed) return;
      final update = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
        title: Text('Có phiên bản mới ${manifest.version}'),
        content: const Text('Tải bản cập nhật và mở trình cài đặt Android?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Để sau')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Cập nhật')),
        ],
      ));
      if (update != true) {
        _snoozeUntil = DateTime.now().add(const Duration(hours: 24)).millisecondsSinceEpoch;
        await _saveState();
        return;
      }
      if (!context.mounted || _disposed) return;
      await _downloadAndInstall(context, manifest);
    } catch (_) {
      if (manual && !_disposed) onMessage('Không thể kiểm tra cập nhật. Kiểm tra kết nối và đăng nhập rồi thử lại.');
    } finally { _busy = false; }
  }

  Future<void> _verify(File file, ApkManifest manifest) async {
    if (await file.length() != manifest.size ||
        (await sha256.bind(file.openRead()).first).toString() != manifest.sha) {
      if (await file.exists()) await file.delete();
      throw const FormatException('APK size or SHA-256 mismatch');
    }
  }

  Future<void> _downloadAndInstall(BuildContext context, ApkManifest manifest) async {
    final file = File('${_directory.path}/update-${manifest.versionCode}.apk');
    IOSink? sink;
    bool verified = false;
    onProgress(true, 0);
    try {
      final response = await _get('/api/mobile/apk/download');
      if (response.contentLength != null && response.contentLength != manifest.size) {
        await response.stream.listen((_) {}).cancel();
        throw const FormatException('APK size mismatch');
      }
      sink = file.openWrite();
      var received = 0;
      await for (final chunk in response.stream.timeout(const Duration(seconds: 60))) {
        received += chunk.length;
        if (_disposed || received > manifest.size) throw const FormatException('APK download interrupted');
        sink.add(chunk);
        await sink.flush();
        onProgress(true, received / manifest.size);
      }
      await sink.close();
      sink = null;
      await _verify(file, manifest);
      verified = true;
      onProgress(false, null);
      if (!_disposed && context.mounted) await _install(context, file, manifest);
    } catch (_) {
      if (!_disposed) onMessage('Không thể tải hoặc xác minh APK (kích thước/SHA-256). Vui lòng thử lại.');
    } finally {
      await sink?.close();
      if (!verified && await file.exists()) await file.delete();
      if (!_disposed) onProgress(false, null);
    }
  }

  Future<void> _install(BuildContext context, File file, ApkManifest manifest) async {
    // Reverify after returning from Android settings, before any installer call.
    try {
      await _verify(file, manifest);
    } catch (_) {
      _pendingFile = null;
      _pendingManifest = null;
      if (!_disposed) onMessage('Tệp cập nhật không còn hợp lệ. Vui lòng kiểm tra cập nhật để tải lại.');
      rethrow;
    }
    if (_disposed || !context.mounted) return;
    if (await nativeChannel.invokeMethod<bool>('canInstallPackages') != true) {
      if (!context.mounted) return;
      final settings = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
        title: const Text('Cho phép cài đặt bản cập nhật'),
        content: const Text('Trong Cài đặt, bật “Cho phép từ nguồn này” cho Thời Đại Work, rồi quay lại ứng dụng để tiếp tục. Bạn có thể tắt quyền sau khi cài đặt.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Để sau')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Mở cài đặt')),
        ],
      ));
      if (settings == true && !_disposed) {
        _pendingFile = file;
        _pendingManifest = manifest;
        await nativeChannel.invokeMethod<void>('openInstallSettings');
      }
      return;
    }
    _pendingFile = null;
    _pendingManifest = null;
    if (_disposed) return;
    final result = await OpenFilex.open(file.path, type: 'application/vnd.android.package-archive');
    if (result.type != ResultType.done) onMessage('Không mở được trình cài đặt. Hãy kiểm tra cập nhật rồi thử lại.');
  }

  void dispose() { _disposed = true; _client.close(); }
}
