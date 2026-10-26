package com.nilepay.merchant

import android.content.Intent
import android.content.ComponentName
import android.net.Uri
import android.provider.Settings
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
import com.nilepay.designsystem.components.NilePayBottomNav
import com.nilepay.designsystem.components.NilePayBottomNavItem
import com.nilepay.designsystem.components.NilePayButton
import com.nilepay.designsystem.components.NilePayButtonStyle
import com.nilepay.designsystem.components.NilePayCard
import com.nilepay.designsystem.components.NilePayEmptyState
import com.nilepay.designsystem.components.NilePayListRow
import com.nilepay.designsystem.components.NilePaySkeletonCard
import com.nilepay.designsystem.components.NilePayStatus
import com.nilepay.designsystem.components.NilePayStatusChip
import com.nilepay.designsystem.components.NilePayDisclosureLayout
import com.nilepay.designsystem.components.NilePayOtpField
import com.nilepay.designsystem.components.NilePayPasswordField
import com.nilepay.designsystem.components.NilePayTextField
import com.nilepay.designsystem.components.NilePayTopBar
import com.nilepay.designsystem.theme.NilePayTheme
import com.nilepay.merchant.detection.DetectionDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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
    val context = LocalContext.current
    val session = remember { MerchantSession(context) }
    var signedIn by remember { mutableStateOf(session.isSignedIn) }
    var consented by remember { mutableStateOf(session.hasDisclosureConsent) }

    when {
        !signedIn -> LoginScreen(session = session, onSignedIn = { signedIn = true })
        !consented -> NilePayTheme(darkTheme = true) {
            NilePayDisclosureLayout(
                onAgree = {
                    session.recordConsent()
                    consented = true
                    context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                },
                onCancel = { consented = true }
            )
        }
        else -> MerchantWorkspace(
            session = session,
            onSignOut = {
                session.signOut()
                signedIn = false
            }
        )
    }
}

