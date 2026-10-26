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
    Expired
}

@Composable
fun NilePayStatusChip(
    status: NilePayStatus,
    modifier: Modifier = Modifier
) {
    val (labelRes, textColor, containerColor) = when (status) {
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
    }

    val label = stringResource(labelRes)

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
