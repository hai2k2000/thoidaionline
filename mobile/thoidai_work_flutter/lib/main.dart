import 'package:flutter/material.dart';

import 'app_config.dart';
import 'features/home_shell.dart';
import 'features/login_page.dart';
import 'features/offline_page.dart';
import 'services/auth_service.dart';
import 'services/connectivity_service.dart';
import 'services/push_notification_service.dart';
import 'theme/app_theme.dart';
import 'widgets/branded_loading.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await PushNotificationService().initialize();
  runApp(const ThoiDaiWorkApp());
}

class ThoiDaiWorkApp extends StatefulWidget {
  const ThoiDaiWorkApp({super.key});

  @override
  State<ThoiDaiWorkApp> createState() => _ThoiDaiWorkAppState();
}

class _ThoiDaiWorkAppState extends State<ThoiDaiWorkApp> {
  final _authService = AuthService();
  final _connectivityService = ConnectivityService();
  final _pushNotificationService = PushNotificationService();
  bool _loading = true;
  bool _online = true;
  AuthSession? _session;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _connectivityService.onlineStream.listen((online) {
      if (!mounted) return;
      setState(() => _online = online);
    });
  }

  Future<void> _bootstrap() async {
    final online = await _connectivityService.isOnline();
    if (!AppConfig.isConfigured) {
      setState(() {
        _online = online;
        _loading = false;
      });
      return;
    }

    final session = online ? await _authService.restoreSession() : null;
    if (session != null) {
      await _pushNotificationService.registerForUser(session.id);
    }
    if (!mounted) return;
    setState(() {
      _online = online;
      _session = session;
      _loading = false;
    });
  }

  Future<void> _onLoggedIn(AuthSession session) async {
    await _pushNotificationService.registerForUser(session.id);
    setState(() => _session = session);
  }

  Future<void> _onLogout() async {
    await _authService.logout();
    if (!mounted) return;
    setState(() => _session = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Thời Đại Work',
      theme: AppTheme.light(),
      home: _loading
          ? const _BootScreen()
          : !_online
              ? OfflinePage(onRetry: _bootstrap)
              : !AppConfig.isConfigured
                  ? const _ConfigMissingScreen()
                  : _session == null
                      ? LoginPage(authService: _authService, onLoggedIn: _onLoggedIn)
                      : HomeShell(session: _session!, onLogout: _onLogout),
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: BrandedLoading(message: 'Đang khởi động...'));
  }
}

class _ConfigMissingScreen extends StatelessWidget {
  const _ConfigMissingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: Text(
              'Thiếu địa chỉ máy chủ. Chạy app với '
              '--dart-define=API_BASE_URL để cấu hình kết nối.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
