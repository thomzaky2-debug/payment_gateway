package com.instapaydetector.app

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.time.LocalDate
import java.util.concurrent.TimeUnit

/** Authenticated mobile view of the same merchant API used by the web portal. */
class DashboardApiClient(private val ctx: Context) {
    private val config = GatewayConfig.get(ctx)
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private fun baseUrl(): String = config.serverBaseUrl.trimEnd('/')

    /** The web portal composes its overview from these three merchant routes. */
    suspend fun fetchDashboard(): Result<DashboardStats> = withContext(Dispatchers.IO) {
        runCatching {
            val statsResponse = get("${baseUrl()}/api/transactions/stats")
            val transactionsResponse = get("${baseUrl()}/api/transactions?limit=5&page=1")
            val settingsResponse = get("${baseUrl()}/api/settings")
            ensureSuccess(statsResponse)
            ensureSuccess(transactionsResponse)
            ensureSuccess(settingsResponse)

            val stats = JSONObject(statsResponse.body).getJSONObject("stats")
            val settings = JSONObject(settingsResponse.body).getJSONObject("settings")
            val merchant = MerchantInfo(
                handle = settings.optString("instapayHandle", config.merchantHandle),
                name = settings.optString("businessName", config.merchantBusinessName.ifBlank { "Merchant account" }),
                email = settings.optString("email", config.merchantEmail),
                webhookUrl = settings.optNullableString("webhookUrl"),
                instapayPaymentUrl = settings.optNullableString("instapayPaymentUrl"),
                checkoutTtlMin = settings.optNullableInt("checkoutTtlMin"),
            )
            val subscription = SubscriptionInfo(
                plan = settings.optString("subscriptionPlan", "FREE_TRIAL"),
                txCount = settings.optInt("txCount", 0),
                txLimit = settings.optInt("txLimit", 0),
                subscriptionEndsAt = settings.optNullableString("subscriptionEndsAt"),
                isFreeTrial = settings.optBoolean("isFreeTrial", false),
            )
            DashboardStats(
                merchant = merchant,
                stats = StatsBreakdown(
                    today = parseBucket(stats.optJSONObject("today")),
                    sevenDays = parseBucket(stats.optJSONObject("sevenDays")),
                    pending = parseBucket(stats.optJSONObject("pending")),
                ),
                recent = parseTransactions(JSONObject(transactionsResponse.body).getJSONArray("transactions")),
                subscription = subscription,
            ).also { config.syncFromMerchant(merchant, subscription) }
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = {
                Log.e(TAG, "fetchDashboard failed: ${it.message}", it)
                Result.failure(it)
            },
        )
    }

    /** Builds the chart from the transaction history, rather than an invented API route. */
    suspend fun fetchChart(days: Int = 30): Result<ChartData> = withContext(Dispatchers.IO) {
        runCatching {
            val safeDays = days.coerceIn(1, 90)
            val res = get("${baseUrl()}/api/transactions?limit=100&page=1")
            ensureSuccess(res)
            buildChart(parseTransactions(JSONObject(res.body).getJSONArray("transactions")), safeDays)
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = {
                Log.e(TAG, "fetchChart failed: ${it.message}", it)
                Result.failure(it)
            },
        )
    }

    suspend fun fetchTransactions(
        query: String? = null,
        status: String? = null,
        limit: Int = 50,
        cursor: String? = null,
    ): Result<TransactionList> = withContext(Dispatchers.IO) {
        runCatching {
            val params = mutableListOf("limit=${limit.coerceIn(1, 100)}")
            params += "page=${cursor?.toIntOrNull()?.coerceAtLeast(1) ?: 1}"
            if (!query.isNullOrBlank()) {
                params.add("search=${URLEncoder.encode(query, "UTF-8")}")
            }
            if (!status.isNullOrBlank()) {
                params.add("status=${URLEncoder.encode(status, "UTF-8")}")
            }
            val res = get("${baseUrl()}/api/transactions?${params.joinToString("&")}")
            ensureSuccess(res)
            parseTransactionList(JSONObject(res.body))
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = {
                Log.e(TAG, "fetchTransactions failed: ${it.message}", it)
                Result.failure(it)
            },
        )
    }

    suspend fun fetchNotifications(): Result<List<MerchantNotification>> = withContext(Dispatchers.IO) {
        runCatching {
            val res = get("${baseUrl()}/api/notifications")
            ensureSuccess(res)
            val array = JSONObject(res.body).optJSONArray("notifications") ?: JSONArray()
            (0 until array.length()).map { index ->
                val item = array.getJSONObject(index)
                MerchantNotification(item.optString("id"), item.optString("title"), item.optString("message"), item.optString("severity", "INFO"))
            }
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = { Result.failure(it) },
        )
    }

    suspend fun markNotificationsRead(ids: List<String>) = withContext(Dispatchers.IO) {
        ids.forEach { id ->
            val request = Request.Builder()
                .url("${baseUrl()}/api/notifications/${URLEncoder.encode(id, "UTF-8")}/read")
                .addHeader("Authorization", "Bearer ${merchantSessionToken()}")
                .post("{}".toRequestBody(JSON_MEDIA_TYPE))
                .build()
            httpClient.newCall(request).execute().close()
        }
    }

