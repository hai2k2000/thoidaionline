class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://thoidai.online',
  );
  static bool get isConfigured => apiBaseUrl.trim().isNotEmpty;
}
