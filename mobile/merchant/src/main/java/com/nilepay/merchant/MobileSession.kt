package com.nilepay.merchant

import android.content.Context
import android.os.Build
import com.nilepay.core.model.AuthTokens
import com.nilepay.core.security.KeystoreCryptoManager
import com.nilepay.core.storage.EncryptedTokenStorage
import com.nilepay.core.network.NetworkFactory
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

sealed interface LoginResult {
    data class OtpRequired(val verificationId: String, val expiresInSeconds: Int) : LoginResult
    data class SignedIn(val businessName: String, val email: String) : LoginResult
}

data class DashboardSnapshot(
    val todayTotalEgp: Double,
    val todayCount: Int,
    val pendingCount: Int,
    val quotaCount: Int,
    val quotaLimit: Int
)

data class MerchantPayment(
    val id: String,
    val sessionId: String,
    val sender: String,
    val amountEgp: Double,
    val status: String,
    val createdAt: String,
    val reference: String?,
    val note: String?,
    val expectedAmountEgp: Double? = null,
    val receivedAmountEgp: Double? = null,
    val expiresAt: String? = null,
    val source: String = "checkout",
    val productCategory: String? = null
)

data class PaymentPage(val payments: List<MerchantPayment>, val nextCursor: String?)
data class MerchantProfile(val businessName: String, val email: String, val imageData: String?)

data class MobileConfig(val updateRequired: Boolean, val minimumVersion: String, val message: String?)

class MerchantSession(context: Context) {
    private val appContext = context.applicationContext
    val tokens = EncryptedTokenStorage(appContext)
    private val crypto = KeystoreCryptoManager()
    private val prefs = appContext.getSharedPreferences("nilepay_merchant_secure", Context.MODE_PRIVATE)
    private val statePrefs = appContext.getSharedPreferences("nilepay_merchant_state", Context.MODE_PRIVATE)

    val isSignedIn: Boolean get() = tokens.hasValidSession()
    val hasDisclosureConsent: Boolean get() = statePrefs.getInt("disclosure_version", 0) == 2 && statePrefs.getLong("disclosure_consent_at", 0L) > 0L
    val businessName: String get() = decrypt("business_name") ?: ""
    val merchantEmail: String get() = decrypt("merchant_email") ?: ""
    val deviceToken: String? get() = decrypt("device_token")
    val lastHeartbeatAt: Long get() = statePrefs.getLong("last_heartbeat_at", 0L)
    val lastDetectedAt: Long get() = statePrefs.getLong("last_detected_at", 0L)

    fun saveSignedIn(authTokens: AuthTokens, deviceToken: String, businessName: String, email: String) {
        tokens.saveTokens(authTokens)
        prefs.edit()
            .putString("device_token", crypto.encrypt(deviceToken))
            .putString("business_name", crypto.encrypt(businessName))
            .putString("merchant_email", crypto.encrypt(email))
            .apply()
    }

    fun recordConsent() {
        statePrefs.edit().putInt("disclosure_version", 2).putLong("disclosure_consent_at", System.currentTimeMillis()).apply()
    }

    fun recordHeartbeat() = statePrefs.edit().putLong("last_heartbeat_at", System.currentTimeMillis()).apply()
    fun recordDetection() = statePrefs.edit().putLong("last_detected_at", System.currentTimeMillis()).apply()

    fun signOut() {
        statePrefs.edit().clear().apply()
        tokens.clearTokens()
        prefs.edit().clear().apply()
    }

    private fun decrypt(key: String): String? = prefs.getString(key, null)?.let(crypto::decrypt)
}

