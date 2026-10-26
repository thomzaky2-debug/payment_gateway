package com.nilepay.core.network

import com.nilepay.core.storage.TokenStorage
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

object NetworkFactory {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
    }

    fun createOkHttpClient(
        tokenStorage: TokenStorage,
        baseUrl: String,
        isDebug: Boolean = false,
        onSignOutRequired: ((String) -> Unit)? = null
    ): OkHttpClient {
        UrlValidator.validateBaseUrl(baseUrl, isDebug)

        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(tokenStorage))
            .authenticator(
                TokenAuthenticator(
                    tokenStorage = tokenStorage,
                    getBaseUrl = { baseUrl },
                    onSignOutRequired = onSignOutRequired
                )
            )

        // Strictly NO logging of headers, bodies or tokens in release builds
        if (isDebug) {
            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }

        return builder.build()
    }

    fun createRetrofit(
        okHttpClient: OkHttpClient,
        baseUrl: String,
        isDebug: Boolean = false
    ): Retrofit {
        val validatedUrl = UrlValidator.validateBaseUrl(baseUrl, isDebug)
        val contentType = "application/json".toMediaType()

        return Retrofit.Builder()
            .baseUrl(validatedUrl)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }
}
