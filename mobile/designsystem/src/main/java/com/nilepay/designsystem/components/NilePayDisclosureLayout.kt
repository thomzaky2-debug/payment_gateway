package com.nilepay.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePayDisclosureLayout(
    onAgree: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(NilePayTheme.colors.background)
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(scrollState)
                .padding(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.xl)
        ) {
            // Security Badge
            Row(
                modifier = Modifier
                    .clip(NilePayTheme.shapes.full)
                    .background(NilePayTheme.colors.primary.copy(alpha = 0.12f))
                    .padding(horizontal = NilePayTheme.spacing.md, vertical = NilePayTheme.spacing.xs),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Outlined.Security,
                    contentDescription = null,
                    tint = NilePayTheme.colors.primary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(NilePayTheme.spacing.xs))
                Text(
                    text = stringResource(R.string.disclosure_badge),
                    style = NilePayTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = NilePayTheme.colors.primary
                )
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.base))

            Text(
                text = stringResource(R.string.disclosure_title),
                style = NilePayTheme.typography.headlineLarge,
                color = NilePayTheme.colors.onBackground
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))

            Text(
                text = stringResource(R.string.disclosure_intro),
                style = NilePayTheme.typography.bodyLarge,
                color = NilePayTheme.colors.onSurfaceSecondary
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // Disclosure Points
            DisclosurePointItem(
                icon = Icons.Outlined.Notifications,
                title = stringResource(R.string.disclosure_point1_title),
                description = stringResource(R.string.disclosure_point1_desc)
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.md))

            DisclosurePointItem(
                icon = Icons.AutoMirrored.Outlined.ReceiptLong,
                title = stringResource(R.string.disclosure_point2_title),
                description = stringResource(R.string.disclosure_point2_desc)
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.md))

            DisclosurePointItem(
                icon = Icons.Outlined.Lock,
                title = stringResource(R.string.disclosure_point3_title),
                description = stringResource(R.string.disclosure_point3_desc)
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.md))

            DisclosurePointItem(
                icon = Icons.Outlined.Tune,
                title = stringResource(R.string.disclosure_point4_title),
                description = stringResource(R.string.disclosure_point4_desc)
            )

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))
        }

        // Action Buttons pinned at bottom
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(NilePayTheme.colors.surface)
                .padding(NilePayTheme.spacing.base)
        ) {
            NilePayButton(
                text = stringResource(R.string.action_agree_continue),
                onClick = onAgree,
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Primary
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))
            NilePayButton(
                text = stringResource(R.string.action_not_now),
                onClick = onCancel,
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Text
            )
        }
    }
}

@Composable
private fun DisclosurePointItem(
    icon: ImageVector,
    title: String,
    description: String
) {
    NilePayCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = NilePayTheme.colors.primary,
                    modifier = Modifier.size(22.dp)
                )
            }
            Spacer(modifier = Modifier.width(NilePayTheme.spacing.md))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = NilePayTheme.typography.titleMedium,
                    color = NilePayTheme.colors.onSurface
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = description,
                    style = NilePayTheme.typography.bodyMedium,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
            }
        }
    }
}
