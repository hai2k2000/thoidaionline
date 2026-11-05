# Thời Đại Work Mobile (internal WebView)

The Android shell loads `https://thoidai.online`, including web login and persistent WebView cookies. Web changes appear immediately; there are no duplicate native business screens. iPhone users install the web PWA through Safari.

- HTTPS navigation stays within the configured origin. External web/tel/mailto/Zalo links use the system application.
- Android Back goes through web history, then asks before exit; pull down to refresh.
- Native WebView file chooser supports HTML `accept`, `multiple`, and image `capture`. Android requests camera permission at startup; denying it keeps file selection available. No broad storage permission is requested.
- Authenticated downloads go to private app documents storage, then open through `open_filex`. Only same-origin redirects receive session cookies. Saved files remain until app data is cleared/uninstalled; avoid shared-device use.
- Offline view offers retry; private work pages/API data are never precached by the PWA worker.

## Development

Install a compatible stable Flutter SDK (Flutter >= 3.27, Dart >= 3.6; target toolchain Flutter 3.47 / Dart 3.13) and Android SDK/JDK 17, then run:

```powershell
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=https://thoidai.online
```

Do not regenerate the Android project with `flutter create`: preserve application ID `com.thoidaionline`, branding and signing configuration. `API_BASE_URL` defaults to the production HTTPS origin; HTTP is deliberately unsupported.

## Internal release

Version: `1.0.2+4`. See [INTERNAL_RELEASE.md](INTERNAL_RELEASE.md). APK and signing material must remain out of Git.

## Optional Firebase push

Supply `android/app/google-services.json` for Android package `com.thoidaionline` on the build machine. This file is ignored by Git. The Google Services classpath/plugin and generated Firebase build flag are enabled only when that file exists. Without it, the shell skips Firebase initialization and keeps the normal WebView path; no Firebase configuration is bundled in this change. No Play Store release is planned.

Dependencies use `firebase_core ^4.9.0` and `firebase_messaging ^16.2.2`, the newest versions listed by the existing offline Pub cache index. Their declared requirements are Dart ^3.6 and Flutter >=3.27. Online latest status and dependency resolution were not checked; no `pub get` or Android build was run in this edit-only round.

When configured, the shell requests notification permission (including Android 13+), gets the FCM token, and handles refresh. Registration runs inside the same-origin WebView using its cookies: GET `/api/auth/session`, then POST `/api/mobile/push-token` with `{token, platform: "android"}`. Page load/history, resume and a 30-second session poll trigger a debounced check. Repeated registrations in the same document are suppressed.

Both `/api/auth/logout` and `/api/auth/mobile-logout` unregister the token before discarding the session. Native token deletion is attempted even when server cleanup fails; account changes discard the old native token before obtaining another. Auto-init is disabled to prevent token recreation while logged out. Logout remains available offline; if both unregister and Firebase deletion fail, delivery to the old token cannot be ruled out until connectivity returns. Device/shared-account acceptance must include this case.

Foreground notifications show a snackbar only after an authenticated registration. Notification taps, including cold starts, wait for a valid web session and open only a URL on the configured HTTPS origin. External origins, credential-bearing URLs and other schemes are rejected.

## Camera implementation evidence

The locally cached `flutter_inappwebview_android 1.1.3` implementation (used by `flutter_inappwebview 6.1.5`) reads `FileChooserParams.isCaptureEnabled()` in `InAppWebViewChromeClient.onShowFileChooser`. With image capture enabled and CAMERA granted, it launches `ACTION_IMAGE_CAPTURE`, passes `MediaStore.EXTRA_OUTPUT`, and constructs the output with `FileProvider.getUriForFile`. The provider authority is `${applicationId}.flutter_inappwebview_android.fileprovider`; `capture_paths.xml` exposes only app-specific external files, where that plugin creates its temporary capture file. The plugin example manifest uses this same provider contract. No invented Flutter file-chooser callback or replacement WebChromeClient is used. The Android camera app chooses its default lens; verify rear-camera selection on target devices for `capture="environment"`.

## Device acceptance before publishing

Check login persistence after process restart, logout/login with another account, task/attendance/database/project workflows, Android Back and cancel-exit, pull-to-refresh, network loss/retry, single/multiple file inputs, PDF/DOCX/APK downloads, expired sessions, external https/tel/mailto/Zalo and target=_blank links. Check Safari standalone installation and offline fallback separately. Flutter SDK was unavailable in the local editing round, so analyze/build/device checks remain mandatory on the build machine.

For version 1.0.2+4 also check camera capture/preview/cancel/upload, permission denial and re-enable, Android 13 notification permission, foreground/background/terminated taps, token refresh, logout during registration, account switching, and a build both with and without Firebase configuration. A local SDK was discovered for this round, but resolved project packages are absent and package installation was not authorized.

Blob exports (DOCX/XLSX/ZIP) are transferred from the trusted page in 192 KiB chunks, limited to 100 MiB per export. Immediate URL revocation is deferred for 60 seconds to preserve asynchronous Android downloads. Larger exports require the browser/direct server download path.
