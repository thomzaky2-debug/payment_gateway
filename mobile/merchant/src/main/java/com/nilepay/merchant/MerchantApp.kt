package com.nilepay.merchant

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
import com.nilepay.designsystem.components.NilePayBottomNav
import com.nilepay.designsystem.components.NilePayBottomNavItem
import com.nilepay.designsystem.components.NilePayButton
import com.nilepay.designsystem.components.NilePayButtonStyle
import com.nilepay.designsystem.components.NilePayCard
import com.nilepay.designsystem.components.NilePayEmptyState
import com.nilepay.designsystem.components.NilePayListRow
import com.nilepay.designsystem.components.NilePayTopBar
import com.nilepay.designsystem.theme.NilePayTheme

private enum class MerchantDestination(
    val id: String,
    val labelRes: Int,
    val titleRes: Int,
    val icon: ImageVector
) {
    Overview("overview", R.string.nav_overview, R.string.overview_title, Icons.Filled.Dashboard),
    Payments("payments", R.string.nav_payments, R.string.payments_title, Icons.AutoMirrored.Filled.ReceiptLong),
    Health("health", R.string.nav_health, R.string.health_title, Icons.Filled.HealthAndSafety),
    Settings("settings", R.string.nav_settings, R.string.settings_title, Icons.Filled.Settings)
}

@Composable
fun MerchantApp() {
    var destination by remember { mutableStateOf(MerchantDestination.Overview) }

    NilePayTheme(darkTheme = true) {
        Scaffold(
            containerColor = NilePayTheme.colors.background,
            topBar = {
                NilePayTopBar(
                    title = stringResource(destination.titleRes),
                    actions = {
                        Icon(
                            Icons.Filled.AccountCircle,
                            contentDescription = stringResource(R.string.action_profile),
                            tint = NilePayTheme.colors.primary,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                )
            },
            bottomBar = {
                NilePayBottomNav(
                    items = MerchantDestination.entries.map {
                        NilePayBottomNavItem(
                            id = it.id,
                            label = stringResource(it.labelRes),
                            icon = it.icon
                        )
                    },
                    selectedItemId = destination.id,
                    onItemSelected = { selected ->
                        destination = MerchantDestination.entries.first { it.id == selected }
                    }
                )
            }
        ) { contentPadding ->
            when (destination) {
                MerchantDestination.Overview -> OverviewScreen(
                    contentPadding = contentPadding,
                    onReviewSetup = { destination = MerchantDestination.Health }
                )
                MerchantDestination.Payments -> PaymentsScreen(contentPadding)
                MerchantDestination.Health -> HealthScreen(contentPadding)
                MerchantDestination.Settings -> SettingsScreen(contentPadding)
            }
        }
    }
}

@Composable
private fun ScreenColumn(
    contentPadding: PaddingValues,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(contentPadding)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content
    )
}

@Composable
private fun OverviewScreen(contentPadding: PaddingValues, onReviewSetup: () -> Unit) {
    ScreenColumn(contentPadding) {
        Text(
            text = stringResource(R.string.overview_greeting),
            style = NilePayTheme.typography.headlineLarge,
            color = NilePayTheme.colors.onBackground,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            text = stringResource(R.string.overview_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )

        DetectorHeroCard(onReviewSetup)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                label = stringResource(R.string.metric_received_today),
                value = "0.00",
                supporting = stringResource(R.string.currency_egp),
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                label = stringResource(R.string.metric_payments_today),
                value = "0",
                supporting = stringResource(R.string.payment_count_label),
                modifier = Modifier.weight(1f)
            )
        }

        SectionTitle(stringResource(R.string.recent_payments))
        NilePayCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                NilePayEmptyState(
                    title = stringResource(R.string.no_payments_title),
                    subtitle = stringResource(R.string.no_payments_message),
                    icon = Icons.Filled.Payments
                )
            }
        }
    }
}

