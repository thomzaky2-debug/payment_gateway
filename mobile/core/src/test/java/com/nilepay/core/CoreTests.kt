package com.nilepay.core

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.nilepay.core.model.AuthTokens
import com.nilepay.core.model.NilePayError
import com.nilepay.core.network.AuthInterceptor
import com.nilepay.core.network.TokenAuthenticator
import com.nilepay.core.network.UrlValidator
import com.nilepay.core.security.KeystoreCryptoManager
import com.nilepay.core.storage.EncryptedTokenStorage
import com.nilepay.core.storage.TokenStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class CoreTests {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var context: Context
    private lateinit var tokenStorage: TokenStorage

    @Before
    fun setup() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
        context = ApplicationProvider.getApplicationContext()
        tokenStorage = EncryptedTokenStorage(
            context = context,
            cryptoManager = KeystoreCryptoManager(),
            preferencesName = "test_tokens_${UUID.randomUUID()}"
        )
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun testTokenStorageRoundTrip() {
        val tokens = AuthTokens(
            accessToken = "initial_access_token_12345",
            accessExpiresAt = "2026-10-27T00:00:00.000Z",
            refreshToken = "rt_mch_abcdef1234567890",
            refreshExpiresAt = "2026-11-26T00:00:00.000Z",
            role = "merchant"
        )

        tokenStorage.saveTokens(tokens)

        assertEquals("initial_access_token_12345", tokenStorage.getAccessToken())
        assertEquals("rt_mch_abcdef1234567890", tokenStorage.getRefreshToken())
        assertTrue(tokenStorage.hasValidSession())

        val deviceId1 = tokenStorage.getDeviceId()
        assertNotNull(deviceId1)
        assertTrue(deviceId1.isNotEmpty())

        // Re-querying deviceId returns the exact same generated UUID
        val deviceId2 = tokenStorage.getDeviceId()
        assertEquals(deviceId1, deviceId2)

        // Clear tokens removes tokens but preserves deviceId
        tokenStorage.clearTokens()
        assertNull(tokenStorage.getAccessToken())
        assertNull(tokenStorage.getRefreshToken())
        assertFalse(tokenStorage.hasValidSession())
        assertEquals(deviceId1, tokenStorage.getDeviceId())
    }

    @Test
    fun testSingleFlightRefreshUnderConcurrency() = runBlocking {
        tokenStorage.saveTokens(
            AuthTokens(
                accessToken = "expired_token",
                accessExpiresAt = "2026-10-26T00:00:00.000Z",
                refreshToken = "valid_refresh_token",
                refreshExpiresAt = "2026-11-26T00:00:00.000Z"
            )
        )

        val refreshCounter = AtomicInteger(0)
        val serverUrl = mockWebServer.url("/").toString()

        mockWebServer.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path ?: ""
                val authHeader = request.getHeader("Authorization")

                return when {
                    path == "/api/auth/mobile/refresh" -> {
                        refreshCounter.incrementAndGet()
                        Thread.sleep(80) // Simulate network latency so concurrent requests hit
                        MockResponse()
                            .setResponseCode(200)
                            .setHeader("Content-Type", "application/json")
                            .setBody(
                                """
                                {
                                  "ok": true,
                                  "role": "merchant",
                                  "accessToken": "fresh_access_token_777",
                                  "accessExpiresAt": "2026-10-27T00:00:00.000Z",
                                  "refreshToken": "fresh_refresh_token_888",
                                  "refreshExpiresAt": "2026-11-27T00:00:00.000Z"
                                }
                                """.trimIndent()
                            )
                    }
                    path == "/api/transactions" -> {
                        if (authHeader == "Bearer fresh_access_token_777") {
                            MockResponse().setResponseCode(200).setBody("""{"ok":true,"count":5}""")
                        } else {
                            MockResponse().setResponseCode(401).setBody("""{"ok":false,"error":"Token expired"}""")
                        }
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStorage))
            .authenticator(TokenAuthenticator(tokenStorage, { serverUrl }))
            .build()

        // Launch 10 concurrent requests simultaneously
        val deferredList = (1..10).map {
            async(Dispatchers.IO) {
                val req = Request.Builder()
                    .url(mockWebServer.url("/api/transactions"))
                    .build()
                client.newCall(req).execute()
            }
        }

        val responses = deferredList.awaitAll()

        // All requests should succeed with HTTP 200 after refresh
        responses.forEach { resp ->
            assertEquals(200, resp.code)
            resp.close()
        }

        // Single-flight guarantee: exactly ONE refresh call made despite 10 concurrent 401s!
        assertEquals(1, refreshCounter.get())
        assertEquals("fresh_access_token_777", tokenStorage.getAccessToken())
        assertEquals("fresh_refresh_token_888", tokenStorage.getRefreshToken())
    }

    @Test
    fun testRefreshReuseFailureLeadingToSignOut() {
        tokenStorage.saveTokens(
            AuthTokens(
                accessToken = "expired_token",
                accessExpiresAt = "2026-10-26T00:00:00.000Z",
                refreshToken = "reused_refresh_token",
                refreshExpiresAt = "2026-11-26T00:00:00.000Z"
            )
        )

        var signOutCalled = false
        var signOutReason: String? = null

        val serverUrl = mockWebServer.url("/").toString()

        mockWebServer.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/auth/mobile/refresh" -> {
                        MockResponse()
                            .setResponseCode(401)
                            .setHeader("Content-Type", "application/json")
                            .setBody(
                                """
                                {
                                  "ok": false,
                                  "error": "Refresh token has already been used or expired. Session family revoked.",
                                  "familyRevoked": true
                                }
                                """.trimIndent()
                            )
                    }
                    "/api/protected" -> {
                        MockResponse().setResponseCode(401).setBody("""{"ok":false,"error":"Unauthorized"}""")
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStorage))
            .authenticator(
                TokenAuthenticator(
                    tokenStorage = tokenStorage,
                    getBaseUrl = { serverUrl },
                    onSignOutRequired = { reason ->
                        signOutCalled = true
                        signOutReason = reason
                    }
                )
            )
            .build()

        val req = Request.Builder().url(mockWebServer.url("/api/protected")).build()
        val resp = client.newCall(req).execute()

        assertEquals(401, resp.code)
        resp.close()

        // Verification: Tokens wiped and sign out callback triggered
        assertTrue("Expected signOut to be called", signOutCalled)
        assertNull(tokenStorage.getAccessToken())
        assertNull(tokenStorage.getRefreshToken())
    }

    @Test
    fun testRateLimit429Handling() {
        tokenStorage.saveTokens(
            AuthTokens(
                accessToken = "expired_token",
                accessExpiresAt = "2026-10-26T00:00:00.000Z",
                refreshToken = "current_refresh_token",
                refreshExpiresAt = "2026-11-26T00:00:00.000Z"
            )
        )

        var signOutCalled = false
        val serverUrl = mockWebServer.url("/").toString()

        mockWebServer.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/auth/mobile/refresh" -> {
                        MockResponse()
                            .setResponseCode(429)
                            .setHeader("Retry-After", "60")
                            .setBody("""{"ok":false,"error":"Too many token refresh attempts."}""")
                    }
                    "/api/orders" -> {
                        MockResponse().setResponseCode(401).setBody("""{"ok":false,"error":"Invalid token"}""")
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStorage))
            .authenticator(
                TokenAuthenticator(
                    tokenStorage = tokenStorage,
                    getBaseUrl = { serverUrl },
                    onSignOutRequired = { signOutCalled = true }
                )
            )
            .build()

        val req = Request.Builder().url(mockWebServer.url("/api/orders")).build()
        val resp = client.newCall(req).execute()

        assertEquals(401, resp.code)
        resp.close()

        // Crucial: 429 should NOT destroy session or trigger sign-out
        assertFalse("Sign out should not be triggered on 429 rate limit", signOutCalled)
        assertEquals("current_refresh_token", tokenStorage.getRefreshToken())
    }

    @Test
    fun testServerErrorDoesNotDestroySession() {
        tokenStorage.saveTokens(
            AuthTokens(
                accessToken = "expired_token",
                accessExpiresAt = "2026-10-26T00:00:00.000Z",
                refreshToken = "valid_refresh_token",
                refreshExpiresAt = "2026-11-26T00:00:00.000Z"
            )
        )

        var signOutCalled = false
        val serverUrl = mockWebServer.url("/").toString()

        mockWebServer.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                return when (request.path) {
                    "/api/auth/mobile/refresh" -> {
                        MockResponse()
                            .setResponseCode(502)
                            .setHeader("Content-Type", "text/html")
                            .setBody("<html><body>Bad Gateway</body></html>")
                    }
                    "/api/orders" -> {
                        MockResponse().setResponseCode(401).setBody("""{"ok":false,"error":"Invalid token"}""")
                    }
                    else -> MockResponse().setResponseCode(404)
                }
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStorage))
            .authenticator(
                TokenAuthenticator(
                    tokenStorage = tokenStorage,
                    getBaseUrl = { serverUrl },
                    onSignOutRequired = { signOutCalled = true }
                )
            )
            .build()

        val req = Request.Builder().url(mockWebServer.url("/api/orders")).build()
        val resp = client.newCall(req).execute()

        assertEquals(401, resp.code)
        resp.close()

        // 5xx bad gateway / server restart must NOT destroy session
        assertFalse("Sign out must not be triggered on 5xx server error", signOutCalled)
        assertEquals("valid_refresh_token", tokenStorage.getRefreshToken())
    }

    @Test
    fun testUrlValidatorHttpsEnforcement() {
        // HTTP allowed in debug
        val debugUrl = UrlValidator.validateBaseUrl("http://10.0.2.2:3000", isDebug = true)
        assertEquals("http://10.0.2.2:3000/", debugUrl)

        // HTTPS allowed in release
        val prodUrl = UrlValidator.validateBaseUrl("https://api.nilepay.com", isDebug = false)
        assertEquals("https://api.nilepay.com/", prodUrl)

        // Cleartext HTTP rejected in release
        var threw = false
        try {
            UrlValidator.validateBaseUrl("http://api.nilepay.com", isDebug = false)
        } catch (_: IllegalArgumentException) {
            threw = true
        }
        assertTrue("Expected IllegalArgumentException for cleartext HTTP in release", threw)
    }

    @Test
    fun testNilePayErrorMapping() {
        val err401 = NilePayError.parseFromHttp(401, """{"error":"Invalid credentials"}""")
        assertTrue(err401 is NilePayError.Unauthorized)
        assertEquals("Invalid credentials", err401.message)

        val err401Family = NilePayError.parseFromHttp(401, """{"error":"Reused","familyRevoked":true}""")
        assertTrue((err401Family as NilePayError.Unauthorized).familyRevoked)

        val err403 = NilePayError.parseFromHttp(403, """{"error":"Account pending approval"}""")
        assertTrue(err403 is NilePayError.Forbidden)

        val err409 = NilePayError.parseFromHttp(409, """{"error":"Conflict detected"}""")
        assertTrue(err409 is NilePayError.Conflict)

        val err429 = NilePayError.parseFromHttp(429, """{"error":"Too many requests"}""", retryAfterHeader = "30")
        assertTrue(err429 is NilePayError.RateLimited)
        assertEquals(30L, (err429 as NilePayError.RateLimited).retryAfterSeconds)

        val err500 = NilePayError.parseFromHttp(500, """{"error":"Internal error"}""")
        assertTrue(err500 is NilePayError.ServerError)
    }
}
