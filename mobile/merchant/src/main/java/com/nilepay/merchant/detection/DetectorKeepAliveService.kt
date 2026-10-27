package com.nilepay.merchant.detection

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.service.notification.NotificationListenerService
import com.nilepay.merchant.MainActivity
import com.nilepay.merchant.MerchantSession
import com.nilepay.merchant.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class DetectorKeepAliveService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loopJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        running = true
        promoteToForeground()
        startKeepAliveLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            running = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val session = MerchantSession(applicationContext)
        if (!session.isSignedIn || !session.hasDisclosureConsent) {
            running = false
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        running = true
        promoteToForeground()
        ensureNotificationListenerBound(applicationContext)
        startKeepAliveLoop()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val session = MerchantSession(applicationContext)
        if (session.isSignedIn && session.hasDisclosureConsent) {
            ensureNotificationListenerBound(applicationContext)
            scheduleSelfRestart(applicationContext)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        running = false
        loopJob?.cancel()
        serviceScope.cancel()
        val session = MerchantSession(applicationContext)
        if (session.isSignedIn && session.hasDisclosureConsent) {
            scheduleSelfRestart(applicationContext)
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startKeepAliveLoop() {
        if (loopJob?.isActive == true) return
        loopJob = serviceScope.launch {
            while (isActive) {
                val session = MerchantSession(applicationContext)
                if (!session.isSignedIn || !session.hasDisclosureConsent) {
                    stopSelf()
                    break
                }
                ensureNotificationListenerBound(applicationContext)
                DetectorWork.sendHeartbeatSync(applicationContext)
                DetectorWork.retryQueued(applicationContext)
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun promoteToForeground() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.keep_alive_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.keep_alive_channel_desc)
            setShowBadge(false)
            enableLights(false)
            enableVibration(false)
        }
        manager.createNotificationChannel(channel)

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = Notification.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.keep_alive_notification_title))
            .setContentText(getString(R.string.keep_alive_notification_text))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .apply {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE)
                }
            }
            .build()

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Exception) {
            // If Android restricts foreground promotion in a transient state, WorkManager +NLS remain active.
        }
    }

    companion object {
        private const val CHANNEL_ID = "nilepay_detector_keep_alive"
        private const val NOTIFICATION_ID = 4102
        private const val HEARTBEAT_INTERVAL_MS = 90_000L
        private const val ACTION_START = "com.nilepay.merchant.action.START_KEEP_ALIVE"
        private const val ACTION_STOP = "com.nilepay.merchant.action.STOP_KEEP_ALIVE"

        @Volatile
        var running: Boolean = false

        fun ensureRunning(context: Context) {
            val appContext = context.applicationContext
            val session = MerchantSession(appContext)
            if (!session.isSignedIn || !session.hasDisclosureConsent) return
            DetectorWork.scheduleHeartbeat(appContext)
            ensureNotificationListenerBound(appContext)
            val intent = Intent(appContext, DetectorKeepAliveService::class.java).apply {
                action = ACTION_START
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appContext.startForegroundService(intent)
                } else {
                    appContext.startService(intent)
                }
            } catch (_: Exception) {
                // Fallback if background start is temporarily restricted before foreground exemption
                DetectorWork.heartbeatNow(appContext)
            }
        }

        fun stop(context: Context) {
            val appContext = context.applicationContext
            running = false
            try {
                appContext.stopService(Intent(appContext, DetectorKeepAliveService::class.java))
            } catch (_: Exception) {
            }
        }

        fun ensureNotificationListenerBound(context: Context) {
            if (InstaPayNotificationListener.connected) return
            val enabled = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners"
            ).orEmpty()
            val component = ComponentName(context, InstaPayNotificationListener::class.java)
            val hasAccess = enabled.split(':').any { ComponentName.unflattenFromString(it) == component }
            if (hasAccess) {
                try {
                    NotificationListenerService.requestRebind(component)
                } catch (_: Exception) {
                }
            }
        }

        fun isIgnoringBatteryOptimizations(context: Context): Boolean {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
            return pm.isIgnoringBatteryOptimizations(context.packageName)
        }

        fun requestIgnoreBatteryOptimizations(context: Context) {
            try {
                if (!isIgnoringBatteryOptimizations(context)) {
                    val intent = Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:${context.packageName}")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                    return
                }
            } catch (_: Exception) {
            }
            try {
                val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(fallback)
            } catch (_: Exception) {
            }
        }

        private fun scheduleSelfRestart(context: Context) {
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
                val restartIntent = Intent(context, DetectorBootReceiver::class.java).apply {
                    action = DetectorBootReceiver.ACTION_RESTART_DETECTOR
                }
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    4103,
                    restartIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 5_000L,
                    pendingIntent
                )
            } catch (_: Exception) {
            }
        }
    }
}

