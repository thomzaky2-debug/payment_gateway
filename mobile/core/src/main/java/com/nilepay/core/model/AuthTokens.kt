package com.nilepay.core.model

import kotlinx.serialization.Serializable

@Serializable
data class AuthTokens(
    val accessToken: String,
    val accessExpiresAt: String,
    val refreshToken: String,
    val refreshExpiresAt: String,
    val role: String? = null
)

@Serializable
data class MobileRefreshRequest(
    val refreshToken: String,
    val deviceId: String
)

@Serializable
data class MobileRefreshResponse(
    val ok: Boolean,
    val role: String? = null,
    val accessToken: String? = null,
    val accessExpiresAt: String? = null,
    val refreshToken: String? = null,
    val refreshExpiresAt: String? = null,
    val error: String? = null,
    val familyRevoked: Boolean? = null
)
