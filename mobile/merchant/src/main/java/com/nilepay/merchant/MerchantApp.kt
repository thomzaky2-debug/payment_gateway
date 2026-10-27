package com.nilepay.merchant

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nilepay.designsystem.R as DesignR
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
import com.nilepay.designsystem.components.NilePayBottomNav
import com.nilepay.designsystem.components.NilePayBottomNavItem
import com.nilepay.designsystem.components.NilePayBottomSheet
import com.nilepay.designsystem.components.NilePayButton
import com.nilepay.designsystem.components.NilePayButtonStyle
import com.nilepay.designsystem.components.NilePayCard
import com.nilepay.designsystem.components.NilePayDisclosureLayout
import com.nilepay.designsystem.components.NilePayEmptyState
import com.nilepay.designsystem.components.NilePayLogo
import com.nilepay.designsystem.components.NilePayOtpField
import com.nilepay.designsystem.components.NilePayPasswordField
import com.nilepay.designsystem.components.NilePaySkeletonCard
import com.nilepay.designsystem.components.NilePayStatus
import com.nilepay.designsystem.components.NilePayStatusChip
import com.nilepay.designsystem.components.NilePayTextField
import com.nilepay.designsystem.components.NilePayTopBar
import com.nilepay.designsystem.components.labelResource
import com.nilepay.designsystem.theme.NilePayTheme
import com.nilepay.merchant.detection.DetectionDatabase
import com.nilepay.merchant.detection.DetectorKeepAliveService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
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
    val preferences = remember { MerchantPreferences(context) }
    var theme by remember { mutableStateOf(preferences.theme) }
    var signedIn by remember { mutableStateOf(session.isSignedIn) }
    var consented by remember { mutableStateOf(session.hasDisclosureConsent) }
    var mobileConfig by remember { mutableStateOf<MobileConfig?>(null) }

    LaunchedEffect(Unit) {
        runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).mobileConfig() } }
            .onSuccess { mobileConfig = it }
    }

    val darkTheme = when (theme) {
        MerchantTheme.System -> isSystemInDarkTheme()
        MerchantTheme.Light -> false
        MerchantTheme.Dark -> true
    }
    NilePayTheme(darkTheme = darkTheme, compact = preferences.compact) {
        when {
            mobileConfig?.updateRequired == true -> UpdateRequiredScreen(mobileConfig!!)
            !signedIn -> LoginScreen(session = session, onSignedIn = { signedIn = true })
            !consented -> {
                NilePayDisclosureLayout(
                    onAgree = {
                        session.recordConsent()
                        consented = true
                        DetectorKeepAliveService.ensureRunning(context)
                        if (!DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)) {
                            DetectorKeepAliveService.requestIgnoreBatteryOptimizations(context)
                        }
                        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                    },
                    onCancel = {
                        DetectorKeepAliveService.stop(context)
                        session.signOut()
                        signedIn = false
                        consented = false
                    }
                )
            }
            else -> MerchantWorkspace(
                session = session,
                preferences = preferences,
                selectedTheme = theme,
                onThemeChanged = { selected ->
                    preferences.theme = selected
                    theme = selected
                },
                onSignOut = {
                    DetectorKeepAliveService.stop(context)
                    session.signOut()
                    signedIn = false
                    consented = false
                }
            )
        }
    }
}

