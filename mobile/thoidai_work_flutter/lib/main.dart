import 'dart:async';
import 'dart:convert';
import 'dart:collection';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_config.dart';
import 'features/offline_page.dart';
import 'services/native_push_service.dart';
import 'services/apk_update_service.dart';
import 'theme/app_theme.dart';
import 'widgets/branded_loading.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (Platform.isAndroid) {
    try {
      // InAppWebView's capture chooser requires CAMERA permission before opening.
      await nativeChannel.invokeMethod<bool>('requestCameraPermission');
    } catch (_) { /* File selection remains available if camera permission is denied. */ }
  }
  final info = await PackageInfo.fromPlatform();
  runApp(ThoiDaiWorkApp(version: info.version, versionCode: int.tryParse(info.buildNumber) ?? 0));
}

class ThoiDaiWorkApp extends StatelessWidget {
  const ThoiDaiWorkApp({super.key, this.version = '1.0.0', this.versionCode = 0});
  final String version;
  final int versionCode;

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Thời Đại Work',
    theme: AppTheme.light(),
    home: WebShell(version: version, versionCode: versionCode),
  );
}

bool isInternalUrl(Uri uri) {
  final base = Uri.parse(AppConfig.apiBaseUrl);
  return uri.scheme == 'https' && uri.host == base.host && uri.port == base.port && uri.userInfo.isEmpty;
}

String safeDownloadName(String? suggestion, Uri uri) {
  final raw = suggestion ?? (uri.pathSegments.isNotEmpty ? uri.pathSegments.last : 'download');
  final name = raw.split(RegExp(r'[/\\]')).last.replaceAll(RegExp(r'[^A-Za-z0-9._+-]'), '_');
  return name.isEmpty || name == '.' || name == '..' ? 'download' : name;
}

class WebShell extends StatefulWidget {
  const WebShell({super.key, required this.version, required this.versionCode});
  final String version;
  final int versionCode;
  @override
  State<WebShell> createState() => _WebShellState();
}

class _WebShellState extends State<WebShell> with WidgetsBindingObserver {
  InAppWebViewController? _controller;
  late final PullToRefreshController _refresh;
  StreamSubscription<List<ConnectivityResult>>? _connectivity;
  final _client = http.Client();
  bool _loading = true;
  bool _offline = false;
  bool _downloading = false;
  bool _backPending = false;
  double? _downloadProgress;
  late final NativePushService _push;
  late final ApkUpdateService _apkUpdates;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _push = NativePushService(controller: () => _controller, onMessage: _message);
    _apkUpdates = ApkUpdateService(controller: () => _controller, installedVersionCode: widget.versionCode, onMessage: _message, onProgress: (active, progress) {
      if (mounted) setState(() { _downloading = active; _downloadProgress = progress; });
    });
    unawaited(_push.start());
    _refresh = PullToRefreshController(
      settings: PullToRefreshSettings(color: const Color(0xffea580c)),
      onRefresh: _retry,
    );
    _connectivity = Connectivity().onConnectivityChanged.listen((results) {
      if (mounted && results.every((result) => result == ConnectivityResult.none)) {
        setState(() { _offline = true; _loading = false; });
        _refresh.endRefreshing();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _push.dispose();
    _apkUpdates.dispose();
    _connectivity?.cancel();
    _client.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) { _push.schedule(); if (mounted && !_downloading) unawaited(_apkUpdates.check(context)); }
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _retry() async {
    if (!mounted) return;
    setState(() { _offline = false; _loading = true; });
    final url = await _controller?.getUrl();
    if (url == null || !isInternalUrl(Uri.parse(url.toString()))) {
      await _controller?.loadUrl(urlRequest: URLRequest(url: WebUri(AppConfig.apiBaseUrl)));
    } else {
      await _controller?.reload();
    }
  }

  Future<void> _external(Uri uri) async {
    // Reject executable/local schemes, while allowing web, telephone and Zalo links.
    if (!['https', 'http', 'tel', 'mailto', 'zalo', 'zalopay'].contains(uri.scheme)) {
      _message('Liên kết này chưa được hỗ trợ.');
      return;
    }
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        _message('Không tìm thấy ứng dụng để mở liên kết.');
      }
    } catch (_) { _message('Không thể mở liên kết.'); }
  }

