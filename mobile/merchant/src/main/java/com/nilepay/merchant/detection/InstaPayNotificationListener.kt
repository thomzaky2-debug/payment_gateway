package com.nilepay.merchant.detection

import android.app.Notification
import android.content.Context
import android.os.PowerManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.WorkManager
import androidx.work.workDataOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class InstaPayNotificationListener : NotificationListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onListenerConnected() {
        connected = true
        DetectorKeepAliveService.ensureRunning(this)
        super.onListenerConnected()
    }

    override fun onListenerDisconnected() {
        connected = false
        requestRebind(android.content.ComponentName(this, javaClass))
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || sbn.packageName != InstaPayParser.INSTAPAY_PACKAGE) return
        val session = com.nilepay.merchant.MerchantSession(this)
        if (!session.hasDisclosureConsent || !session.isSignedIn || session.deviceToken.isNullOrBlank()) return
        val extras = sbn.notification?.extras ?: return
        val text = listOfNotNull(
            extras.getCharSequence(Notification.EXTRA_TITLE),
            extras.getCharSequence(Notification.EXTRA_TEXT),
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ).joinToString(" ")
        val parsed = InstaPayParser.parse(text) ?: return
        val eventId = InstaPayParser.eventId(sbn.packageName, sbn.postTime, sbn.key)
        val wakeLock = (getSystemService(Context.POWER_SERVICE) as? PowerManager)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NilePay:PaymentDetectorWakeLock")
            ?.apply { setReferenceCounted(false) }
        try {
            wakeLock?.acquire(10_000L)
        } catch (_: Exception) {
        }
        scope.launch {
            try {
                val session = com.nilepay.merchant.MerchantSession(this@InstaPayNotificationListener)
                if (!session.hasDisclosureConsent || !session.isSignedIn || session.deviceToken.isNullOrBlank()) return@launch
                session.recordDetection()
                val dao = DetectionDatabase.get(this@InstaPayNotificationListener).events()
                dao.deleteOlderThan(System.currentTimeMillis() - TimeUnit.DAYS.toMillis(7))
                val overflow = dao.count() - 499
                if (overflow > 0) dao.deleteOldest(overflow)
                val inserted = dao.insert(
                    PendingPaymentEvent(
                        eventId = eventId,
                        amountEgp = parsed.amountEgp,
                        senderHandle = parsed.senderHandle,
                        reference = parsed.reference,
                        notificationTimestamp = InstaPayParser.timestamp(sbn.postTime),
                        deviceId = session.tokens.getDeviceId(),
                        appVersion = com.nilepay.merchant.BuildConfig.VERSION_NAME,
                        androidVersion = android.os.Build.VERSION.RELEASE
                    )
                )
                if (inserted != -1L) enqueueUpload(eventId)
            } finally {
                try {
                    if (wakeLock?.isHeld == true) wakeLock.release()
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun enqueueUpload(eventId: String) {
        val request = OneTimeWorkRequestBuilder<PaymentUploadWorker>()
            .setInputData(workDataOf("eventId" to eventId))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(this).enqueueUniqueWork("payment-$eventId", ExistingWorkPolicy.KEEP, request)
    }

    companion object { @Volatile var connected: Boolean = false }
}