@Composable
private fun MerchantWorkspace(
    session: MerchantSession,
    preferences: MerchantPreferences,
    selectedTheme: MerchantTheme,
    onThemeChanged: (MerchantTheme) -> Unit,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    var destination by remember { mutableStateOf(MerchantDestination.Overview) }
    var dashboard by remember { mutableStateOf<DashboardSnapshot?>(null) }
    var dashboardError by remember { mutableStateOf<String?>(null) }
    var payments by remember { mutableStateOf<List<MerchantPayment>>(emptyList()) }
    var paymentsError by remember { mutableStateOf<String?>(null) }
    var notificationAccess by remember { mutableStateOf(hasNotificationAccess(context)) }
    var batteryUnrestricted by remember { mutableStateOf(DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)) }
    var queuedEvents by remember { mutableStateOf(0) }
    var attentionEvents by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var refreshKey by remember { mutableStateOf(0) }
    var hasObservedFirstResume by remember { mutableStateOf(false) }
    var selectedPayment by remember { mutableStateOf<MerchantPayment?>(null) }
    var merchantProfile by remember { mutableStateOf(MerchantProfile(session.businessName, session.merchantEmail, null)) }
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                notificationAccess = hasNotificationAccess(context)
                batteryUnrestricted = DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)
                DetectorKeepAliveService.ensureRunning(context)
                if (hasObservedFirstResume) refreshKey++ else hasObservedFirstResume = true
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(refreshKey) {
        loading = true
        DetectorKeepAliveService.ensureRunning(context)
        batteryUnrestricted = DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)
        runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).profile() } }
            .onSuccess { merchantProfile = it }
            .onFailure { if (it is kotlinx.coroutines.CancellationException) throw it }
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

    Scaffold(
        containerColor = NilePayTheme.colors.background,
        topBar = {
            NilePayTopBar(
                title = stringResource(destination.titleRes),
                actions = {
                    IconButton(onClick = { refreshKey++ }, enabled = !loading) {
                        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Filled.Refresh, stringResource(R.string.action_refresh))
                    }
                    IconButton(onClick = { destination = MerchantDestination.Settings }) {
                        MerchantAvatar(merchantProfile.imageData, merchantProfile.businessName, Modifier.size(34.dp))
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
                dashboardError = dashboardError ?: paymentsError,
                payments = payments.take(3),
                notificationAccess = notificationAccess,
                loading = loading,
                onPaymentSelected = { selectedPayment = it },
                onReviewSetup = { destination = MerchantDestination.Health }
            )
            MerchantDestination.Payments -> PaymentsScreen(
                contentPadding, session, refreshKey,
                onPaymentSelected = { selectedPayment = it }
            )
            MerchantDestination.Health -> HealthScreen(
                contentPadding,
                session,
                notificationAccess,
                batteryUnrestricted,
                queuedEvents,
                attentionEvents,
                onOpenSettings = {
                    context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                    notificationAccess = hasNotificationAccess(context)
                },
                onAllowUnrestrictedBattery = {
                    DetectorKeepAliveService.requestIgnoreBatteryOptimizations(context)
                    batteryUnrestricted = DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)
                },
                onRetryQueue = {
                    kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                        com.nilepay.merchant.detection.DetectorWork.retryQueued(context)
                        withContext(Dispatchers.Main) { refreshKey++ }
                    }
                }
            )
            MerchantDestination.Settings -> SettingsScreen(
                contentPadding, session, merchantProfile, preferences, selectedTheme, onThemeChanged
            ) {
                kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                    MobileGatewayClient(session).logout()
                    withContext(Dispatchers.Main) { onSignOut() }
                }
            }
        }
    }
    selectedPayment?.let { payment ->
        PaymentDetailsSheet(payment = payment, onDismiss = { selectedPayment = null })
    }
}

