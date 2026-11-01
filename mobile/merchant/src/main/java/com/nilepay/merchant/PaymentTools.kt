package com.nilepay.merchant

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime

enum class PaymentSort { Newest, Oldest, Highest, Lowest }
enum class PaymentPeriod { Any, Today, Week }

internal fun paymentInstant(value: String): Instant? = runCatching { Instant.parse(value) }
    .recoverCatching { OffsetDateTime.parse(value).toInstant() }.getOrNull()

internal fun visiblePayments(
    payments: List<MerchantPayment>, sort: PaymentSort, period: PaymentPeriod,
    today: LocalDate = LocalDate.now(CairoTime.CAIRO_ZONE)
): List<MerchantPayment> {
    val filtered = payments.filter { payment ->
        if (period == PaymentPeriod.Any) true else {
            val date = paymentInstant(payment.createdAt)?.atZone(CairoTime.CAIRO_ZONE)?.toLocalDate()
            date != null && !date.isAfter(today) && !date.isBefore(if (period == PaymentPeriod.Today) today else today.minusDays(6))
        }
    }
    return when (sort) {
        PaymentSort.Newest -> filtered.sortedByDescending { paymentInstant(it.createdAt) ?: Instant.MIN }
        PaymentSort.Oldest -> filtered.sortedBy { paymentInstant(it.createdAt) ?: Instant.MAX }
        PaymentSort.Highest -> filtered.sortedByDescending { it.receivedAmountEgp ?: it.amountEgp }
        PaymentSort.Lowest -> filtered.sortedBy { it.receivedAmountEgp ?: it.amountEgp }
    }
}

internal fun paymentsCsv(payments: List<MerchantPayment>): String {
    fun cell(raw: String): String {
        // Protect spreadsheet users from formulas in sender names and order notes.
        val safe = if (raw.trimStart().firstOrNull() in listOf('=', '+', '-', '@', '\t', '\r')) "'$raw" else raw
        return "\"${safe.replace("\"", "\"\"")}\""
    }
    val header = "Payment ID,Sender,Amount EGP,Expected EGP,Received EGP,Status,Created UTC,Reference,Note"
    return "\uFEFF" + header + "\r\n" + payments.joinToString("\r\n") { p ->
        listOf(p.sessionId.ifBlank { p.id }, p.sender, p.amountEgp.toString(), p.expectedAmountEgp?.toString().orEmpty(),
            p.receivedAmountEgp?.toString().orEmpty(), p.status, p.createdAt, p.reference.orEmpty(), p.note.orEmpty())
            .joinToString(",", transform = ::cell)
    }
}

internal fun sharePaymentExport(context: Context, payments: List<MerchantPayment>) {
    val directory = File(context.cacheDir, "payment_exports").apply { mkdirs() }
    directory.listFiles()?.filter { it.lastModified() < System.currentTimeMillis() - 86_400_000L }?.forEach { it.delete() }
    val file = File(directory, "NilePay-payments-${System.currentTimeMillis()}.csv")
    file.writeText(paymentsCsv(payments), Charsets.UTF_8)
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = android.content.ClipData.newRawUri("NilePay payments", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }, context.getString(R.string.export_results)))
}