  Future<void> _downloadBlob(String blobUrl, String? suggestedFilename) async {
    final controller = _controller;
    final source = Uri.tryParse(blobUrl.substring(5));
    final current = await controller?.getUrl();
    if (controller == null || source == null || !isInternalUrl(source)
        || current == null || !isInternalUrl(Uri.parse(current.toString()))) {
      _message('Chỉ tải tệp xuất từ trang nội bộ.');
      return;
    }
    setState(() { _downloading = true; _downloadProgress = null; });
    final key = '__tdDownload${DateTime.now().microsecondsSinceEpoch}';
    File? file;
    IOSink? sink;
    var complete = false;
    try {
      final result = await controller.callAsyncJavaScript(functionBody: r"""
        const response = await fetch(url);
        const blob = await response.blob();
        if (blob.size > 100 * 1024 * 1024) throw new Error('Export exceeds 100 MiB');
        window[key] = blob;
        return blob.size;
      """, arguments: {'url': blobUrl, 'key': key});
      if (result?.error != null || result?.value is! num) throw const FormatException('Export unavailable');
      final size = (result!.value as num).toInt();
      if (size < 0 || size > 100 * 1024 * 1024) throw const FormatException('Invalid export size');
      final dir = await getApplicationDocumentsDirectory();
      final exportedName = await controller.callAsyncJavaScript(
        functionBody: 'return window.__tdExportNames?.get(url) || null;',
        arguments: {'url': blobUrl},
      );
      final suggestion = exportedName?.value is String ? exportedName!.value as String : suggestedFilename;
      final name = safeDownloadName(suggestion, Uri.parse('https://local/export'));
      if (name.toLowerCase().endsWith('.apk')) throw const FormatException('Use the verified APK updater');
      file = File('${dir.path}/${DateTime.now().microsecondsSinceEpoch}-$name');
      sink = file.openWrite();
      // Transfer bounded chunks instead of retaining a base64 copy of the entire file.
      for (var offset = 0; offset < size; offset += 192 * 1024) {
        final chunk = await controller.callAsyncJavaScript(functionBody: r"""
          const blob = window[key];
          if (!blob) throw new Error('Page changed during export');
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob.slice(offset, offset + 192 * 1024));
          });
        """, arguments: {'key': key, 'offset': offset});
        if (chunk?.error != null || chunk?.value is! String) throw const FormatException('Export interrupted');
        final bytes = base64Decode(chunk!.value as String);
        if (bytes.length > 192 * 1024 || bytes.isEmpty) throw const FormatException('Invalid export chunk');
        sink.add(bytes);
        if (mounted) setState(() => _downloadProgress = ((offset + bytes.length) / size).clamp(0.0, 1.0));
      }
      await sink.flush();
      await sink.close();
      sink = null;
      if (await file.length() != size) throw const FormatException('Incomplete export');
      complete = true;
      if (mounted) await OpenFilex.open(file.path);
    } catch (_) { _message('Không thể xuất tệp. Thử lại với tệp tối đa 100 MiB.'); }
    finally {
      await sink?.close();
      if (!complete && file != null && await file.exists()) await file.delete();
      try { await controller.callAsyncJavaScript(functionBody: 'delete window[key];', arguments: {'key': key}); } catch (_) { /* Page may have closed. */ }
      if (mounted) setState(() { _downloading = false; _downloadProgress = null; });
    }
  }

