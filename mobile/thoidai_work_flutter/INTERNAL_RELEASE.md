# Internal Android release

Policy: [GLOBAL_DEPLOY_POLICY.md](https://github.com/hai2k2000/rulecodex/blob/main/GLOBAL_DEPLOY_POLICY.md). This is a runbook, not authorization to publish. No Play Store or Firebase setup is required.

## Sign and build locally

Keep the private keystore in a backed-up secure location. Keep `android/key.properties` out of Git with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. `storeFile` is resolved relative to android/app; an absolute path with forward slashes also works. Never paste passwords into logs. Debug signing is never a release fallback. Retain the signing key for future updates and increment versionCode for each release.

From the repository root:

```powershell
./scripts/mobile/build-internal-apk.ps1
# Optional: -FlutterRoot C:/source/mobile/thoidai_work_flutter -Dist C:/release/mobile
```

The script runs pub get and a release build with API_BASE_URL=https://thoidai.online. Default output is repository `dist/thoidai-work-1.0.0.apk` and BOM-free `dist/latest.json`. Existing APK names are not overwritten. Manifest: version, integer versionCode, basename fileName, integer byte size, SHA-256, UTC publishedAt. Run flutter analyze and flutter test first; verify the APK signing certificate with Android SDK apksigner and test on a real device. Flutter SDK is not present in the editing workspace.

## Publish only after owner approval

Target: `vps-aylaspa`, private distribution root `/opt/thoidai-work/mobile-dist`, served only through the authenticated Next routes. `MOBILE_APK_DIR` can select another private directory. Never put APKs in public/ or an nginx static alias.

1. Record source SHA and dirty state, Flutter/JDK versions, APK certificate fingerprint, size/checksum and device acceptance. Obtain approval for this project, APK version and publication operation. Check disk headroom using the canonical disk guard; preserve >=10 GiB after writes. Back up the current latest.json and record the previous APK as rollback; keep backups outside release cleanup.
2. Transfer the APK and manifest through the documented SSH transfer path to temporary names in the distribution directory. Verify SHA-256 and byte size on the server against the local manifest. Set ownership/permissions so only the operator can publish and the web service can read; the service should not write distribution files. Reject symlinks/traversal filenames. Do not overwrite a published APK.
3. Rename the validated APK to its final basename first, then atomically rename the new manifest to latest.json on the same filesystem. The web service reads it per request; publication itself needs no service restart or DB migration. Publish only after the web endpoints are separately deployed and verified.
4. Verify unauthenticated API requests return 401; authenticated employee and cong_tac_vien requests return metadata and an attachment with matching size/SHA-256, private/no-store headers, and correct APK MIME type. Confirm /app shows version and installation instructions. Verify no public nginx location exposes the distribution directory.
5. Rollback by atomically restoring the backed-up latest.json pointing at the preserved previous APK. Keep current and previous APKs plus approved evidence. Cleanup is a separate owner-approved operation, never automatic.

For users replacing the old native MVP, uninstall the old app first as described on /app. Subsequent updates require the same release certificate and a greater versionCode.

## PWA/server checks

Serve /sw.js as JavaScript at the origin root with no-store/no-cache and Service-Worker-Allowed: /. Do not let nginx SPA fallbacks, authentication redirects or long-lived static-cache rules rewrite it. Serve /manifest.webmanifest with the manifest MIME type; /icons/* and /offline.html are public. CSP explicitly permits worker-src 'self' and manifest-src 'self'. HTTPS is required. Validate iPhone Safari installation, refresh, and offline fallback. No API, uploads or authenticated HTML are stored in the worker cache.