@Composable
private fun MerchantWorkspace(session: MerchantSession, onSignOut: () -> Unit) {
    val context = LocalContext.current
    var destination by remember { mutableStateOf(MerchantDestination.Overview) }
    var dashboard by remember { mutableStateOf<DashboardSnapshot?>(null) }
    var dashboardError by remember { mutableStateOf<String?>(null) }
    var payments by remember { mutableStateOf<List<MerchantPayment>>(emptyList()) }
    var paymentsError by remember { mutableStateOf<String?>(null) }
    var notificationAccess by remember { mutableStateOf(hasNotificationAccess(context)) }
    var queuedEvents by remember { mutableStateOf(0) }
    var attentionEvents by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }
    var hasObservedFirstResume by remember { mutableStateOf(false) }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                notificationAccess = hasNotificationAccess(context)
                if (hasObservedFirstResume) refreshKey++ else hasObservedFirstResume = true
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(refreshKey) {
        loading = true
        com.nilepay.merchant.detection.DetectorWork.heartbeatNow(context)
        runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).dashboard() } }
            .onSuccess { dashboard = it; dashboardError = null }
            .onFailure { dashboardError = it.message }
        runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).recentPayments() } }
            .onSuccess { payments = it; paymentsError = null }
            .onFailure { paymentsError = it.message }
        withContext(Dispatchers.IO) {
            val dao = DetectionDatabase.get(context).events()
            queuedEvents = dao.count()
            attentionEvents = dao.attentionCount()
        }
        loading = false
    }

    NilePayTheme(darkTheme = true) {
        Scaffold(
            containerColor = NilePayTheme.colors.background,
            topBar = {
                NilePayTopBar(
                    title = stringResource(destination.titleRes),
                    actions = {
                        IconButton(onClick = { refreshKey++ }, enabled = !loading) {
                            if (loading) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                            else Icon(Icons.Filled.Refresh, stringResource(R.string.action_refresh))
                        }
                        IconButton(onClick = { destination = MerchantDestination.Settings }) {
                            Icon(Icons.Filled.AccountCircle, stringResource(R.string.action_profile), tint = NilePayTheme.colors.primary)
                        }
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
                    dashboard = dashboard,
                    dashboardError = dashboardError,
                    payments = payments.take(3),
                    notificationAccess = notificationAccess,
                    loading = loading,
                    onReviewSetup = { destination = MerchantDestination.Health }
                )
                MerchantDestination.Payments -> PaymentsScreen(contentPadding, payments, paymentsError, loading)
                MerchantDestination.Health -> HealthScreen(
                    contentPadding,
                    notificationAccess,
                    queuedEvents,
                    attentionEvents,
                    onOpenSettings = {
                        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                        notificationAccess = hasNotificationAccess(context)
                    }
                )
                MerchantDestination.Settings -> SettingsScreen(contentPadding, session) {
                    kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                        MobileGatewayClient(session).logout()
                        withContext(Dispatchers.Main) { onSignOut() }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginScreen(session: MerchantSession, onSignedIn: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val gateway = remember { MobileGatewayClient(session) }
    val missingCredentials = stringResource(R.string.login_missing_credentials)
    val invalidOtp = stringResource(R.string.login_invalid_otp)
    val loginFailed = stringResource(R.string.login_failed)

    fun submit() {
        if (email.isBlank() || password.isBlank()) {
            error = missingCredentials
            return
        }
        if (verificationId != null && otp.length != 6) {
            error = invalidOtp
            return
        }
        busy = true
        error = null
        scope.launch {
            runCatching {
                withContext(Dispatchers.IO) { gateway.login(email, password, verificationId, otp) }
            }.onSuccess { result ->
                when (result) {
                    is LoginResult.OtpRequired -> verificationId = result.verificationId
                    is LoginResult.SignedIn -> onSignedIn()
                }
            }.onFailure { error = it.message ?: loginFailed }
            busy = false
        }
    }

    NilePayTheme(darkTheme = true) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(NilePayTheme.colors.background)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 48.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(NilePayTheme.shapes.medium)
                    .background(NilePayTheme.colors.primaryGradient),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.Shield, contentDescription = null, tint = NilePayTheme.colors.onPrimary)
            }
            Spacer(Modifier.height(24.dp))
            Text(
                stringResource(R.string.login_title),
                style = NilePayTheme.typography.displayMedium,
                color = NilePayTheme.colors.onBackground
            )
            Text(
                stringResource(R.string.login_subtitle),
                style = NilePayTheme.typography.bodyLarge,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
            Spacer(Modifier.height(28.dp))
            NilePayTextField(
                value = email,
                onValueChange = { email = it },
                label = stringResource(R.string.login_email),
                enabled = !busy,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Email)
            )
            Spacer(Modifier.height(14.dp))
            NilePayPasswordField(
                value = password,
                onValueChange = { password = it },
                label = stringResource(R.string.login_password),
                enabled = !busy
            )
            if (verificationId != null) {
                Spacer(Modifier.height(22.dp))
                Text(
                    stringResource(R.string.login_otp_sent),
                    style = NilePayTheme.typography.bodyMedium,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
                Spacer(Modifier.height(12.dp))
                NilePayOtpField(otpValue = otp, onOtpChange = { otp = it }, enabled = !busy)
            }
            error?.let {
                Spacer(Modifier.height(14.dp))
                Text(it, style = NilePayTheme.typography.bodyMedium, color = NilePayTheme.colors.destructive)
            }
            Spacer(Modifier.height(24.dp))
            NilePayButton(
                text = if (busy) stringResource(R.string.login_working) else if (verificationId == null) stringResource(R.string.login_continue) else stringResource(R.string.login_verify),
                onClick = ::submit,
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Primary,
                enabled = !busy
            )
            Spacer(Modifier.height(16.dp))
            Text(
                stringResource(R.string.login_security_note),
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
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
private fun OverviewScreen(
    contentPadding: PaddingValues,
    dashboard: DashboardSnapshot?,
    dashboardError: String?,
    payments: List<MerchantPayment>,
    notificationAccess: Boolean,
    loading: Boolean,
    onReviewSetup: () -> Unit
) {
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

        DetectorHeroCard(notificationAccess, onReviewSetup)

        dashboardError?.let {
            Text(
                text = it,
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.destructive
            )
        }

        if (loading && dashboard == null) {
            NilePaySkeletonCard()
            NilePaySkeletonCard()
        } else Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricCard(
                label = stringResource(R.string.metric_received_today),
                value = dashboard?.todayTotalEgp?.toString() ?: "—",
                supporting = stringResource(R.string.currency_egp),
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                label = stringResource(R.string.metric_payments_today),
                value = dashboard?.todayCount?.toString() ?: "—",
                supporting = stringResource(R.string.payment_count_label),
                modifier = Modifier.weight(1f)
            )
        }

        dashboard?.let { snapshot ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard(
                    label = stringResource(R.string.metric_pending),
                    value = snapshot.pendingCount.toString(),
                    supporting = stringResource(R.string.awaiting_confirmation),
                    modifier = Modifier.weight(1f)
                )
                MetricCard(
                    label = stringResource(R.string.metric_quota),
                    value = "${snapshot.quotaCount}/${snapshot.quotaLimit}",
                    supporting = stringResource(R.string.current_plan_usage),
                    modifier = Modifier.weight(1f)
                )
            }
        }

        SectionTitle(stringResource(R.string.recent_payments))
        if (payments.isEmpty()) NilePayCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                NilePayEmptyState(
                    title = stringResource(R.string.no_payments_title),
                    subtitle = stringResource(R.string.no_payments_message),
                    icon = Icons.Filled.Payments
                )
            }
        } else payments.forEach { PaymentCard(it) }
    }
}

@Composable
private fun DetectorHeroCard(enabled: Boolean, onReviewSetup: () -> Unit) {
    NilePayCard {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(NilePayTheme.shapes.medium)
                        .background(if (enabled) NilePayTheme.colors.statusConfirmedContainer else NilePayTheme.colors.statusPendingContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (enabled) Icons.Filled.Wifi else Icons.Filled.WifiOff,
                        contentDescription = null,
                        tint = if (enabled) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    Text(
                        stringResource(if (enabled) R.string.detection_ready else R.string.detector_off),
                        style = NilePayTheme.typography.titleLarge,
                        color = NilePayTheme.colors.onSurface
                    )
                    Text(
                        stringResource(if (enabled) R.string.detection_ready_detail else R.string.detector_off_detail),
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
            if (!enabled) NilePayButton(
                text = stringResource(R.string.review_detector_setup), onClick = onReviewSetup,
                modifier = Modifier.fillMaxWidth(), style = NilePayButtonStyle.Primary
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
                if (value == "—") {
                    Text(value, style = NilePayTheme.typography.amountLarge, color = NilePayTheme.colors.onSurface)
                } else {
                    NilePayAmountText(amount = value.toDoubleOrNull() ?: 0.0, size = NilePayAmountSize.Large)
                }
            } else {
                Text(value, style = NilePayTheme.typography.amountLarge, color = NilePayTheme.colors.onSurface)
            }
            Text(supporting, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
        }
    }
}

@Composable
private fun PaymentsScreen(contentPadding: PaddingValues, payments: List<MerchantPayment>, error: String?, loading: Boolean) {
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("ALL") }
    val visible = payments.filter { payment ->
        (filter == "ALL" || payment.status == filter) &&
            (query.isBlank() || payment.sender.contains(query, ignoreCase = true) || payment.id.contains(query, ignoreCase = true))
    }
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.payments_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayTextField(
            value = query,
            onValueChange = { query = it },
            label = stringResource(R.string.search_payments),
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) }
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(
                "ALL" to R.string.filter_all,
                "CONFIRMED" to R.string.filter_confirmed,
                "PENDING" to R.string.filter_pending,
                "EXPIRED" to R.string.filter_expired
            ).forEach { (value, label) ->
                FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(stringResource(label)) })
            }
        }
        error?.let { Text(it, color = NilePayTheme.colors.destructive) }
        if (loading && payments.isEmpty()) {
            repeat(3) { NilePaySkeletonCard(height = 84.dp) }
        } else if (visible.isEmpty()) {
            NilePayCard {
                NilePayEmptyState(
                    title = stringResource(if (payments.isEmpty()) R.string.no_payments_title else R.string.no_matching_payments),
                    subtitle = stringResource(if (payments.isEmpty()) R.string.payments_empty_message else R.string.change_filters),
                    icon = Icons.AutoMirrored.Filled.ReceiptLong
                )
            }
        } else {
            visible.forEach { PaymentCard(it) }
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
private fun PaymentCard(payment: MerchantPayment) {
    NilePayCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(CircleShape).background(NilePayTheme.colors.surfaceSubtle),
                    contentAlignment = Alignment.Center
                ) { Icon(Icons.Filled.Payments, null, tint = NilePayTheme.colors.primary) }
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(payment.sender, style = NilePayTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(payment.createdAt.take(10), style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                }
                NilePayAmountText(payment.amountEgp)
            }
            NilePayStatusChip(
                status = when (payment.status) {
                    "CONFIRMED" -> NilePayStatus.Confirmed
                    "EXPIRED" -> NilePayStatus.Expired
                    "FAILED", "REJECTED" -> NilePayStatus.Failed
                    else -> NilePayStatus.Pending
                }
            )
        }
    }
}