  Future<void> _download(DownloadStartRequest download) async {
    if (_downloading) { _message('Một tệp đang được tải.'); return; }
    if (download.url.scheme == 'blob') { await _downloadBlob(download.url.toString(), download.suggestedFilename); return; }
    var uri = Uri.parse(download.url.toString());
    if (!isInternalUrl(uri)) { await _external(uri); return; }
    if (uri.path == '/api/mobile/apk/download') { await _apkUpdates.check(context, manual: true); return; }
    setState(() { _downloading = true; _downloadProgress = null; });
    File? file;
    IOSink? sink;
    var complete = false;
    try {
      http.StreamedResponse? response;
      // Recompute cookies for each same-origin redirect; never forward them externally.
      for (var redirects = 0; redirects <= 5; redirects++) {
        final cookies = await CookieManager.instance().getCookies(url: WebUri(uri.toString()));
        final request = http.Request('GET', uri)..followRedirects = false;
        request.headers['Cookie'] = cookies.map((cookie) => '${cookie.name}=${cookie.value}').join('; ');
        final settings = await _controller?.getSettings();
        request.headers['User-Agent'] = settings?.userAgent ?? 'ThoidaiWorkApp/${widget.version}';
        response = await _client.send(request).timeout(const Duration(seconds: 30));
        if ([301, 302, 303, 307, 308].contains(response.statusCode)) {
          final location = response.headers['location'];
          await response.stream.drain<void>();
          if (location == null || redirects == 5) throw const HttpException('Invalid redirect');
          final next = uri.resolve(location);
          if (!isInternalUrl(next)) { await _external(next); return; }
          uri = next;
          continue;
        }
        break;
      }
      if (response == null || response.statusCode != 200 || (response.headers['content-type'] ?? '').contains('text/html')) {
        throw const HttpException('Download unavailable; check your session');
      }
      final directory = await getApplicationDocumentsDirectory();
      final disposition = response.headers['content-disposition'] ?? '';
      final headerName = RegExp(r'filename="?([^";]+)').firstMatch(disposition)?.group(1);
      final name = safeDownloadName(headerName ?? download.suggestedFilename, uri);
      if (name.toLowerCase().endsWith('.apk') || (response.headers['content-type'] ?? '').contains('android.package-archive')) {
        await response.stream.listen((_) {}).cancel();
        throw const FormatException('Use the verified APK updater');
      }
      file = File('${directory.path}/${DateTime.now().microsecondsSinceEpoch}-$name');
      sink = file.openWrite();
      var received = 0;
      final total = response.contentLength;
      await for (final chunk in response.stream.timeout(const Duration(seconds: 60))) {
        sink.add(chunk);
        received += chunk.length;
        if (mounted && total != null && total > 0) setState(() => _downloadProgress = (received / total).clamp(0.0, 1.0));
      }
      await sink.flush();
      await sink.close();
      sink = null;
      if (total != null && received != total) throw const HttpException('Incomplete download');
      complete = true;
      if (!mounted) return;
      final result = await OpenFilex.open(file.path);
      _message(result.type == ResultType.done ? 'Đã tải tệp.' : 'Đã lưu tệp. Chưa có ứng dụng phù hợp để mở.');
    } catch (_) { _message('Không thể tải tệp. Kiểm tra kết nối và đăng nhập rồi thử lại.'); }
    finally {
      await sink?.close();
      if (!complete && file != null && await file.exists()) await file.delete();
      if (mounted) setState(() { _downloading = false; _downloadProgress = null; });
    }
  }

