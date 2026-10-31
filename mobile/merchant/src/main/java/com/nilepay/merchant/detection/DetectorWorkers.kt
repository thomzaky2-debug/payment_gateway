package com.nilepay.merchant.detection

import android.content.Context
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.Constraints
import androidx.work.BackoffPolicy
import androidx.work.OutOfQuotaPolicy
import androidx.work.workDataOf
import com.nilepay.core.network.NetworkFactory
import com.nilepay.merchant.BuildConfig
import com.nilepay.merchant.MerchantSession
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class PaymentUploadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val eventId = inputData.getString("eventId") ?: return Result.failure()
        val dao = DetectionDatabase.get(applicationContext).events()
        val event = dao.find(eventId) ?: return Result.success()
        if (event.needsAttention) return Result.failure()
        val session = MerchantSession(applicationContext)
        if (!session.hasDisclosureConsent || !session.isSignedIn) return Result.failure()
        if (event.createdAt < System.currentTimeMillis() - TimeUnit.DAYS.toMillis(7)) {
            dao.delete(eventId)
            return Result.success()
        }
        val token = session.deviceToken ?: return Result.failure()
        val json = JSONObject()
            .put("amountEgp", event.amountEgp)
            .put("senderHandle", event.senderHandle)
            .put("reference", event.reference)
            .put("notificationTimestamp", event.notificationTimestamp)
            .put("deviceId", event.deviceId)
            .put("appVersion", event.appVersion)
            .put("androidVersion", event.androidVersion)
            .put("eventId", event.eventId)
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/webhooks/instapay")
            .header("Authorization", "Bearer $token")
            .header("X-Instapay-Event-Id", event.eventId)
            .post(json.toString().toRequestBody("application/json".toMediaType()))
            .build()
        return try {
            // Device credentials are independent of the merchant access-token family. Using the
            // authenticated client here would incorrectly try to refresh a merchant token when a
            // device credential is rejected.
            OkHttpClient()
                .newCall(request).execute().use { response ->
                    when {
                        response.isSuccessful -> { dao.delete(eventId); Result.success() }
                        response.code == 429 || response.code >= 500 -> Result.retry()
                        else -> { dao.markAttention(eventId, "HTTP ${response.code}"); Result.failure() }
                    }
                }
        } catch (_: Exception) { Result.retry() }
    }
}

class HeartbeatWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val session = MerchantSession(applicationContext)
        if (!session.isSignedIn || !session.hasDisclosureConsent) return Result.success()
        DetectorKeepAliveService.ensureRunning(applicationContext)
        return if (DetectorWork.sendHeartbeatSync(applicationContext)) Result.success() else Result.retry()
    }
}

object DetectorWork {
    fun sendHeartbeatSync(context: Context): Boolean {
        val appContext = context.applicationContext
        val session = MerchantSession(appContext)
        if (!session.isSignedIn || !session.hasDisclosureConsent) return false
        val body = JSONObject()
            .put("deviceId", session.tokens.getDeviceId())
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("androidVersion", Build.VERSION.RELEASE)
        val request = Request.Builder()
            .url("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/settings/detector/heartbeat")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        return try {
            NetworkFactory.createOkHttpClient(session.tokens, BuildConfig.API_BASE_URL, BuildConfig.DEBUG)
                .newCall(request).execute().use {
                    if (it.isSuccessful) {
                        session.recordHeartbeat()
                        true
                    } else false
                }
        } catch (_: Exception) {
            false
        }
    }

    fun scheduleHeartbeat(context: Context) {
        val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "nilepay-heartbeat",
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    fun heartbeatNow(context: Context) {
        WorkManager.getInstance(context).enqueue(
            OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
        )
    }

    suspend fun retryQueued(context: Context) {
        val dao = DetectionDatabase.get(context).events()
        dao.all().forEach { event ->
            dao.clearAttention(event.eventId)
            val request = OneTimeWorkRequestBuilder<PaymentUploadWorker>()
                .setInputData(workDataOf("eventId" to event.eventId))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                "payment-${event.eventId}", ExistingWorkPolicy.KEEP, request
            )
        }
    }
}