@Composable
private fun HealthScreen(
    contentPadding: PaddingValues,
    notificationAccess: Boolean,
    queuedEvents: Int,
    attentionEvents: Int,
    onOpenSettings: () -> Unit
) {
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.health_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayCard {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                HealthHeader(notificationAccess)
                HealthCheckRow(
                    icon = Icons.Filled.HealthAndSafety,
                    title = stringResource(R.string.notification_access),
                    detail = stringResource(if (notificationAccess) R.string.notification_access_on else R.string.notification_access_off),
                    healthy = notificationAccess
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
                    detail = if (attentionEvents > 0) stringResource(R.string.attention_uploads, attentionEvents)
                    else if (queuedEvents > 0) stringResource(R.string.queued_uploads, queuedEvents)
                    else stringResource(R.string.no_pending_uploads),
                    healthy = attentionEvents == 0
                )
                NilePayButton(
                    text = stringResource(R.string.open_notification_access),
                    onClick = onOpenSettings,
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
private fun HealthHeader(notificationAccess: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(if (notificationAccess) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending)
        )
        Column(Modifier.padding(start = 12.dp)) {
            Text(
                stringResource(if (notificationAccess) R.string.detection_ready else R.string.detection_needs_setup),
                style = NilePayTheme.typography.titleLarge,
                color = NilePayTheme.colors.onSurface
            )
            Text(
                stringResource(if (notificationAccess) R.string.detection_ready_detail else R.string.detection_needs_setup_detail),
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
        }
    }
}

private fun hasNotificationAccess(context: android.content.Context): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
    val component = ComponentName(context, com.nilepay.merchant.detection.InstaPayNotificationListener::class.java)
    return enabled.split(':').any { ComponentName.unflattenFromString(it) == component }
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
private fun SettingsScreen(contentPadding: PaddingValues, session: MerchantSession, onSignOut: () -> Unit) {
    val context = LocalContext.current
    fun open(url: String) = context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
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
                    session.businessName.ifBlank { stringResource(R.string.account_not_loaded) },
                    style = NilePayTheme.typography.headlineSmall,
                    color = NilePayTheme.colors.onSurface
                )
                Text(
                    session.merchantEmail.ifBlank { stringResource(R.string.sign_in_account_hint) },
                    style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
            }
        }
        SettingsRow(Icons.Filled.AccountCircle, stringResource(R.string.profile_and_business), stringResource(R.string.profile_and_business_detail)) {
            open("https://nilepay.runasp.net/#settings/")
        }
        SettingsRow(Icons.Filled.HealthAndSafety, stringResource(R.string.notification_preferences), stringResource(R.string.notification_preferences_detail)) {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        SettingsRow(Icons.Filled.Shield, stringResource(R.string.privacy_and_security), stringResource(R.string.privacy_and_security_detail)) {
            open("https://nilepay.runasp.net/#security/")
        }
        SettingsRow(Icons.AutoMirrored.Filled.HelpOutline, stringResource(R.string.help_and_support), stringResource(R.string.help_and_support_detail)) {
            open("https://nilepay.runasp.net/#documentation/")
        }
        NilePayButton(
            text = stringResource(R.string.logout),
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
            style = NilePayButtonStyle.Destructive
        )
        Text(
            stringResource(R.string.version_label),
            style = NilePayTheme.typography.bodySmall,
            color = NilePayTheme.colors.onSurfaceSecondary,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    NilePayCard(onClick = onClick) {
        NilePayListRow(
            title = title,
            subtitle = subtitle,
            leading = { Icon(icon, contentDescription = null, tint = NilePayTheme.colors.primary) },
            trailing = { Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = NilePayTheme.colors.onSurfaceSecondary) }
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
