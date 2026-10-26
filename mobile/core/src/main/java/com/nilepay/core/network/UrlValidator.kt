package com.nilepay.core.network

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object UrlValidator {
    /**
     * Validates that the provided base URL enforces HTTPS.
     * In release builds, cleartext HTTP is strictly rejected.
     */
    fun validateBaseUrl(url: String, isDebug: Boolean = false): String {
        val httpUrl = url.toHttpUrlOrNull()
            ?: throw IllegalArgumentException("Invalid base URL: $url")

        if (!isDebug && httpUrl.scheme != "https") {
            throw IllegalArgumentException(
                "In release builds, NilePay base URL must use HTTPS. Provided: $url"
            )
        }

        return if (url.endsWith("/")) url else "$url/"
    }
}
