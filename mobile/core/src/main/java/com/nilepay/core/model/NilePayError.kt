package com.nilepay.core.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable
sealed class NilePayError : Exception() {
    abstract override val message: String

    data class Unauthorized(
        override val message: String,
        val familyRevoked: Boolean = false
    ) : NilePayError()

    data class Forbidden(
        override val message: String
    ) : NilePayError()

    data class Conflict(
        override val message: String
    ) : NilePayError()

    data class RateLimited(
        override val message: String,
        val retryAfterSeconds: Long? = null
    ) : NilePayError()

    data class ServerError(
        val statusCode: Int,
        override val message: String
    ) : NilePayError()

    data class NetworkError(
        override val message: String = "No internet connection. Please check your network.",
        override val cause: Throwable? = null
    ) : NilePayError()

    data class Unknown(
        override val message: String
    ) : NilePayError()

    companion object {
        private val jsonParser = Json { ignoreUnknownKeys = true }

        fun parseFromHttp(statusCode: Int, rawBody: String?, retryAfterHeader: String? = null): NilePayError {
            val parsedMessage: String = try {
                if (!rawBody.isNullOrBlank()) {
                    val element = jsonParser.parseToJsonElement(rawBody).jsonObject
                    element["error"]?.jsonPrimitive?.content ?: element["message"]?.jsonPrimitive?.content ?: "Request failed"
                } else {
                    "Request failed with code $statusCode"
                }
            } catch (_: Exception) {
                rawBody?.take(200)?.ifBlank { null } ?: "Request failed with code $statusCode"
            }

            val familyRevoked = try {
                if (!rawBody.isNullOrBlank()) {
                    jsonParser.parseToJsonElement(rawBody).jsonObject["familyRevoked"]?.jsonPrimitive?.content?.toBoolean() ?: false
                } else false
            } catch (_: Exception) {
                false
            }

            return when (statusCode) {
                401 -> Unauthorized(parsedMessage, familyRevoked)
                403 -> Forbidden(parsedMessage)
                409 -> Conflict(parsedMessage)
                429 -> RateLimited(parsedMessage, retryAfterHeader?.toLongOrNull())
                in 500..599 -> ServerError(statusCode, parsedMessage)
                else -> Unknown(parsedMessage)
            }
        }
    }
}
