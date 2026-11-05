# Thời Đại Work Mobile (internal WebView)

The Android shell loads `https://thoidai.online`, including web login and persistent WebView cookies. Web changes appear immediately; there are no duplicate native business screens. iPhone users install the web PWA through Safari.

- HTTPS navigation stays within the configured origin. External web/tel/mailto/Zalo links use the system application.
- Android Back goes through web history, then asks before exit; pull down to refresh.
- Native WebView file chooser supports HTML `accept` and `multiple`. No broad storage permission is requested.
- Authenticated downloads go to private app documents storage, then open through `open_filex`. Only same-origin redirects receive session cookies. Saved files remain until app data is cleared/uninstalled; avoid shared-device use.
- Offline view offers retry; private work pages/API data are never precached by the PWA worker.

## Development

Install a compatible stable Flutter SDK (Dart >= 3.4) and Android SDK/JDK 17, then run:

```powershell
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=https://thoidai.online
```

Do not regenerate the Android project with `flutter create`: preserve application ID `com.thoidaionline`, branding and signing configuration. `API_BASE_URL` defaults to the production HTTPS origin; HTTP is deliberately unsupported.

## Internal release

Version: `1.0.0+2`. See [INTERNAL_RELEASE.md](INTERNAL_RELEASE.md). APK and signing material must remain out of Git.

TODO: push notifications require a separately approved design and Firebase configuration; Firebase dependencies were removed because no google-services.json exists. No Play Store release is planned.

## Device acceptance before publishing

Check login persistence after process restart, logout/login with another account, task/attendance/database/project workflows, Android Back and cancel-exit, pull-to-refresh, network loss/retry, single/multiple file inputs, PDF/DOCX/APK downloads, expired sessions, external https/tel/mailto/Zalo and target=_blank links. Check Safari standalone installation and offline fallback separately. Flutter SDK was unavailable in the local editing round, so analyze/build/device checks remain mandatory on the build machine.

Blob exports (DOCX/XLSX/ZIP) are transferred from the trusted page in 192 KiB chunks, limited to 100 MiB per export. Immediate URL revocation is deferred for 60 seconds to preserve asynchronous Android downloads. Larger exports require the browser/direct server download path.
