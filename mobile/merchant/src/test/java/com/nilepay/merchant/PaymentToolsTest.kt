package com.nilepay.merchant

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class PaymentToolsTest {
    private fun payment(id: String, date: String, amount: Double, received: Double? = null) = MerchantPayment(
        id, id, "payer@instapay", amount, "CONFIRMED", date, null, null, receivedAmountEgp = received)

    @Test fun cairoDateFiltersRespectMidnightAndExcludeFutureDays() {
        val payments = listOf(
            payment("today", "2026-10-31T22:30:00Z", 10.0),
            payment("yesterday", "2026-10-31T20:00:00Z", 20.0),
            payment("future", "2026-11-02T12:00:00Z", 30.0),
            payment("invalid", "not-a-date", 40.0))
        assertEquals(listOf("today"), visiblePayments(payments, PaymentSort.Newest, PaymentPeriod.Today,
            LocalDate.of(2026, 11, 1)).map { it.id })
        assertEquals(2, visiblePayments(payments, PaymentSort.Newest, PaymentPeriod.Week,
            LocalDate.of(2026, 11, 1)).size)
    }
    @Test fun sortsActualReceivedAmountsAndRetainsUnknownDatesInAllDates() {
        val payments = listOf(payment("a", "invalid", 100.0, 1.0), payment("b", "2026-11-01T10:00:00Z", 2.0))
        assertEquals(listOf("b", "a"), visiblePayments(payments, PaymentSort.Highest, PaymentPeriod.Any).map { it.id })
        assertEquals(listOf("a", "b"), visiblePayments(payments, PaymentSort.Lowest, PaymentPeriod.Any).map { it.id })
    }
    @Test fun exportsOnlySuppliedRowsAndEscapesFormulasQuotesAndNewlines() {
        val payment = payment("safe", "2026-11-01T10:00:00Z", 1.0).copy(
            sender = "=HYPERLINK(\"test\")", note = "order, \"special\"\nsecond line")
        val csv = paymentsCsv(listOf(payment))
        assertTrue(csv.startsWith("\uFEFFPayment ID"))
        assertTrue(csv.contains("\"'=HYPERLINK(\"\"test\"\")\""))
        assertTrue(csv.contains("\"order, \"\"special\"\"\nsecond line\""))
        assertFalse(csv.contains("null"))
    }
}
