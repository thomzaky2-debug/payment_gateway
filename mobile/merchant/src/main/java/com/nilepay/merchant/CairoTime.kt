package com.nilepay.merchant

import java.time.Instant
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

object CairoTime {
    /**
     * Egypt Standard Time / Cairo timezone (GMT+2, matched to NilePay website time).
     */
    val CAIRO_ZONE: ZoneId = ZoneId.of("Africa/Cairo")

    private val CARD_TIME_FORMATTER = DateTimeFormatter.ofPattern("d MMM, hh:mm a", Locale.ENGLISH)
    private val CARD_FULL_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy, hh:mm a", Locale.ENGLISH)
    private val DETAIL_TIME_FORMATTER = DateTimeFormatter.ofPattern("d MMM yyyy, hh:mm:ss a", Locale.ENGLISH)

    /**
     * Format for transaction cards: e.g. "1 Nov, 02:08 PM"
     */
    fun formatCard(isoString: String?): String {
        if (isoString.isNullOrBlank()) return "—"
        return try {
            val zdt = parseToCairo(isoString)
            CARD_TIME_FORMATTER.format(zdt)
        } catch (_: Exception) {
            isoString.replace('T', ' ').take(16)
        }
    }

    /**
     * Format for card with year: e.g. "1 Nov 2026, 02:08 PM"
     */
    fun formatCardWithYear(isoString: String?): String {
        if (isoString.isNullOrBlank()) return "—"
        return try {
            val zdt = parseToCairo(isoString)
            CARD_FULL_FORMATTER.format(zdt)
        } catch (_: Exception) {
            isoString.replace('T', ' ').take(16)
        }
    }

    /**
     * Format for payment details dialog & receipt: e.g. "1 Nov 2026, 02:08:10 PM (GMT+2)"
     */
    fun formatDetail(isoString: String?): String {
        if (isoString.isNullOrBlank()) return "—"
        return try {
            val zdt = parseToCairo(isoString)
            "${DETAIL_TIME_FORMATTER.format(zdt)} (GMT+2)"
        } catch (_: Exception) {
            isoString
        }
    }

    private fun parseToCairo(raw: String): ZonedDateTime {
        val trimmed = raw.trim()
        return try {
            val instant = Instant.parse(trimmed)
            instant.atZone(CAIRO_ZONE)
        } catch (_: Exception) {
            try {
                val odt = OffsetDateTime.parse(trimmed)
                odt.atZoneSameInstant(CAIRO_ZONE)
            } catch (_: Exception) {
                val ldt = LocalDateTime.parse(trimmed.replace(" ", "T"))
                ldt.atZone(ZoneOffset.UTC).withZoneSameInstant(CAIRO_ZONE)
            }
        }
    }
}