@Composable
private fun UpdateRequiredScreen(config: MobileConfig) {
    val context = LocalContext.current
    Column(
        Modifier
            .fillMaxSize()
            .background(NilePayTheme.colors.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier
                .size(72.dp)
                .clip(CircleShape)
                .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Filled.SystemUpdate, null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(36.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.update_required), style = NilePayTheme.typography.headlineLarge, color = NilePayTheme.colors.onBackground)
        Spacer(Modifier.height(8.dp))
        Text(
            config.message ?: stringResource(R.string.update_required_detail, config.minimumVersion),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(20.dp))
        NilePayButton(
            text = stringResource(R.string.open_download_page),
            onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://nilepay.runasp.net/#detector/"))) },
            modifier = Modifier.fillMaxWidth()
        )
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(NilePayTheme.colors.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(84.dp)
                .clip(CircleShape)
                .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            NilePayLogo(modifier = Modifier.size(64.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(R.string.login_title),
            style = NilePayTheme.typography.headlineLarge,
            color = NilePayTheme.colors.onBackground,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(4.dp))
        Text(
            stringResource(R.string.login_subtitle),
            style = NilePayTheme.typography.bodyLarge,
            color = NilePayTheme.colors.onSurfaceSecondary,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(22.dp))

        NilePayCard {
            Column {
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
                    Spacer(Modifier.height(20.dp))
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
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(NilePayTheme.shapes.medium)
                            .background(NilePayTheme.colors.destructive.copy(alpha = 0.12f))
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Text(it, style = NilePayTheme.typography.bodyMedium, color = NilePayTheme.colors.destructive)
                    }
                }
                Spacer(Modifier.height(20.dp))
                NilePayButton(
                    text = if (busy) stringResource(R.string.login_working) else if (verificationId == null) stringResource(R.string.login_continue) else stringResource(R.string.login_verify),
                    onClick = ::submit,
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Primary,
                    enabled = !busy
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 8.dp)
        ) {
            Icon(
                Icons.Filled.Shield,
                contentDescription = null,
                tint = NilePayTheme.colors.primary,
                modifier = Modifier.size(16.dp)
            )
            Spacer(Modifier.width(6.dp))
            Text(
                stringResource(R.string.login_security_note),
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
        }
        PrivacyNoticeLink()
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
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.md),
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
    onPaymentSelected: (MerchantPayment) -> Unit,
    onReviewSetup: () -> Unit
) {
    ScreenColumn(contentPadding) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = stringResource(R.string.overview_greeting),
                style = NilePayTheme.typography.headlineMedium,
                color = NilePayTheme.colors.onBackground,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                text = stringResource(R.string.overview_subtitle),
                style = NilePayTheme.typography.bodyMedium,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
        }

        DetectorHeroCard(notificationAccess, onReviewSetup)

        dashboardError?.let {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(NilePayTheme.shapes.medium)
                    .background(NilePayTheme.colors.destructive.copy(alpha = 0.12f))
                    .padding(horizontal = 12.dp, vertical = 10.dp)
            ) {
                Text(
                    text = it,
                    style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.destructive
                )
            }
        }

        if (loading && dashboard == null) {
            NilePaySkeletonCard()
            NilePaySkeletonCard()
        } else dashboard?.let { DashboardSummaryCard(it) }

        SectionTitle(stringResource(R.string.recent_payments))
        if (payments.isEmpty()) NilePayCard {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                NilePayEmptyState(
                    title = stringResource(R.string.no_payments_title),
                    subtitle = stringResource(R.string.no_payments_message),
                    icon = Icons.Filled.Payments
                )
            }
        } else payments.forEach { PaymentCard(it, onPaymentSelected) }
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
                        .clip(CircleShape)
                        .background(if (enabled) NilePayTheme.colors.statusConfirmedContainer else NilePayTheme.colors.statusPendingContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (enabled) Icons.Filled.Wifi else Icons.Filled.WifiOff,
                        contentDescription = null,
                        tint = if (enabled) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending,
                        modifier = Modifier.size(22.dp)
                    )
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            stringResource(if (enabled) R.string.detection_ready else R.string.detector_off),
                            style = NilePayTheme.typography.titleLarge,
                            color = NilePayTheme.colors.onSurface
                        )
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (enabled) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending)
                        )
                    }
                    Text(
                        stringResource(if (enabled) R.string.detection_ready_detail else R.string.detector_off_detail),
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
            if (!enabled) NilePayButton(
                text = stringResource(R.string.review_detector_setup),
                onClick = onReviewSetup,
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Primary
            )
        }
    }
}

