package com.nilepay.core.network

import com.nilepay.core.model.AuthTokens
import com.nilepay.core.model.MobileRefreshRequest
import com.nilepay.core.model.MobileRefreshResponse
import com.nilepay.core.storage.TokenStorage
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route

class TokenAuthenticator(
    private val tokenStorage: TokenStorage,
    private val getBaseUrl: () -> String,
    private val refreshClient: OkHttpClient = getSharedRefreshClient(),
    private val onSignOutRequired: ((String) -> Unit)? = null
) : Authenticator {

    companion object {
        private val globalRefreshLock = Any()

        @Volatile
        private var sharedRefreshClientInstance: OkHttpClient? = null

        fun getSharedRefreshClient(): OkHttpClient {
            return sharedRefreshClientInstance ?: synchronized(globalRefreshLock) {
                sharedRefreshClientInstance ?: OkHttpClient.Builder()
                    .connectTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                    .writeTimeout(20, java.util.concurrent.TimeUnit.SECONDS)
                    .build().also { sharedRefreshClientInstance = it }
            }
        }
    }

    private val json = Json { ignoreUnknownKeys = true }
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override fun authenticate(route: Route?, response: Response): Request? {
        val path = response.request.url.encodedPath
        // Do not attempt refresh on auth endpoints to prevent loops
        if (path.contains("/api/auth/mobile/login") || path.contains("/api/auth/mobile/refresh")) {
            return null
        }

        // Limit retry attempts on the same request
        val retryCount = response.request.header("X-NilePay-Retry-Count")?.toIntOrNull() ?: 0
        if (retryCount >= 2) {
            return null
        }

        val failedToken = response.request.header("Authorization")
            ?.removePrefix("Bearer ")
            ?.trim()

        synchronized(globalRefreshLock) {
            val currentToken = tokenStorage.getAccessToken()

            // Single-flight check: if another concurrent thread already refreshed the token
            // while this thread was waiting for the lock, reuse that refreshed token immediately.
            if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .header("X-NilePay-Retry-Count", "${retryCount + 1}")
                    .build()
            }

            val refreshToken = tokenStorage.getRefreshToken()
            if (refreshToken.isNullOrBlank()) {
                tokenStorage.clearTokens()
                onSignOutRequired?.invoke("No refresh token available")
                return null
            }

            val deviceId = tokenStorage.getDeviceId()
            val requestDto = MobileRefreshRequest(
                refreshToken = refreshToken,
                deviceId = deviceId
            )
            val requestBodyString = json.encodeToString(MobileRefreshRequest.serializer(), requestDto)

            val refreshUrl = "${getBaseUrl().trimEnd('/')}/api/auth/mobile/refresh"
            val refreshRequest = Request.Builder()
                .url(refreshUrl)
                .post(requestBodyString.toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .build()

            val refreshResponse = try {
                refreshClient.newCall(refreshRequest).execute()
            } catch (e: Exception) {
                // Network failure or timeout during refresh: DO NOT wipe tokens!
                // Abort this request attempt; subsequent requests can retry refresh.
                return null
            }

            val responseCode = refreshResponse.code
            val bodyString = refreshResponse.body?.string()

            if (refreshResponse.isSuccessful && !bodyString.isNullOrBlank()) {
                val parsed = try {
                    json.decodeFromString(MobileRefreshResponse.serializer(), bodyString)
                } catch (e: Exception) {
                    null
                }

                if (parsed != null && parsed.ok && !parsed.accessToken.isNullOrBlank() && !parsed.refreshToken.isNullOrBlank()) {
                    tokenStorage.saveTokens(
                        AuthTokens(
                            accessToken = parsed.accessToken,
                            accessExpiresAt = parsed.accessExpiresAt.orEmpty(),
                            refreshToken = parsed.refreshToken,
                            refreshExpiresAt = parsed.refreshExpiresAt.orEmpty(),
                            role = parsed.role
                        )
                    )

                    return response.request.newBuilder()
                        .header("Authorization", "Bearer ${parsed.accessToken}")
                        .header("X-NilePay-Retry-Count", "${retryCount + 1}")
                        .build()
                }
            }

            // Only clear tokens if the server explicitly rejected the refresh token as invalid/revoked/expired (401 or 403)
            if (responseCode == 401 || responseCode == 403) {
                tokenStorage.clearTokens()
                onSignOutRequired?.invoke("Token refresh failed with HTTP $responseCode")
                return null
            }

            // For transient errors (429, 500, 502, 503, 504, etc.):
            // DO NOT clear tokens! Return null so this request fails, but session remains intact.
            return null
        }
    }
}