class MobileGatewayClient(
    private val session: MerchantSession,
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/')
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    fun login(email: String, password: String, verificationId: String? = null, otp: String? = null): LoginResult {
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("deviceId", session.tokens.getDeviceId())
            .put("appType", "merchant")
        if (!verificationId.isNullOrBlank()) body.put("verificationId", verificationId)
        if (!otp.isNullOrBlank()) body.put("otp", otp)

        val response = post("/api/auth/mobile/login", body)
        if (response.optBoolean("otpRequired")) {
            return LoginResult.OtpRequired(
                verificationId = response.getString("verificationId"),
                expiresInSeconds = response.optInt("expiresInSeconds", 600)
            )
        }

        val accessToken = response.optString("accessToken")
        val refreshToken = response.optString("refreshToken")
        if (accessToken.isBlank() || refreshToken.isBlank()) error("Invalid login response")
        val merchant = response.optJSONObject("client") ?: error("Merchant profile was not returned")
        val deviceToken = enroll(accessToken)
        val name = merchant.optString("businessName", email.substringBefore('@'))
        val returnedEmail = merchant.optString("email", email)
        session.saveSignedIn(
            AuthTokens(
                accessToken = accessToken,
                accessExpiresAt = response.optString("accessExpiresAt"),
                refreshToken = refreshToken,
                refreshExpiresAt = response.optString("refreshExpiresAt"),
                role = "merchant"
            ),
            deviceToken = deviceToken,
            businessName = name,
            email = returnedEmail
        )
        return LoginResult.SignedIn(name, returnedEmail)
    }

    fun profile(): MerchantProfile {
        val request = Request.Builder().url("$baseUrl/api/mobile/profile").get().build()
        authenticatedClient().newCall(request).execute().use { response ->
            val parsed = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrElse { JSONObject() }
            if (!response.isSuccessful) error("Profile request failed (${response.code})")
            val profile = parsed.getJSONObject("profile")
            return MerchantProfile(profile.optString("businessName"), profile.optString("email"), profile.optString("profileImageData").takeIf { it.isNotBlank() && it != "null" })
        }
    }

    fun dashboard(): DashboardSnapshot {
        val request = Request.Builder().url("$baseUrl/api/transactions/stats").get().build()
        val authenticatedClient = NetworkFactory.createOkHttpClient(
            tokenStorage = session.tokens,
            baseUrl = "$baseUrl/",
            isDebug = BuildConfig.DEBUG
        )
        authenticatedClient.newCall(request).execute().use { response ->
            val parsed = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrElse { JSONObject() }
            if (!response.isSuccessful) error(parsed.optString("error").ifBlank { "Dashboard request failed (${response.code})" })
            val stats = parsed.getJSONObject("stats")
            val today = stats.getJSONObject("today")
            val pending = stats.getJSONObject("pending")
            val quota = stats.getJSONObject("quota")
            return DashboardSnapshot(
                todayTotalEgp = today.optDouble("totalEgp", 0.0),
                todayCount = today.optInt("count", 0),
                pendingCount = pending.optInt("count", 0),
                quotaCount = quota.optInt("count", 0),
                quotaLimit = quota.optInt("limit", 0)
            )
        }
    }

    fun recentPayments(): List<MerchantPayment> = paymentPage(limit = 20).payments

    fun paymentPage(status: String = "ALL", search: String = "", cursor: String? = null, limit: Int = 30): PaymentPage {
        // Build from the validated runtime base URL to retain staging support.
        val paymentUrl = "$baseUrl/api/mobile/payments".toHttpUrl().newBuilder()
            .addQueryParameter("status", status).addQueryParameter("search", search)
            .addQueryParameter("limit", limit.toString()).apply { cursor?.let { addQueryParameter("cursor", it) } }.build()
        val request = Request.Builder().url(paymentUrl).get().build()
        authenticatedClient().newCall(request).execute().use { response ->
            val parsed = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrElse { JSONObject() }
            if (!response.isSuccessful) error(parsed.optString("error").ifBlank { "Payments request failed (${response.code})" })
            val rows = parsed.optJSONArray("payments") ?: error("Invalid payments response")
            val payments = (0 until rows.length()).map { index ->
                val item = rows.getJSONObject(index)
                MerchantPayment(
                    id = item.optString("id"),
                    sessionId = item.optString("sessionId"),
                    sender = item.optString("senderHandle").ifBlank { "Unknown sender" },
                    amountEgp = item.optDouble("amountEgp", 0.0),
                    status = item.optString("status", "UNKNOWN"),
                    createdAt = item.optString("createdAt"),
                    reference = item.optString("detectedRef").takeIf { it.isNotBlank() && it != "null" },
                    note = item.optString("note").takeIf { it.isNotBlank() && it != "null" },
                    expectedAmountEgp = if (item.isNull("expectedAmountEgp")) null else item.optDouble("expectedAmountEgp"),
                    receivedAmountEgp = if (item.isNull("receivedAmountEgp")) null else item.optDouble("receivedAmountEgp"),
                    expiresAt = item.optString("expiresAt").takeIf { it.isNotBlank() && it != "null" },
                    source = item.optString("source", "checkout"),
                    productCategory = item.optString("productCategory").takeIf { it.isNotBlank() && it != "null" }
                )
            }
            return PaymentPage(payments, parsed.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" })
        }
    }

    fun mobileConfig(): MobileConfig {
        val request = Request.Builder()
            .url("$baseUrl/api/mobile/config?app=merchant&version=${BuildConfig.VERSION_NAME}")
            .get().build()
        client.newCall(request).execute().use { response ->
            val parsed = runCatching { JSONObject(response.body?.string().orEmpty()) }.getOrElse { JSONObject() }
            if (!response.isSuccessful) error("Configuration request failed (${response.code})")
            return MobileConfig(
                updateRequired = parsed.optBoolean("updateRequired"),
                minimumVersion = parsed.optJSONObject("minVersions")?.optString("merchant", BuildConfig.VERSION_NAME)
                    ?: BuildConfig.VERSION_NAME,
                message = parsed.optString("message").takeIf { it.isNotBlank() }
            )
        }
    }

    fun logout() {
        val body = JSONObject().put("refreshToken", session.tokens.getRefreshToken())
        runCatching { post("/api/auth/mobile/logout", body, session.tokens.getAccessToken()) }
        session.signOut()
    }

    private fun authenticatedClient() = NetworkFactory.createOkHttpClient(
        tokenStorage = session.tokens,
        baseUrl = "$baseUrl/",
        isDebug = BuildConfig.DEBUG
    )

    private fun enroll(accessToken: String): String {
        val body = JSONObject()
            .put("deviceId", session.tokens.getDeviceId())
            .put("name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("androidVersion", Build.VERSION.RELEASE)
        return post("/api/mobile/devices/enroll", body, accessToken).optString("deviceToken")
            .takeIf { it.isNotBlank() } ?: error("Device enrollment did not return a credential")
    }

    private fun post(path: String, body: JSONObject, bearer: String? = null): JSONObject {
        val requestBuilder = Request.Builder()
            .url("$baseUrl$path")
            .post(body.toString().toRequestBody(jsonMedia))
            .header("Accept", "application/json")
        if (!bearer.isNullOrBlank()) requestBuilder.header("Authorization", "Bearer $bearer")
        client.newCall(requestBuilder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val parsed = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
            if (!response.isSuccessful || parsed.optBoolean("ok", true).not()) {
                error(parsed.optString("error").ifBlank { "Request failed (${response.code})" })
            }
            return parsed
        }
    }
}
