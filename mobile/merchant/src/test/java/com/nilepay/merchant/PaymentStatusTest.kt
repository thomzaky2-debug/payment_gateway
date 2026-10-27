package com.nilepay.merchant

import com.nilepay.designsystem.components.NilePayStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class PaymentStatusTest {
    @Test fun `all review outcomes have explicit states instead of pending`() {
        val cases = mapOf(
            "OVERPAID" to NilePayStatus.Overpaid, "UNDERPAID" to NilePayStatus.Underpaid,
            "LATE_PAYMENT" to NilePayStatus.LatePayment, "EXPIRED_PAID" to NilePayStatus.LatePayment,
            "EXPIRED" to NilePayStatus.Expired, "UNMATCHED" to NilePayStatus.Unmatched,
            "HIGH_VALUE_REVIEW" to NilePayStatus.RiskReview, "REVIEW" to NilePayStatus.RiskReview,
            "DUPLICATE_SUSPECT" to NilePayStatus.DuplicateSuspect, "HANDLE_MISMATCH" to NilePayStatus.SenderMismatch,
            "PENDING" to NilePayStatus.Pending, "CONFIRMED" to NilePayStatus.Confirmed,
            "REJECTED" to NilePayStatus.Rejected, "UNRECOGNIZED" to NilePayStatus.Unknown
        )
        cases.forEach { (api, expected) -> assertEquals(api, expected, NilePayStatus.fromApiStatus(api)) }
    }
}
