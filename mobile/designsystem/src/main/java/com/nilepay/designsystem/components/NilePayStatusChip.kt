package com.nilepay.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

enum class NilePayStatus {
    Pending,
    Confirmed,
    Failed,
    Expired,
    Overpaid,
    Underpaid,
    LatePayment,
    Unmatched,
    RiskReview,
    DuplicateSuspect,
    SenderMismatch,
    Rejected,
    Resolved,
    Unknown;

    companion object {
        fun fromApiStatus(value: String): NilePayStatus = when (value.uppercase(java.util.Locale.ROOT)) {
            "PENDING" -> Pending
            "CONFIRMED" -> Confirmed
            "EXPIRED" -> Expired
            "OVERPAID" -> Overpaid
            "UNDERPAID" -> Underpaid
            "EXPIRED_PAID", "LATE_PAYMENT" -> LatePayment
            "UNMATCHED" -> Unmatched
            "HIGH_VALUE_REVIEW", "REVIEW" -> RiskReview
            "DUPLICATE_SUSPECT" -> DuplicateSuspect
            "HANDLE_MISMATCH" -> SenderMismatch
            "REJECTED" -> Rejected
            "RESOLVED" -> Resolved
            "FAILED" -> Failed
            else -> Unknown
        }
    }
}

fun NilePayStatus.labelResource(): Int = when (this) {
    NilePayStatus.Pending -> R.string.status_pending
    NilePayStatus.Confirmed -> R.string.status_confirmed
    NilePayStatus.Expired -> R.string.status_expired
    NilePayStatus.Failed -> R.string.status_failed
    NilePayStatus.Overpaid -> R.string.status_overpaid
    NilePayStatus.Underpaid -> R.string.status_underpaid
    NilePayStatus.LatePayment -> R.string.status_late_payment
    NilePayStatus.Unmatched -> R.string.status_unmatched
    NilePayStatus.RiskReview -> R.string.status_risk_review
    NilePayStatus.DuplicateSuspect -> R.string.status_duplicate_suspect
    NilePayStatus.SenderMismatch -> R.string.status_sender_mismatch
    NilePayStatus.Rejected -> R.string.status_rejected
    NilePayStatus.Resolved -> R.string.status_resolved
    NilePayStatus.Unknown -> R.string.status_unknown
}

@Composable
fun NilePayStatusChip(
    status: NilePayStatus,
    modifier: Modifier = Modifier
) {
    val (_, textColor, containerColor) = when (status) {
        NilePayStatus.Pending -> Triple(
            R.string.status_pending,
            NilePayTheme.colors.statusPending,
            NilePayTheme.colors.statusPendingContainer
        )
        NilePayStatus.Confirmed -> Triple(
            R.string.status_confirmed,
            NilePayTheme.colors.statusConfirmed,
            NilePayTheme.colors.statusConfirmedContainer
        )
        NilePayStatus.Failed -> Triple(
            R.string.status_failed,
            NilePayTheme.colors.statusFailed,
            NilePayTheme.colors.statusFailedContainer
        )
        NilePayStatus.Expired -> Triple(
            R.string.status_expired,
            NilePayTheme.colors.statusExpired,
            NilePayTheme.colors.statusExpiredContainer
        )
        NilePayStatus.Underpaid, NilePayStatus.LatePayment -> Triple(status.labelResource(), if (NilePayTheme.colors.isDark) Color(0xFFFCD34D) else NilePayTheme.colors.statusPending, NilePayTheme.colors.statusPendingContainer)
        NilePayStatus.Overpaid -> Triple(status.labelResource(), if (NilePayTheme.colors.isDark) Color(0xFF67E8F9) else Color(0xFF0E7490), if (NilePayTheme.colors.isDark) Color(0xFF164E63) else Color(0xFFCFFAFE))
        NilePayStatus.Unmatched, NilePayStatus.Unknown, NilePayStatus.Resolved -> Triple(status.labelResource(), NilePayTheme.colors.onSurfaceSecondary, NilePayTheme.colors.surfaceSubtle)
        NilePayStatus.RiskReview, NilePayStatus.SenderMismatch -> Triple(status.labelResource(), if (NilePayTheme.colors.isDark) Color(0xFFC4B5FD) else Color(0xFF6D28D9), if (NilePayTheme.colors.isDark) Color(0xFF3B2463) else Color(0xFFEDE9FE))
        NilePayStatus.DuplicateSuspect, NilePayStatus.Rejected -> Triple(status.labelResource(), if (NilePayTheme.colors.isDark) Color(0xFFFDA4AF) else NilePayTheme.colors.statusFailed, NilePayTheme.colors.statusFailedContainer)
    }

    val label = stringResource(status.labelResource())

    Row(
        modifier = modifier
            .clip(NilePayTheme.shapes.full)
            .background(containerColor)
            .padding(horizontal = NilePayTheme.spacing.md, vertical = NilePayTheme.spacing.xs),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(textColor)
        )
        Spacer(modifier = Modifier.width(NilePayTheme.spacing.xs))
        Text(
            text = label,
            style = NilePayTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = textColor
        )
    }
}
