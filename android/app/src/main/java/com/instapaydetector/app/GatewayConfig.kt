package com.instapaydetector.app

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Stores the gateway webhook URL + bearer token (detectToken) + client handle in encrypted
 * SharedPreferences so they aren't readable by other apps.
 *
 * The values must match what the gateway expects:
 *   - URL: https://your-gateway.example.com/api/webhooks/instapay
 *   - Token: the detectToken generated for this client in the Admin console
 *   - Handle: the client's own InstaPay handle (e.g. businessname@instapay)
 */
class GatewayConfig private constructor(ctx: Context) {

    private val prefs by lazy {
        val masterKey = MasterKey.Builder(ctx)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            ctx,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    init {
        // Older builds stored the merchant's server-to-server API key for
        // dashboard calls. It is no longer a valid mobile credential.
        prefs.edit().remove(LEGACY_KEY_DASHBOARD_API_KEY).apply()
    }

    var serverBaseUrl: String
        get() {
            val saved = prefs.getString(KEY_SERVER_BASE_URL, "") ?: ""
            if (saved.isNotEmpty()) return saved
            val currentGw = gatewayUrl
            return if (currentGw.contains("/api/webhooks/instapay")) {
                currentGw.replace("/api/webhooks/instapay", "")
            } else {
                DEFAULT_SERVER_BASE_URL
            }
        }
        set(value) {
            val normalized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_SERVER_BASE_URL, normalized).apply()
            gatewayUrl = "$normalized/api/webhooks/instapay"
        }

    var gatewayUrl: String
        get() = prefs.getString(KEY_URL, DEFAULT_URL) ?: DEFAULT_URL
        set(value) {
            val normalized = value.trim().trimEnd('/')
            prefs.edit().putString(KEY_URL, normalized).apply()
        }

    var authToken: String
        get() = prefs.getString(KEY_TOKEN, DEFAULT_TOKEN) ?: DEFAULT_TOKEN
        set(value) {
            prefs.edit().putString(KEY_TOKEN, value.trim()).apply()
        }

    var merchantSessionToken: String
        get() = prefs.getString(KEY_MERCHANT_SESSION_TOKEN, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_SESSION_TOKEN, value.trim()).apply()
        }

    var merchantHandle: String
        get() = prefs.getString(KEY_MERCHANT_HANDLE, DEFAULT_MERCHANT_HANDLE) ?: DEFAULT_MERCHANT_HANDLE
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_HANDLE, value.trim().lowercase()).apply()
        }

    var merchantBusinessName: String
        get() = prefs.getString(KEY_MERCHANT_BUSINESS_NAME, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_BUSINESS_NAME, value.trim()).apply()
        }

    var merchantEmail: String
        get() = prefs.getString(KEY_MERCHANT_EMAIL, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_EMAIL, value.trim().lowercase()).apply()
        }

    var merchantWebhookUrl: String
        get() = prefs.getString(KEY_MERCHANT_WEBHOOK_URL, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_WEBHOOK_URL, value.trim()).apply()
        }

    var merchantPaymentUrl: String
        get() = prefs.getString(KEY_MERCHANT_PAYMENT_URL, "") ?: ""
        set(value) {
            prefs.edit().putString(KEY_MERCHANT_PAYMENT_URL, value.trim()).apply()
        }

    var subscriptionPlan: String
        get() = prefs.getString(KEY_SUBSCRIPTION_PLAN, "FREE_TRIAL") ?: "FREE_TRIAL"
        set(value) {
            prefs.edit().putString(KEY_SUBSCRIPTION_PLAN, value.trim()).apply()
        }

    var subscriptionEndsAt: String?
        get() = prefs.getString(KEY_SUBSCRIPTION_ENDS_AT, null)
        set(value) {
            prefs.edit().putString(KEY_SUBSCRIPTION_ENDS_AT, value?.trim()).apply()
        }

    var isLoggedIn: Boolean
        get() = prefs.getBoolean(KEY_IS_LOGGED_IN, false)
        set(value) {
            prefs.edit().putBoolean(KEY_IS_LOGGED_IN, value).apply()
        }

    var pendingVerificationId: String
        get() = prefs.getString(KEY_PENDING_VERIFICATION, "") ?: ""
        set(value) { prefs.edit().putString(KEY_PENDING_VERIFICATION, value).apply() }

    fun syncFromMerchant(merchant: MerchantInfo, subscription: SubscriptionInfo? = null) {
        val editor = prefs.edit()
        if (merchant.handle.isNotBlank() && merchant.handle != "All Clients") {
            editor.putString(KEY_MERCHANT_HANDLE, merchant.handle.trim().lowercase())
        }
        if (merchant.name.isNotBlank() && merchant.name != "Platform Overview") {
            editor.putString(KEY_MERCHANT_BUSINESS_NAME, merchant.name.trim())
        }
        if (merchant.email.isNotBlank()) {
            editor.putString(KEY_MERCHANT_EMAIL, merchant.email.trim().lowercase())
        }
        if (merchant.webhookUrl != null) {
            editor.putString(KEY_MERCHANT_WEBHOOK_URL, merchant.webhookUrl.trim())
        }
        if (merchant.instapayPaymentUrl != null) {
            editor.putString(KEY_MERCHANT_PAYMENT_URL, merchant.instapayPaymentUrl.trim())
        }
        if (!merchant.detectToken.isNullOrBlank()) {
            editor.putString(KEY_TOKEN, merchant.detectToken.trim())
        }
        if (subscription != null) {
            editor.putString(KEY_SUBSCRIPTION_PLAN, subscription.plan.trim())
            editor.putString(KEY_SUBSCRIPTION_ENDS_AT, subscription.subscriptionEndsAt?.trim())
        }
        editor.apply()
    }

    companion object {
        private const val FILE_NAME = "gateway_config.xml"
        private const val KEY_SERVER_BASE_URL = "server_base_url"
        private const val KEY_URL = "gateway_url"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_MERCHANT_SESSION_TOKEN = "merchant_session_token"
        private const val LEGACY_KEY_DASHBOARD_API_KEY = "dashboard_api_key"
        private const val KEY_MERCHANT_HANDLE = "merchant_handle"
        private const val KEY_MERCHANT_BUSINESS_NAME = "merchant_business_name"
        private const val KEY_MERCHANT_EMAIL = "merchant_email"
        private const val KEY_MERCHANT_WEBHOOK_URL = "merchant_webhook_url"
        private const val KEY_MERCHANT_PAYMENT_URL = "merchant_payment_url"
        private const val KEY_SUBSCRIPTION_PLAN = "subscription_plan"
        private const val KEY_SUBSCRIPTION_ENDS_AT = "subscription_ends_at"
        private const val KEY_IS_LOGGED_IN = "is_logged_in"
        private const val KEY_PENDING_VERIFICATION = "pending_verification"

        private val DEFAULT_SERVER_BASE_URL = BuildConfig.GATEWAY_BASE_URL.trimEnd('/')
        private val DEFAULT_URL = "$DEFAULT_SERVER_BASE_URL/api/webhooks/instapay"
        private const val DEFAULT_TOKEN = ""
        private const val DEFAULT_MERCHANT_HANDLE = "merchant@instapay"

        @Volatile
        private var instance: GatewayConfig? = null

        fun get(ctx: Context): GatewayConfig =
            instance ?: synchronized(this) {
                instance ?: GatewayConfig(ctx.applicationContext).also { instance = it }
            }
    }
}