@Composable
private fun DashboardSummaryCard(snapshot: DashboardSnapshot) {
    val quotaProgress = if (snapshot.quotaLimit > 0) {
        (snapshot.quotaCount.toFloat() / snapshot.quotaLimit.toFloat()).coerceIn(0f, 1f)
    } else 0f

    NilePayCard {
        Column {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(NilePayTheme.shapes.medium)
                    .background(NilePayTheme.colors.primary.copy(alpha = 0.12f))
                    .border(1.dp, NilePayTheme.colors.primary.copy(alpha = 0.24f), NilePayTheme.shapes.medium)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    stringResource(R.string.metric_received_today),
                    style = NilePayTheme.typography.labelMedium,
                    color = NilePayTheme.colors.primary
                )
                NilePayAmountText(snapshot.todayTotalEgp, size = NilePayAmountSize.Large)
                Text(
                    stringResource(R.string.received_today_detail),
                    style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary
                )
            }
            Spacer(Modifier.height(10.dp))
            HorizontalDivider(color = NilePayTheme.colors.borderSubtle)
            DashboardMetricRow(
                icon = Icons.Filled.Payments,
                label = stringResource(R.string.metric_payments_today),
                detail = stringResource(R.string.payment_count_label),
                value = { Text(snapshot.todayCount.toString(), style = NilePayTheme.typography.amountMedium) }
            )
            HorizontalDivider(color = NilePayTheme.colors.borderSubtle)
            DashboardMetricRow(
                icon = Icons.Filled.Refresh,
                label = stringResource(R.string.metric_pending),
                detail = stringResource(R.string.awaiting_confirmation),
                value = { Text(snapshot.pendingCount.toString(), style = NilePayTheme.typography.amountMedium) }
            )
            HorizontalDivider(color = NilePayTheme.colors.borderSubtle)
            DashboardMetricRow(
                icon = Icons.Filled.Shield,
                label = stringResource(R.string.metric_quota),
                detail = stringResource(R.string.current_plan_usage),
                value = { Text("${snapshot.quotaCount} / ${snapshot.quotaLimit}", style = NilePayTheme.typography.amountMedium) }
            )
            if (snapshot.quotaLimit > 0) {
                LinearProgressIndicator(
                    progress = { quotaProgress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(CircleShape),
                    color = NilePayTheme.colors.primary,
                    trackColor = NilePayTheme.colors.surfaceSubtle
                )
            }
        }
    }
}

@Composable
private fun DashboardMetricRow(
    icon: ImageVector,
    label: String,
    detail: String,
    value: @Composable () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(18.dp))
        }
        Column(
            Modifier
                .weight(1f)
                .padding(horizontal = 12.dp)
        ) {
            Text(label, style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.onSurface)
            Text(detail, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
        }
        value()
    }
}

@Composable
private fun PaymentsScreen(
    contentPadding: PaddingValues,
    session: MerchantSession,
    refreshKey: Int,
    onPaymentSelected: (MerchantPayment) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf("ALL") }
    var payments by remember { mutableStateOf<List<MerchantPayment>>(emptyList()) }
    var nextCursor by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var generation by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(filter, query, refreshKey) {
        generation++
        loading = true
        error = null
        payments = emptyList()
        nextCursor = null
        delay(300)
        runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).paymentPage(filter, query.trim()) } }
            .onSuccess { payments = it.payments; nextCursor = it.nextCursor }
            .onFailure { if (it is kotlinx.coroutines.CancellationException) throw it; error = it.message }
        loading = false
    }
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.payments_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayTextField(
            value = query,
            onValueChange = { query = it.take(200) },
            label = stringResource(R.string.search_payments_hint),
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) }
        )
        Row(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf(
                "ALL" to R.string.filter_all,
                "PENDING" to DesignR.string.status_pending,
                "CONFIRMED" to DesignR.string.status_confirmed,
                "OVERPAID" to DesignR.string.status_overpaid,
                "UNDERPAID" to DesignR.string.status_underpaid,
                "LATE_EXPIRED" to R.string.filter_late_expired,
                "UNMATCHED" to DesignR.string.status_unmatched,
                "RISK_REVIEW" to DesignR.string.status_risk_review,
                "DUPLICATE_SUSPECT" to DesignR.string.status_duplicate_suspect,
                "SENDER_MISMATCH" to DesignR.string.status_sender_mismatch,
                "FAILED" to DesignR.string.status_failed
            ).forEach { (value, label) ->
                FilterChip(selected = filter == value, onClick = { filter = value }, label = { Text(stringResource(label)) })
            }
        }
        error?.let { Text(it, color = NilePayTheme.colors.destructive) }
        if (loading && payments.isEmpty()) {
            repeat(3) { NilePaySkeletonCard(height = 84.dp) }
        } else if (payments.isEmpty() && error == null) {
            NilePayCard {
                NilePayEmptyState(
                    title = stringResource(R.string.no_matching_payments),
                    subtitle = stringResource(R.string.change_filters),
                    icon = Icons.AutoMirrored.Filled.ReceiptLong
                )
            }
        } else {
            payments.forEach { PaymentCard(it, onPaymentSelected) }
        }
        if (nextCursor != null) NilePayButton(
            text = stringResource(R.string.load_more_payments),
            enabled = !loading,
            onClick = {
                val cursor = nextCursor ?: return@NilePayButton
                val requestGeneration = generation
                scope.launch {
                    loading = true
                    error = null
                    runCatching { withContext(Dispatchers.IO) { MobileGatewayClient(session).paymentPage(filter, query.trim(), cursor) } }
                        .onSuccess { page ->
                            if (generation == requestGeneration) {
                                payments = (payments + page.payments).distinctBy { it.source + ":" + it.id }
                                nextCursor = page.nextCursor
                            }
                        }
                        .onFailure {
                            if (it is kotlinx.coroutines.CancellationException) throw it
                            if (generation == requestGeneration) error = it.message
                        }
                    if (generation == requestGeneration) loading = false
                }
            },
            modifier = Modifier.fillMaxWidth(),
            style = NilePayButtonStyle.Secondary
        )
    }
}

