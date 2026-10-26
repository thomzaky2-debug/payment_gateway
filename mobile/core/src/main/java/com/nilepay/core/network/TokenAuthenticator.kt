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
    private val refreshClient: OkHttpClient = OkHttpClient.Builder().build(),
    private val onSignOutRequired: ((String) -> Unit)? = null
) : Authenticator {

    private val refreshLock = Any()
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

        synchronized(refreshLock) {
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
                .build()

            val refreshResponse = try {
                refreshClient.newCall(refreshRequest).execute()
            } catch (e: Exception) {
                // Network failure during refresh: do not wipe tokens yet
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

                if (parsed != null && parsed.ok && parsed.accessToken != null && parsed.refreshToken != null) {
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

            // Handle failure cases
            if (responseCode == 429) {
                // Rate limited on refresh: do not invalidate session, return null to stop retries
                return null
            }

            // If 401 or reuse detected or invalid token: sign out completely
            tokenStorage.clearTokens()
            onSignOutRequired?.invoke("Token refresh failed with HTTP $responseCode")
            return null
        }
    }
}