  Future<void> _back() async {
    if (_backPending) return;
    _backPending = true;
    try {
      if (await _controller?.canGoBack() ?? false) {
        await _controller!.goBack();
        if (mounted) setState(() => _offline = false);
        return;
      }
      if (!mounted) return;
      final exit = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
        title: const Text('Thoát ứng dụng?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Ở lại')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Thoát')),
        ],
      ));
      if (exit == true) await SystemNavigator.pop();
    } finally { _backPending = false; }
  }

  void _loadEnded() {
    _refresh.endRefreshing();
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) { if (!didPop) unawaited(_back()); },
    child: Scaffold(body: SafeArea(child: Stack(children: [
      InAppWebView(
        initialUrlRequest: URLRequest(url: WebUri(AppConfig.apiBaseUrl)),
        initialUserScripts: UnmodifiableListView<UserScript>([UserScript(
          injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
          forMainFrameOnly: true,
          source: r'''
            // Exports revoke their URLs immediately after click. Keep them alive long
            // enough for Android's asynchronous download callback, with bounded expiry.
            (() => {
              const revoke = URL.revokeObjectURL.bind(URL);
              URL.revokeObjectURL = url => setTimeout(() => revoke(url), 60000);
              const click = HTMLAnchorElement.prototype.click;
              const names = new Map();
              window.__tdExportNames = names;
              HTMLAnchorElement.prototype.click = function() {
                if (this.href.startsWith('blob:')) {
                  const url = this.href;
                  names.set(url, this.download);
                  setTimeout(() => names.delete(url), 60000);
                  window.flutter_inappwebview.callHandler('tdBlobDownload', url, this.download);
                  return;
                }
                return click.call(this);
              };
              document.addEventListener('click', event => {
                const anchor = event.target.closest?.('a[download]');
                if (anchor?.href.startsWith('blob:')) {
                  event.preventDefault();
                  window.flutter_inappwebview.callHandler('tdBlobDownload', anchor.href, anchor.download);
                }
              }, true);
            })();
          ''',
        )]),
        initialSettings: InAppWebViewSettings(
          applicationNameForUserAgent: 'ThoidaiWorkApp/${widget.version}+${widget.versionCode}',
          useShouldOverrideUrlLoading: true,
          useOnDownloadStart: true,
          supportMultipleWindows: true,
          javaScriptCanOpenWindowsAutomatically: false,
          thirdPartyCookiesEnabled: false,
          mixedContentMode: MixedContentMode.MIXED_CONTENT_NEVER_ALLOW,
        ),
        // Native chooser honors capture and uses the configured FileProvider for camera output.
        pullToRefreshController: _refresh,
        onWebViewCreated: (controller) {
          _controller = controller;
          controller.addJavaScriptHandler(handlerName: 'tdCheckApkUpdate', callback: (_) async {
            final current = await controller.getUrl();
            if (!mounted || _downloading || current == null || !isInternalUrl(Uri.parse(current.toString()))) return false;
            await _apkUpdates.check(context, manual: true);
            return true;
          });
          controller.addJavaScriptHandler(handlerName: 'tdPushLogout', callback: (_) async {
            final current = await controller.getUrl();
            if (current == null || !isInternalUrl(Uri.parse(current.toString()))) return false;
            await _push.logout();
            return true;
          });
          controller.addJavaScriptHandler(handlerName: 'tdBlobDownload', callback: (args) async {
            if (_downloading || args.isEmpty || args[0] is! String) return false;
            final uri = Uri.tryParse(args[0] as String);
            if (uri == null || uri.scheme != 'blob') return false;
            final origin = Uri.tryParse(uri.toString().substring(5));
            if (origin == null || !isInternalUrl(origin)) return false;
            await _downloadBlob(uri.toString(), args.length > 1 && args[1] is String ? args[1] as String : null);
            return true;
          });
        },
        onLoadStart: (_, __) {
          _push.pageStarted();
          if (mounted) setState(() => _loading = true);
        },
        onLoadStop: (_, __) { _loadEnded(); _push.pageLoaded(); if (mounted && !_downloading) unawaited(_apkUpdates.check(context)); },
        onUpdateVisitedHistory: (_, __, ___) { _push.schedule(); if (mounted && !_downloading) unawaited(_apkUpdates.check(context)); },
        onReceivedError: (_, request, __) {
          if (request.isForMainFrame == true) {
            _loadEnded();
            if (mounted) setState(() => _offline = true);
          }
        },
        onReceivedHttpError: (_, request, __) { if (request.isForMainFrame == true) _loadEnded(); },
        shouldOverrideUrlLoading: (_, action) async {
          final url = action.request.url;
          if (url == null) return NavigationActionPolicy.CANCEL;
          final uri = Uri.parse(url.toString());
          if (isInternalUrl(uri)) return NavigationActionPolicy.ALLOW;
          if (uri.scheme == 'blob' && isInternalUrl(Uri.parse(uri.toString().substring(5)))) return NavigationActionPolicy.ALLOW;
          if (action.isForMainFrame) await _external(uri);
          return NavigationActionPolicy.CANCEL;
        },
        onCreateWindow: (controller, action) async {
          final url = action.request.url;
          if (url != null) {
            final uri = Uri.parse(url.toString());
            if (isInternalUrl(uri)) { await controller.loadUrl(urlRequest: URLRequest(url: url)); }
            else { await _external(uri); }
          }
          return false;
        },
        onDownloadStartRequest: (_, request) => _download(request),
      ),
      if (_loading && !_offline) const Positioned.fill(child: ColoredBox(color: Colors.white, child: BrandedLoading(message: 'Đang tải Thời Đại Work...'))),
      if (_offline) Positioned.fill(child: OfflinePage(onRetry: () => unawaited(_retry()))),
      if (_downloading) Positioned(left: 16, right: 16, bottom: 16, child: Card(child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(mainAxisSize: MainAxisSize.min, children: [const Text('Đang tải tệp...'), const SizedBox(height: 8), LinearProgressIndicator(value: _downloadProgress)]),
      ))),
    ]))),
  );
}