@Composable
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
private fun PaymentCard(payment: MerchantPayment, onClick: (MerchantPayment) -> Unit) {
    val paymentStatus = NilePayStatus.fromApiStatus(payment.status)
    val iconBg = when (paymentStatus) {
        NilePayStatus.Confirmed -> NilePayTheme.colors.statusConfirmedContainer
        NilePayStatus.Pending -> NilePayTheme.colors.statusPendingContainer
        else -> NilePayTheme.colors.surfaceSubtle
    }
    val iconTint = when (paymentStatus) {
        NilePayStatus.Confirmed -> NilePayTheme.colors.statusConfirmed
        NilePayStatus.Pending -> NilePayTheme.colors.statusPending
        else -> NilePayTheme.colors.primary
    }

    NilePayCard(onClick = { onClick(payment) }) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(iconBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Payments, null, tint = iconTint, modifier = Modifier.size(20.dp))
                }
                Column(
                    Modifier
                        .weight(1f)
                        .padding(horizontal = 12.dp)
                ) {
                    Text(
                        payment.sender,
                        style = NilePayTheme.typography.titleMedium,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        payment.createdAt.replace('T', ' ').take(16),
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
            FlowRow(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                NilePayStatusChip(status = paymentStatus)
                NilePayAmountText(payment.amountEgp, size = NilePayAmountSize.Medium)
            }
            payment.receivedAmountEgp?.let { received ->
                if (payment.expectedAmountEgp != null && received != payment.expectedAmountEgp) {
                    Text(
                        stringResource(R.string.payment_received) + ": " + "%.2f EGP".format(received),
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun PaymentDetailsSheet(payment: MerchantPayment, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val paymentStatus = NilePayStatus.fromApiStatus(payment.status)
    val status = stringResource(paymentStatus.labelResource())
    val needsReview = paymentStatus in setOf(
        NilePayStatus.Overpaid,
        NilePayStatus.Underpaid,
        NilePayStatus.LatePayment,
        NilePayStatus.Unmatched,
        NilePayStatus.RiskReview,
        NilePayStatus.DuplicateSuspect,
        NilePayStatus.SenderMismatch,
        NilePayStatus.Unknown
    )
    val unavailable = stringResource(R.string.not_available)
    fun amount(value: Double?) = value?.let { "%.2f EGP".format(it) } ?: unavailable
    val paymentId = payment.sessionId.ifBlank { payment.id }
    val receipt = stringResource(
        R.string.receipt_share_template,
        payment.receivedAmountEgp ?: payment.amountEgp,
        payment.sender,
        status,
        payment.reference ?: stringResource(R.string.not_available),
        paymentId,
        payment.createdAt,
        amount(payment.expectedAmountEgp),
        amount(payment.receivedAmountEgp)
    )
    NilePayBottomSheet(onDismissRequest = onDismiss, title = stringResource(R.string.payment_details)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(NilePayTheme.shapes.medium)
                    .background(NilePayTheme.colors.surfaceSubtle)
                    .padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                NilePayAmountText(payment.receivedAmountEgp ?: payment.amountEgp, size = NilePayAmountSize.Large)
                NilePayStatusChip(status = paymentStatus)
            }

            if (needsReview) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(NilePayTheme.shapes.medium)
                        .background(NilePayTheme.colors.statusPendingContainer)
                        .padding(12.dp)
                ) {
                    Text(
                        stringResource(if (payment.source == "unmatched") R.string.payment_unmatched_hint else R.string.payment_review_hint),
                        style = NilePayTheme.typography.bodyMedium,
                        color = NilePayTheme.colors.onSurface
                    )
                }
                NilePayButton(
                    text = stringResource(R.string.review_on_website),
                    onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://nilepay.runasp.net/#review/"))) },
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Secondary
                )
            }

            NilePayCard {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    DetailRow(stringResource(R.string.payment_sender), payment.sender)
                    DetailRow(stringResource(R.string.payment_status), status)
                    payment.productCategory?.let { DetailRow(stringResource(R.string.product_category), it) }
                    DetailRow(stringResource(R.string.payment_expected), amount(payment.expectedAmountEgp))
                    DetailRow(stringResource(R.string.payment_received), amount(payment.receivedAmountEgp))
                    if (payment.expectedAmountEgp != null && payment.receivedAmountEgp != null) {
                        DetailRow(stringResource(R.string.payment_difference), amount(payment.receivedAmountEgp - payment.expectedAmountEgp))
                    }
                    payment.expiresAt?.let { DetailRow(stringResource(R.string.payment_expiry), it) }
                    if (paymentStatus == NilePayStatus.Unknown) DetailRow("API status", payment.status)
                    DetailRow(stringResource(R.string.payment_date), payment.createdAt)
                    DetailRow(stringResource(R.string.payment_reference), payment.reference ?: stringResource(R.string.not_available))
                    DetailRow(stringResource(R.string.payment_id), paymentId)
                    payment.note?.let { DetailRow(stringResource(R.string.payment_note), it) }
                }
            }

            NilePayButton(
                text = stringResource(R.string.share_receipt),
                onClick = {
                    context.startActivity(
                        Intent.createChooser(
                            Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, receipt)
                            },
                            context.getString(R.string.share_receipt)
                        )
                    )
                },
                modifier = Modifier.fillMaxWidth(),
                style = NilePayButtonStyle.Secondary,
                leadingIcon = { Icon(Icons.Filled.Share, contentDescription = null) }
            )
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column {
        Text(label, style = NilePayTheme.typography.labelMedium, color = NilePayTheme.colors.onSurfaceSecondary)
        Text(value, style = NilePayTheme.typography.bodyMedium, color = NilePayTheme.colors.onSurface)
    }
}

