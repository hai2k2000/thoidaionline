package com.thoidaionline

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var cameraResult: MethodChannel.Result? = null
    private val cameraRequestCode = 4001

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.thoidaionline/native")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "firebaseConfigured" -> result.success(BuildConfig.FIREBASE_CONFIGURED)
                    "requestCameraPermission" -> {
                        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                            result.success(true)
                        } else if (cameraResult != null) {
                            result.success(false)
                        } else {
                            cameraResult = result
                            requestPermissions(arrayOf(Manifest.permission.CAMERA), cameraRequestCode)
                        }
                    }
                    "canInstallPackages" -> result.success(Build.VERSION.SDK_INT < Build.VERSION_CODES.O || packageManager.canRequestPackageInstalls())
                    "openInstallSettings" -> {
                        try {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                            result.success(null)
                        } catch (_: Exception) {
                            result.error("install_settings_unavailable", "Cannot open install settings", null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == cameraRequestCode) {
            cameraResult?.success(grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED)
            cameraResult = null
        }
    }

    override fun onDestroy() {
        cameraResult?.success(false)
        cameraResult = null
        super.onDestroy()
    }
}
