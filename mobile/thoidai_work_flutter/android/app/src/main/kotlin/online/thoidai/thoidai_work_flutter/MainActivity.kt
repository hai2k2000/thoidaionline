package com.thoidaionline

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.app.PendingIntent
import android.content.Context
import android.app.Notification
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var cameraResult: MethodChannel.Result? = null
    private val cameraRequestCode = 4001
    private val pushChannelId = "thoidai_tasks"
    private var nativeChannel: MethodChannel? = null

    private fun ensurePushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(pushChannelId) != null) return
        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val channel = NotificationChannel(pushChannelId, "Công việc", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Thông báo công việc Thời Đại Work"
            enableVibration(true)
            setSound(sound, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
        }
        manager.createNotificationChannel(channel)
    }

    private fun showTaskNotification(title: String, body: String, url: String?, tag: String): Boolean {
        ensurePushChannel()
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            data = Uri.parse("thoidai-notification://open/${Uri.encode(tag)}")
            putExtra("push_url", url ?: "/my-tasks")
        }
        val pending = PendingIntent.getActivity(this, tag.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, pushChannelId) else Notification.Builder(this)
        val notification = builder
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title.take(160)).setContentText(body.take(500))
            .setStyle(Notification.BigTextStyle().bigText(body.take(500)))
            .setAutoCancel(true).setOnlyAlertOnce(true).setContentIntent(pending).setPriority(Notification.PRIORITY_HIGH)
            .setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
            .setWhen(System.currentTimeMillis()).build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(tag, 0, notification)
        return true
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent.getStringExtra("push_url") ?: return
        nativeChannel?.invokeMethod("notificationOpened", url)
        intent.removeExtra("push_url")
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        ensurePushChannel()
        nativeChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.thoidaionline/native")
        nativeChannel?.setMethodCallHandler { call, result ->
                when (call.method) {
                    "createNotificationChannel" -> { ensurePushChannel(); result.success(true) }
                    "showTaskNotification" -> {
                        try {
                            result.success(showTaskNotification(call.argument<String>("title") ?: "Thông báo mới", call.argument<String>("body") ?: "", call.argument<String>("url"), call.argument<String>("tag") ?: "task"))
                        } catch (_: Exception) { result.success(false) }
                    }
                    "initialNotificationUrl" -> {
                        result.success(intent.getStringExtra("push_url"))
                        intent.removeExtra("push_url")
                    }
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
        nativeChannel?.setMethodCallHandler(null)
        nativeChannel = null
        cameraResult?.success(false)
        cameraResult = null
        super.onDestroy()
    }
}