@Composable
private fun HealthScreen(
    contentPadding: PaddingValues,
    session: MerchantSession,
    notificationAccess: Boolean,
    batteryUnrestricted: Boolean,
    queuedEvents: Int,
    attentionEvents: Int,
    onOpenSettings: () -> Unit,
    onAllowUnrestrictedBattery: () -> Unit,
    onRetryQueue: () -> Unit
) {
    val serviceActive = DetectorKeepAliveService.running || session.isSignedIn
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.health_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
        )
        NilePayCard {
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                HealthHeader(notificationAccess && batteryUnrestricted)
                HorizontalDivider(color = NilePayTheme.colors.borderSubtle)
                HealthCheckRow(
                    icon = Icons.Filled.HealthAndSafety,
                    title = stringResource(R.string.notification_access),
                    detail = stringResource(if (notificationAccess) R.string.notification_access_on else R.string.notification_access_off),
                    healthy = notificationAccess
                )
                HealthCheckRow(
                    icon = Icons.Filled.Shield,
                    title = stringResource(R.string.continuous_service_title),
                    detail = stringResource(if (serviceActive) R.string.continuous_service_on else R.string.continuous_service_off),
                    healthy = serviceActive
                )
                HealthCheckRow(
                    icon = Icons.Filled.Wifi,
                    title = stringResource(R.string.battery_protection_title),
                    detail = stringResource(if (batteryUnrestricted) R.string.battery_protection_on else R.string.battery_protection_off),
                    healthy = batteryUnrestricted
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
                HealthCheckRow(
                    icon = Icons.Filled.Refresh,
                    title = stringResource(R.string.last_heartbeat),
                    detail = formatDeviceTime(session.lastHeartbeatAt),
                    healthy = session.lastHeartbeatAt > 0
                )
                HealthCheckRow(
                    icon = Icons.Filled.Payments,
                    title = stringResource(R.string.last_detected_payment),
                    detail = formatDeviceTime(session.lastDetectedAt),
                    healthy = session.lastDetectedAt > 0
                )
                if (!batteryUnrestricted) {
                    NilePayButton(
                        text = stringResource(R.string.allow_unrestricted_battery),
                        onClick = onAllowUnrestrictedBattery,
                        modifier = Modifier.fillMaxWidth(),
                        style = NilePayButtonStyle.Primary
                    )
                }
                if (queuedEvents > 0) NilePayButton(
                    text = stringResource(R.string.retry_queued_uploads),
                    onClick = onRetryQueue,
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Secondary
                )
                NilePayButton(
                    text = stringResource(R.string.open_notification_access),
                    onClick = onOpenSettings,
                    modifier = Modifier.fillMaxWidth(),
                    style = if (batteryUnrestricted) NilePayButtonStyle.Primary else NilePayButtonStyle.Secondary
                )
            }
        }
        NilePayCard {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Filled.Shield, contentDescription = null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(20.dp))
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
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
}

