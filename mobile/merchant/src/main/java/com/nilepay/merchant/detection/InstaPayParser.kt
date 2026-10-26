package com.nilepay.merchant.detection

import java.security.MessageDigest
import java.time.Instant
import java.util.regex.Pattern

data class ParsedPayment(val amountEgp: Double, val senderHandle: String, val reference: String?)

object InstaPayParser {
    const val INSTAPAY_PACKAGE = "com.egyptianbanks.instapay"

    private val arabic = Pattern.compile(
        "لقد\\s+استلمت\\s+([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)\\s*(?:جنيه|ج\\.م|جنيهًا)?\\s*من\\s+([a-z0-9_.\\-]+@instapay)",
        Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
    )
    private val english = Pattern.compile(
        "(?:you\\s+have\\s+received|received)\\s+([0-9٠-٩]+(?:[\\.,][0-9٠-٩]+)*)\\s*(?:egp|le|l\\.e\\.)?\\s*from\\s+([a-z0-9_.\\-]+@instapay)",
        Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
    )
    private val reference = Pattern.compile("((?:IPAY|TXN|REF)-[A-Z0-9]{6,})", Pattern.CASE_INSENSITIVE)

    fun parse(text: String): ParsedPayment? {
        val normalized = normalizeDigits(text).replace(Regex("\\s+"), " ").trim()
        val match = english.matcher(normalized).takeIf { it.find() }
            ?: arabic.matcher(normalized).takeIf { it.find() }
            ?: return null
        val amount = match.group(1)?.replace(",", "")?.toDoubleOrNull()?.takeIf { it > 0 } ?: return null
        val sender = match.group(2)?.lowercase()?.trim()?.takeIf { it.isNotBlank() } ?: return null
        val refMatcher = reference.matcher(normalized)
        return ParsedPayment(amount, sender, if (refMatcher.find()) refMatcher.group(1)?.uppercase() else null)
    }

    fun eventId(packageName: String, postTime: Long, notificationKey: String): String {
        val source = "$packageName|$postTime|$notificationKey"
        return MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }

    fun timestamp(postTime: Long): String = Instant.ofEpochMilli(postTime).toString()

    private fun normalizeDigits(value: String): String = buildString(value.length) {
        value.forEach { char ->
            append(when (char) {
                '٠' -> '0'; '١' -> '1'; '٢' -> '2'; '٣' -> '3'; '٤' -> '4'
                '٥' -> '5'; '٦' -> '6'; '٧' -> '7'; '٨' -> '8'; '٩' -> '9'
                else -> char
            })
        }
    }
}
