package com.nilepay.core.storage

import android.content.Context
import android.content.SharedPreferences
import com.nilepay.core.model.AuthTokens
import com.nilepay.core.security.CryptoManager
import com.nilepay.core.security.KeystoreCryptoManager
import java.util.UUID

interface TokenStorage {
    fun getAccessToken(): String?
    fun setAccessToken(token: String?)
    fun getRefreshToken(): String?
    fun setRefreshToken(token: String?)
    fun getDeviceId(): String
    fun saveTokens(tokens: AuthTokens)
    fun clearTokens()
    fun hasValidSession(): Boolean
}

class EncryptedTokenStorage(
    private val context: Context,
    private val cryptoManager: CryptoManager = KeystoreCryptoManager(),
    private val preferencesName: String = "nilepay_secure_tokens"
) : TokenStorage {

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
    }

    private companion object {
        private const val KEY_ACCESS_TOKEN = "enc_access_token"
        private const val KEY_REFRESH_TOKEN = "enc_refresh_token"
        private const val KEY_DEVICE_ID = "enc_device_id"
        private const val KEY_ROLE = "enc_role"
    }

    @Synchronized
    override fun getAccessToken(): String? {
        val encrypted = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return null
        return cryptoManager.decrypt(encrypted)
    }

    @Synchronized
    override fun setAccessToken(token: String?) {
        if (token == null) {
            prefs.edit().remove(KEY_ACCESS_TOKEN).apply()
        } else {
            val encrypted = cryptoManager.encrypt(token)
            prefs.edit().putString(KEY_ACCESS_TOKEN, encrypted).apply()
        }
    }

    @Synchronized
    override fun getRefreshToken(): String? {
        val encrypted = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return null
        return cryptoManager.decrypt(encrypted)
    }

    @Synchronized
    override fun setRefreshToken(token: String?) {
        if (token == null) {
            prefs.edit().remove(KEY_REFRESH_TOKEN).apply()
        } else {
            val encrypted = cryptoManager.encrypt(token)
            prefs.edit().putString(KEY_REFRESH_TOKEN, encrypted).apply()
        }
    }

    /**
     * Generates a random UUIDv4 once and stores it encrypted.
     * Never uses ANDROID_ID, IMEI, or advertising ID.
     */
    @Synchronized
    override fun getDeviceId(): String {
        val existingEncrypted = prefs.getString(KEY_DEVICE_ID, null)
        if (existingEncrypted != null) {
            val decrypted = cryptoManager.decrypt(existingEncrypted)
            if (!decrypted.isNullOrBlank()) {
                return decrypted
            }
        }

        val newDeviceId = UUID.randomUUID().toString()
        val encrypted = cryptoManager.encrypt(newDeviceId)
        prefs.edit().putString(KEY_DEVICE_ID, encrypted).apply()
        return newDeviceId
    }

    @Synchronized
    override fun saveTokens(tokens: AuthTokens) {
        val encAccess = cryptoManager.encrypt(tokens.accessToken)
        val encRefresh = cryptoManager.encrypt(tokens.refreshToken)
        val editor = prefs.edit()
            .putString(KEY_ACCESS_TOKEN, encAccess)
            .putString(KEY_REFRESH_TOKEN, encRefresh)

        if (tokens.role != null) {
            editor.putString(KEY_ROLE, cryptoManager.encrypt(tokens.role))
        }
        editor.apply()
    }

    @Synchronized
    override fun clearTokens() {
        // Clear auth tokens while preserving the bound deviceId
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_ROLE)
            .apply()
    }

    @Synchronized
    override fun hasValidSession(): Boolean {
        return getAccessToken() != null && getRefreshToken() != null
    }
}