private fun formatDeviceTime(timestamp: Long): String = if (timestamp <= 0L) {
    "—"
} else {
    java.text.DateFormat.getDateTimeInstance(java.text.DateFormat.SHORT, java.text.DateFormat.SHORT)
        .format(java.util.Date(timestamp))
}

@Composable
private fun HealthHeader(notificationAccess: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (notificationAccess) NilePayTheme.colors.statusConfirmedContainer else NilePayTheme.colors.statusPendingContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (notificationAccess) Icons.Filled.Wifi else Icons.Filled.WifiOff,
                contentDescription = null,
                tint = if (notificationAccess) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending,
                modifier = Modifier.size(22.dp)
            )
        }
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
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(if (healthy) NilePayTheme.colors.statusConfirmedContainer else NilePayTheme.colors.statusPendingContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (healthy) NilePayTheme.colors.statusConfirmed else NilePayTheme.colors.statusPending,
                modifier = Modifier.size(18.dp)
            )
        }
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
private fun SettingsScreen(
    contentPadding: PaddingValues,
    session: MerchantSession,
    profile: MerchantProfile,
    preferences: MerchantPreferences,
    selectedTheme: MerchantTheme,
    onThemeChanged: (MerchantTheme) -> Unit,
    onSignOut: () -> Unit
) {
    val context = LocalContext.current
    var confirmSignOut by remember { mutableStateOf(false) }
    fun open(url: String) = context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    if (confirmSignOut) AlertDialog(
        onDismissRequest = { confirmSignOut = false },
        title = { Text(stringResource(R.string.logout)) },
        text = { Text(stringResource(R.string.signout_explanation)) },
        confirmButton = { TextButton(onClick = { confirmSignOut = false; onSignOut() }) { Text(stringResource(R.string.logout)) } },
        dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text(stringResource(R.string.keep_signed_in)) } }
    )
    ScreenColumn(contentPadding) {
        NilePayCard {
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                MerchantAvatar(profile.imageData, profile.businessName, Modifier.size(64.dp))
                Column(Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.merchant_account),
                        style = NilePayTheme.typography.labelMedium,
                        color = NilePayTheme.colors.primary
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        profile.businessName.ifBlank { stringResource(R.string.account_not_loaded) },
                        style = NilePayTheme.typography.headlineSmall,
                        color = NilePayTheme.colors.onSurface
                    )
                    Text(
                        profile.email.ifBlank { stringResource(R.string.sign_in_account_hint) },
                        style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }
        }
        SectionTitle(stringResource(R.string.appearance_and_language))
        NilePayCard {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(stringResource(R.string.compact_layout), style = NilePayTheme.typography.titleMedium)
                        Text(stringResource(R.string.compact_layout_detail), style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                    }
                    Switch(checked = preferences.compact, onCheckedChange = {
                        preferences.compact = it
                        (context as? Activity)?.recreate()
                    })
                }
                HorizontalDivider(color = NilePayTheme.colors.border)
                Text(stringResource(R.string.theme_label), style = NilePayTheme.typography.labelMedium, color = NilePayTheme.colors.onSurfaceSecondary)
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        MerchantTheme.System to R.string.theme_system,
                        MerchantTheme.Light to R.string.theme_light,
                        MerchantTheme.Dark to R.string.theme_dark
                    ).forEach { (value, label) ->
                        FilterChip(
                            selected = selectedTheme == value,
                            onClick = { onThemeChanged(value) },
                            label = { Text(stringResource(label)) }
                        )
                    }
                }
                Text(stringResource(R.string.language_label), style = NilePayTheme.typography.labelMedium, color = NilePayTheme.colors.onSurfaceSecondary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = preferences.language == "en",
                        onClick = { preferences.language = "en"; (context as? Activity)?.recreate() },
                        label = { Text(stringResource(R.string.language_english)) }
                    )
                    FilterChip(
                        selected = preferences.language == "ar",
                        onClick = { preferences.language = "ar"; (context as? Activity)?.recreate() },
                        label = { Text(stringResource(R.string.language_arabic)) }
                    )
                }
            }
        }
        SettingsRow(Icons.Filled.AccountCircle, stringResource(R.string.profile_and_business), stringResource(R.string.profile_and_business_detail)) {
            open("https://nilepay.runasp.net/#settings/")
        }
        SettingsRow(Icons.Filled.Settings, stringResource(R.string.app_notifications), stringResource(R.string.app_notifications_detail)) {
            context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
        }
        SettingsRow(Icons.Filled.HealthAndSafety, stringResource(R.string.notification_preferences), stringResource(R.string.notification_preferences_detail)) {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        SettingsRow(Icons.Filled.Shield, stringResource(R.string.battery_settings_row_title), stringResource(R.string.battery_settings_row_detail)) {
            DetectorKeepAliveService.requestIgnoreBatteryOptimizations(context)
        }
        PrivacyNoticeLink()
        SettingsRow(Icons.Filled.Shield, stringResource(R.string.delete_account_title), stringResource(R.string.delete_account_detail)) {
            open("${BuildConfig.API_BASE_URL.trimEnd('/')}/account-deletion")
        }
        SettingsRow(Icons.AutoMirrored.Filled.HelpOutline, stringResource(R.string.help_and_support), stringResource(R.string.help_and_support_detail)) {
            open("https://nilepay.runasp.net/#support/")
        }
        NilePayButton(
            text = stringResource(R.string.logout),
            onClick = { confirmSignOut = true },
            modifier = Modifier.fillMaxWidth(),
            style = NilePayButtonStyle.Destructive
        )
        Text(
            "NilePay • ${BuildConfig.VERSION_NAME}",
            style = NilePayTheme.typography.bodySmall,
            color = NilePayTheme.colors.onSurfaceSecondary,
            modifier = Modifier.align(Alignment.CenterHorizontally)
        )
    }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    NilePayCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(NilePayTheme.colors.primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(22.dp))
            }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                Text(title, style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.onSurface)
                Text(subtitle, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = NilePayTheme.colors.onSurfaceSecondary, modifier = Modifier.size(20.dp))
        }
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

@Composable
private fun PrivacyNoticeLink() {
    val context = LocalContext.current
    var visible by remember { mutableStateOf(false) }
    TextButton(onClick = { visible = true }) { Text(stringResource(R.string.data_notice_title)) }
    if (visible) AlertDialog(
        onDismissRequest = { visible = false },
        title = { Text(stringResource(R.string.data_notice_title)) },
        text = { Text(stringResource(R.string.data_notice_body), modifier = Modifier.verticalScroll(rememberScrollState())) },
        confirmButton = {
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.API_BASE_URL.trimEnd('/')}/privacy")))
            }) { Text(stringResource(R.string.full_privacy_policy)) }
        },
        dismissButton = { TextButton(onClick = { visible = false }) { Text(stringResource(R.string.close_notice)) } }
    )
}