    /** The server permits only the same safe review actions shown in the portal. */
    suspend fun updateTransactionStatus(sessionId: String, newStatus: String, detectedRef: String? = null): Result<Boolean> = withContext(Dispatchers.IO) {
        runCatching {
            val action = when (newStatus) {
                "CONFIRMED" -> "confirm"
                "CANCELLED", "REJECTED" -> "reject"
                else -> throw IllegalArgumentException("This payment state cannot be changed from the Detector app.")
            }
            val body = if (detectedRef.isNullOrBlank()) "{}" else JSONObject().put("detectedRef", detectedRef).toString()
            val request = Request.Builder()
                .url("${baseUrl()}/api/transactions/${URLEncoder.encode(sessionId, "UTF-8")}/$action")
                .addHeader("Authorization", "Bearer ${merchantSessionToken()}")
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw responseException(response.code, response.body?.string().orEmpty())
            }
            true
        }.fold(
            onSuccess = { Result.success(it) },
            onFailure = { Result.failure(it) },
        )
    }

    suspend fun revokeSession(sessionToken: String) = withContext(Dispatchers.IO) {
        if (sessionToken.isBlank()) return@withContext
        val request = Request.Builder()
            .url("${baseUrl()}/api/auth/logout")
            .addHeader("Authorization", "Bearer $sessionToken")
            .post("{}".toRequestBody(JSON_MEDIA_TYPE))
            .build()
        runCatching { httpClient.newCall(request).execute().close() }
    }

    private fun get(url: String): HttpResponse {
        val request = Request.Builder().url(url)
            .addHeader("Authorization", "Bearer ${merchantSessionToken()}")
            .addHeader("Accept", "application/json")
            .get().build()
        httpClient.newCall(request).execute().use { response ->
            return HttpResponse(response.code, response.body?.string().orEmpty())
        }
    }

    private fun merchantSessionToken(): String = config.merchantSessionToken.ifBlank {
        throw IllegalStateException("Your session has expired. Please sign in again.")
    }

    private fun ensureSuccess(response: HttpResponse) {
        if (!response.isSuccessful) throw responseException(response.code, response.body)
    }

    private fun responseException(code: Int, body: String): Exception {
        val message = runCatching { JSONObject(body).optString("error") }.getOrNull().orEmpty()
        return Exception(message.ifBlank { "Gateway request failed (HTTP $code)" })
    }

    private fun parseBucket(json: JSONObject?): StatBucket = StatBucket(
        count = json?.optInt("count", 0) ?: 0,
        totalEgp = json?.optDouble("totalEgp", 0.0) ?: 0.0,
    )

    private fun parseTransactionList(json: JSONObject): TransactionList {
        val transactions = parseTransactions(json.optJSONArray("transactions") ?: JSONArray())
        val pagination = json.optJSONObject("pagination") ?: JSONObject()
        val page = pagination.optInt("page", 1).coerceAtLeast(1)
        val totalPages = pagination.optInt("totalPages", 1).coerceAtLeast(1)
        return TransactionList(
            transactions = transactions,
            pagination = Pagination(
                limit = pagination.optInt("limit", transactions.size.coerceAtLeast(1)),
                hasMore = page < totalPages,
                nextCursor = if (page < totalPages) (page + 1).toString() else null,
                count = pagination.optInt("total", transactions.size),
            ),
        )
    }

    private fun parseTransactions(array: JSONArray): List<Transaction> = buildList {
        for (index in 0 until array.length()) {
            val item = array.getJSONObject(index)
            add(Transaction(
                sessionId = item.optString("sessionId"),
                senderHandle = item.optString("senderHandle", "—"),
                recipientHandle = item.optString("recipientHandle", "—"),
                amountEgp = item.optDouble("amountEgp", 0.0),
                detectedAmountEgp = item.optNullableDouble("detectedAmountEgp"),
                currency = item.optString("currency", "EGP"),
                status = item.optString("status", "PENDING"),
                note = item.optNullableString("note"),
                deepLinkUrl = item.optNullableString("deepLinkUrl"),
                deepLinkToken = item.optNullableString("deepLinkToken"),
                detectedRef = item.optNullableString("detectedRef"),
                detectedAt = item.optNullableString("detectedAt"),
                createdAt = item.optString("createdAt"),
                expiresAt = item.optString("expiresAt"),
            ))
        }
    }

    private fun buildChart(transactions: List<Transaction>, days: Int): ChartData {
        val end = LocalDate.now()
        val start = end.minusDays((days - 1).toLong())
        val buckets = (0 until days).associate { offset ->
            start.plusDays(offset.toLong()).toString() to doubleArrayOf(0.0, 0.0)
        }.toMutableMap()
        transactions.filter { it.status == "CONFIRMED" }.forEach { transaction ->
            val date = transaction.detectedAt?.take(10) ?: transaction.createdAt.take(10)
            buckets[date]?.let { bucket ->
                bucket[0] = bucket[0] + transaction.amountEgp
                bucket[1] = bucket[1] + 1.0
            }
        }
        val series = buckets.map { (date, bucket) -> ChartPoint(date, bucket[0], bucket[1].toInt()) }
        val totalRevenue = series.sumOf { it.totalEgp }
        val totalCount = series.sumOf { it.count }
        val best = series.maxByOrNull { it.totalEgp } ?: ChartPoint(end.toString(), 0.0, 0)
        return ChartData(
            ChartRange(days, start.toString(), end.toString()), series,
            ChartSummary(totalRevenue, totalCount, totalRevenue / days, ChartBestDay(best.date, best.totalEgp, best.count)),
        )
    }

    private fun JSONObject.optNullableString(name: String): String? =
        if (has(name) && !isNull(name)) optString(name).takeIf { it.isNotBlank() } else null

    private fun JSONObject.optNullableInt(name: String): Int? =
        if (has(name) && !isNull(name)) optInt(name) else null

    private fun JSONObject.optNullableDouble(name: String): Double? =
        if (has(name) && !isNull(name)) optDouble(name) else null

    private data class HttpResponse(val code: Int, val body: String) { val isSuccessful get() = code in 200..299 }

    private companion object {
        private const val TAG = "DashboardApi"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