@Composable
private fun DetectorHeroCard(onReviewSetup: () -> Unit) {
    NilePayCard {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(NilePayTheme.shapes.medium)
                        .background(NilePayTheme.colors.statusPendingContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Filled.WifiOff,
                        contentDescription = null,
                        tint = NilePayTheme.colors.statusPending
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    Text(
                        stringResource(R.string.detector_off),
                        style = NilePayTheme.typography.titleLarge,
                        color = NilePayTheme.colors.onSurface
                    )
                    Text(
                        stringResource(R.string.detector_off_detail),
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
            NilePayButton(
                text = stringResource(R.string.review_detector_setup),
                onClick = onReviewSetup,
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Primary
            )
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, supporting: String, modifier: Modifier = Modifier) {
    NilePayCard(modifier = modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                label,
                style = NilePayTheme.typography.labelMedium,
                color = NilePayTheme.colors.onSurfaceSecondary,
                maxLines = 2
            )
            if (label == stringResource(R.string.metric_received_today)) {
                NilePayAmountText(amount = 0.0, size = NilePayAmountSize.Large)
            } else {
                Text(value, style = NilePayTheme.typography.amountLarge, color = NilePayTheme.colors.onSurface)
            }
            Text(supporting, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
        }
    }
}

@Composable
private fun PaymentsScreen(contentPadding: PaddingValues) {
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.payments_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayCard {
            NilePayEmptyState(
                title = stringResource(R.string.no_payments_title),
                subtitle = stringResource(R.string.payments_empty_message),
                icon = Icons.AutoMirrored.Filled.ReceiptLong
            )
        }
        Text(
            stringResource(R.string.pull_to_refresh_hint),
            style = NilePayTheme.typography.bodySmall,
            color = NilePayTheme.colors.onSurfaceSecondary,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

@Composable
private fun HealthScreen(contentPadding: PaddingValues) {
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.health_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayCard {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                HealthHeader()
                HealthCheckRow(
                    icon = Icons.Filled.HealthAndSafety,
                    title = stringResource(R.string.notification_access),
                    detail = stringResource(R.string.notification_access_off),
                    healthy = false
                )
                HealthCheckRow(
                    icon = Icons.Filled.Shield,
                    title = stringResource(R.string.secure_connection),
                    detail = stringResource(R.string.secure_connection_ready),
                    healthy = true
                )
                HealthCheckRow(
                    icon = Icons.Filled.Refresh,
                    title = stringResource(R.string.pending_uploads),
                    detail = stringResource(R.string.no_pending_uploads),
                    healthy = true
                )
                NilePayButton(
                    text = stringResource(R.string.open_notification_access),
                    onClick = { },
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Primary
                )
            }
        }
        NilePayCard {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.privacy_title),
                    style = NilePayTheme.typography.titleLarge,
                    color = NilePayTheme.colors.onSurface
                )
                Text(
                    stringResource(R.string.privacy_summary),
                    style = NilePayTheme.typography.bodyMedium,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
            }
        }
    }
}

@Composable
private fun HealthHeader() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(NilePayTheme.colors.statusPending)
        )
        Column(Modifier.padding(start = 12.dp)) {
            Text(
                stringResource(R.string.detection_needs_setup),
                style = NilePayTheme.typography.titleLarge,
                color = NilePayTheme.colors.onSurface
            )
            Text(
                stringResource(R.string.detection_needs_setup_detail),
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
        }
    }
}

@Composable
private fun HealthCheckRow(icon: ImageVector, title: String, detail: String, healthy: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = NilePayTheme.colors.onSurfaceSecondary)
        Column(
            Modifier
                .weight(1f)
                .padding(horizontal = 12.dp)
        ) {
            Text(title, style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.onSurface)
            Text(detail, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
        }
        Icon(
            if (healthy) Icons.Filled.CheckCircle else Icons.AutoMirrored.Filled.HelpOutline,
            contentDescription = null,
            tint = if (healthy) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending
        )
    }
}

@Composable
private fun SettingsScreen(contentPadding: PaddingValues) {
    ScreenColumn(contentPadding) {
        NilePayCard {
            Column {
                Text(
                    stringResource(R.string.merchant_account),
                    style = NilePayTheme.typography.labelMedium,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    stringResource(R.string.account_not_loaded),
                    style = NilePayTheme.typography.headlineSmall,
                    color = NilePayTheme.colors.onSurface
                )
                Text(
                    stringResource(R.string.sign_in_account_hint),
                    style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
            }
        }
        SettingsRow(Icons.Filled.AccountCircle, stringResource(R.string.profile_and_business), stringResource(R.string.profile_and_business_detail))
        SettingsRow(Icons.Filled.HealthAndSafety, stringResource(R.string.notification_preferences), stringResource(R.string.notification_preferences_detail))
        SettingsRow(Icons.Filled.Shield, stringResource(R.string.privacy_and_security), stringResource(R.string.privacy_and_security_detail))
        SettingsRow(Icons.AutoMirrored.Filled.HelpOutline, stringResource(R.string.help_and_support), stringResource(R.string.help_and_support_detail))
        Text(
            stringResource(R.string.version_label),
            style = NilePayTheme.typography.bodySmall,
            color = NilePayTheme.colors.onSurfaceSecondary,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String) {
    NilePayCard {
        NilePayListRow(
            title = title,
            subtitle = subtitle,
            leading = { Icon(icon, contentDescription = null, tint = NilePayTheme.colors.primary) },
            trailing = null
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = NilePayTheme.typography.headlineSmall,
        color = NilePayTheme.colors.onBackground,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier.semantics { heading() }
    )
}
