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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nilepay.designsystem.R as DesignR
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
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
import com.nilepay.designsystem.components.labelResource
import com.nilepay.designsystem.theme.NilePayTheme
import com.nilepay.merchant.detection.DetectionDatabase
import com.nilepay.merchant.detection.DetectorKeepAliveService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal enum class MerchantDestination(
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
        runCatching { withContext(Dispatchers.IO) { session.gatewayClient.mobileConfig() } }
            .onSuccess { mobileConfig = it }
    }

    val darkTheme = when (theme) {
        MerchantTheme.System -> isSystemInDarkTheme()
        MerchantTheme.Light -> false
        MerchantTheme.Dark -> true
    }
    NilePayTheme(darkTheme = darkTheme, compact = preferences.compact, storeStyle = true) {
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
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    var destination by remember { mutableStateOf(MerchantDestination.Overview) }
    var searchQuery by remember { mutableStateOf("") }
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
    val workspaceScope = rememberCoroutineScope()
    var detectorConnected by remember { mutableStateOf(false) }
    var retrying by remember { mutableStateOf(false) }
    var retryFeedback by remember { mutableStateOf<String?>(null) }
    var uploadError by remember { mutableStateOf<String?>(null) }
    var diagnosticsAt by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(destination) {
        if (destination != MerchantDestination.Health && destination != MerchantDestination.Overview) return@LaunchedEffect
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
        while (true) {
            withContext(Dispatchers.IO) {
                val events = DetectionDatabase.get(context).events().all()
                queuedEvents = events.size
                attentionEvents = events.count { it.needsAttention }
                uploadError = events.mapNotNull { it.lastError }.distinct().joinToString("; ").ifBlank { null }
            }
            notificationAccess = hasNotificationAccess(context)
            batteryUnrestricted = DetectorKeepAliveService.isIgnoringBatteryOptimizations(context)
            detectorConnected = com.nilepay.merchant.detection.InstaPayNotificationListener.connected && DetectorKeepAliveService.running
            diagnosticsAt = System.currentTimeMillis()
            delay(10_000)
        }
    }
    }

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
        runCatching { withContext(Dispatchers.IO) { session.gatewayClient.profile() } }
            .onSuccess { merchantProfile = it }
            .onFailure { if (it is kotlinx.coroutines.CancellationException) throw it }
        com.nilepay.merchant.detection.DetectorWork.heartbeatNow(context)
        runCatching { withContext(Dispatchers.IO) { session.gatewayClient.dashboard() } }
            .onSuccess { dashboard = it; dashboardError = null }
            .onFailure { dashboardError = it.message }
        runCatching { withContext(Dispatchers.IO) { session.gatewayClient.recentPayments() } }
            .onSuccess { payments = it; paymentsError = null }
            .onFailure { paymentsError = it.message }
        withContext(Dispatchers.IO) {
            val dao = DetectionDatabase.get(context).events()
            queuedEvents = dao.count()
            attentionEvents = dao.attentionCount()
        }
        loading = false
    }

    MerchantScaffold(destination, merchantProfile, loading,
        onRefresh = { refreshKey++ }, onDestination = { destination = it },
        searchQuery = searchQuery, onSearch = { searchQuery = it; destination = MerchantDestination.Payments }) { contentPadding ->
        when (destination) {
            MerchantDestination.Overview -> OverviewScreen(
                contentPadding = contentPadding,
                dashboard = dashboard,
                dashboardError = dashboardError ?: paymentsError,
                payments = payments.take(9),
                notificationAccess = notificationAccess && detectorConnected,
                loading = loading,
                onPaymentSelected = { focusManager.clearFocus(); keyboard?.hide(); selectedPayment = it },
                onReviewSetup = { destination = MerchantDestination.Health },
                onViewPayments = { destination = MerchantDestination.Payments }
            )
            MerchantDestination.Payments -> PaymentsScreen(
                contentPadding, session, refreshKey, initialQuery = searchQuery,
                onPaymentSelected = { focusManager.clearFocus(); keyboard?.hide(); selectedPayment = it }
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
                retrying = retrying, retryFeedback = retryFeedback,
                uploadError = uploadError, diagnosticsAt = diagnosticsAt,
                onRetryQueue = {
                    workspaceScope.launch {
                        retrying = true
                        retryFeedback = null
                        try {
                            withContext(Dispatchers.IO) { com.nilepay.merchant.detection.DetectorWork.retryQueued(context) }
                            retryFeedback = context.getString(R.string.retry_scheduled)
                        } catch (error: Exception) {
                            if (error is kotlinx.coroutines.CancellationException) throw error
                            retryFeedback = error.message ?: context.getString(R.string.retry_failed)
                        } finally { retrying = false }
                    }
                }
            )
            MerchantDestination.Settings -> SettingsScreen(
                contentPadding, session, merchantProfile, preferences, selectedTheme, onThemeChanged
            ) {
                kotlinx.coroutines.CoroutineScope(Dispatchers.IO).launch {
                    session.gatewayClient.logout()
                    withContext(Dispatchers.Main) { onSignOut() }
                }
            }
        }
    }
    selectedPayment?.let { payment ->
        PaymentDetailsDialog(payment = payment, onDismiss = { selectedPayment = null })
    }
}

@Composable
internal fun MerchantScaffold(
    destination: MerchantDestination,
    merchantProfile: MerchantProfile,
    loading: Boolean,
    onRefresh: () -> Unit,
    onDestination: (MerchantDestination) -> Unit,
    searchQuery: String = "",
    onSearch: (String) -> Unit = {},
    content: @Composable (PaddingValues) -> Unit
) {
    val focusManager = LocalFocusManager.current
    val keyboard = LocalSoftwareKeyboardController.current
    val view = LocalView.current
    var searchActive by remember { mutableStateOf(false) }
    val searchFocus = remember { FocusRequester() }
    LaunchedEffect(searchActive) { if (searchActive) searchFocus.requestFocus() }
    fun dismissSearch() {
        focusManager.clearFocus(force = true)
        keyboard?.hide()
        // Older Android keyboards can outlive Compose's text-input session.
        val inputMethod = view.context.getSystemService(android.content.Context.INPUT_METHOD_SERVICE)
            as? android.view.inputmethod.InputMethodManager
        inputMethod?.hideSoftInputFromWindow(view.windowToken, 0)
    }
    var navigationEvent by remember { mutableStateOf(0) }
    LaunchedEffect(navigationEvent) {
        androidx.compose.runtime.withFrameNanos { }
        dismissSearch()
    }
    fun navigate(target: MerchantDestination) {
        searchActive = false
        dismissSearch()
        navigationEvent++
        onDestination(target)
    }
    Scaffold(
        containerColor = NilePayTheme.colors.background,
        topBar = {
            Column(Modifier.statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    if (searchActive) TextField(
                        value = searchQuery, onValueChange = { onSearch(it.take(200)) },
                        placeholder = { Text(stringResource(R.string.store_search), maxLines = 1,
                            style = NilePayTheme.typography.bodyMedium) },
                        leadingIcon = { Icon(Icons.Filled.Search, null) },
                        trailingIcon = {
                            IconButton(onClick = { navigate(MerchantDestination.Settings) }) {
                                MerchantAvatar(merchantProfile.imageData, merchantProfile.businessName, Modifier.size(32.dp))
                            }
                        },
                        singleLine = true, shape = CircleShape, modifier = Modifier.weight(1f).focusRequester(searchFocus),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = NilePayTheme.colors.surfaceSubtle,
                            unfocusedContainerColor = NilePayTheme.colors.surfaceSubtle,
                            focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                            focusedTextColor = NilePayTheme.colors.onSurface,
                            unfocusedTextColor = NilePayTheme.colors.onSurface,
                            focusedPlaceholderColor = NilePayTheme.colors.onSurfaceSecondary,
                            unfocusedPlaceholderColor = NilePayTheme.colors.onSurfaceSecondary)
                    )
                    else Row(
                        Modifier.weight(1f).heightIn(min = 56.dp).clip(CircleShape)
                            .background(NilePayTheme.colors.surfaceSubtle)
                            .clickable { searchActive = true; onDestination(MerchantDestination.Payments) }
                            .padding(start = 16.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(Icons.Filled.Search, null, tint = NilePayTheme.colors.onSurfaceSecondary)
                        Text(searchQuery.ifBlank { stringResource(R.string.store_search) },
                            Modifier.weight(1f), style = NilePayTheme.typography.bodyMedium,
                            color = NilePayTheme.colors.onSurfaceSecondary, maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                        IconButton(onClick = { navigate(MerchantDestination.Settings) }) {
                            MerchantAvatar(merchantProfile.imageData, merchantProfile.businessName, Modifier.size(32.dp))
                        }
                    }
                    IconButton(onClick = onRefresh, enabled = !loading) {
                        if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Filled.Refresh, stringResource(R.string.action_refresh), tint = NilePayTheme.colors.onSurfaceSecondary)
                    }
                }
                if (destination != MerchantDestination.Settings) {
                    val tabs = listOf(MerchantDestination.Overview, MerchantDestination.Payments, MerchantDestination.Health)
                    TabRow(selectedTabIndex = tabs.indexOf(destination).coerceAtLeast(0),
                        containerColor = NilePayTheme.colors.background, contentColor = NilePayTheme.colors.primary,
                        divider = { HorizontalDivider(color = NilePayTheme.colors.borderSubtle) }) {
                        tabs.forEach { item ->
                            Tab(selected = destination == item, onClick = { navigate(item) },
                                selectedContentColor = NilePayTheme.colors.primary,
                                unselectedContentColor = NilePayTheme.colors.onSurfaceSecondary,
                                text = { Text(stringResource(if (item == MerchantDestination.Overview) R.string.store_for_you else item.labelRes),
                                    style = NilePayTheme.typography.labelLarge, maxLines = 1) })
                        }
                    }
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = NilePayTheme.colors.surface, tonalElevation = 0.dp) {
                MerchantDestination.entries.forEach { item ->
                    NavigationBarItem(
                        selected = destination == item,
                        onClick = { navigate(item) },
                        icon = { Icon(item.icon, null, Modifier.size(24.dp)) },
                        label = { Text(stringResource(item.labelRes), maxLines = 1,
                            style = NilePayTheme.typography.labelSmall, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = 4.dp)) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = NilePayTheme.colors.primary,
                            selectedTextColor = NilePayTheme.colors.onSurface,
                            indicatorColor = NilePayTheme.colors.primary.copy(alpha = 0.16f),
                            unselectedIconColor = NilePayTheme.colors.onSurfaceSecondary,
                            unselectedTextColor = NilePayTheme.colors.onSurfaceSecondary)
                    )
                }
            }
        }
    ) { padding -> content(padding) }
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
internal fun LoginScreen(session: MerchantSession, onSignedIn: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val gateway = remember { session.gatewayClient }
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

        NilePayCard(contentPadding = PaddingValues(12.dp)) {
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
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.md),
        content = content
    )
}

@Composable
internal fun OverviewScreen(
    contentPadding: PaddingValues,
    dashboard: DashboardSnapshot?,
    dashboardError: String?,
    payments: List<MerchantPayment>,
    notificationAccess: Boolean,
    loading: Boolean,
    onPaymentSelected: (MerchantPayment) -> Unit,
    onReviewSetup: () -> Unit,
    onViewPayments: () -> Unit
) {
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val sectionWidth = (configuration.screenWidthDp - 32).coerceAtLeast(200).dp
    val featureWidth = (sectionWidth * 0.9f).coerceAtMost(380.dp)
    ScreenColumn(contentPadding) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.store_business), style = NilePayTheme.typography.titleLarge,
                    color = NilePayTheme.colors.onBackground, modifier = Modifier.semantics { heading() })
                Text(stringResource(R.string.store_live), style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary)
            }
            NilePayLogo(Modifier.size(28.dp))
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.width(featureWidth).clip(NilePayTheme.shapes.extraLarge)
                .background(NilePayTheme.colors.primary.copy(alpha = 0.17f)).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.Payments, null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(22.dp))
                    Text(stringResource(R.string.metric_received_today), style = NilePayTheme.typography.titleMedium,
                        color = NilePayTheme.colors.onSurface)
                }
                if (dashboard != null) NilePayAmountText(dashboard.todayTotalEgp, size = NilePayAmountSize.Large)
                else Text("—", style = NilePayTheme.typography.headlineLarge, color = NilePayTheme.colors.onSurface)
                Text(stringResource(R.string.received_today_detail), style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary)
                NilePayButton(stringResource(R.string.nav_payments), onViewPayments, style = NilePayButtonStyle.Primary)
            }
            Column(Modifier.width(featureWidth).clip(NilePayTheme.shapes.extraLarge)
                .background(NilePayTheme.colors.surfaceCard).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.Shield, null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(22.dp))
                    Text(stringResource(if (notificationAccess) R.string.detection_ready else R.string.detector_off),
                        style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.onSurface)
                }
                Text(stringResource(R.string.overview_subtitle), style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary)
                NilePayButton(stringResource(R.string.nav_health), onReviewSetup, style = NilePayButtonStyle.Secondary)
            }
        }

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
        } else dashboard?.let { snapshot ->
            SectionTitle(stringResource(R.string.store_today))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StoreMetric(stringResource(R.string.metric_payments_today), snapshot.todayCount.toString(), Icons.Filled.Payments, Modifier.weight(1f))
                    StoreMetric(stringResource(R.string.metric_pending), snapshot.pendingCount.toString(), Icons.Filled.Refresh, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StoreMetric(stringResource(R.string.metric_quota), "${snapshot.quotaCount} / ${snapshot.quotaLimit}", Icons.Filled.Shield, Modifier.weight(1f))
                    StoreMetric(stringResource(R.string.average_payment),
                        if (snapshot.todayCount > 0) "%.2f EGP".format(snapshot.todayTotalEgp / snapshot.todayCount) else "—",
                        Icons.Filled.Payments, Modifier.weight(1f))
                }
            }
        }

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.recent_payments), Modifier.weight(1f),
                style = NilePayTheme.typography.titleLarge, color = NilePayTheme.colors.onBackground)
            IconButton(onClick = onViewPayments) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, stringResource(R.string.nav_payments),
                    tint = NilePayTheme.colors.primary, modifier = Modifier.size(20.dp))
            }
        }
        if (payments.isEmpty()) NilePayCard(contentPadding = PaddingValues(12.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                NilePayEmptyState(
                    title = stringResource(R.string.no_payments_title),
                    subtitle = stringResource(R.string.no_payments_message),
                    icon = Icons.Filled.Payments
                )
            }
        } else {
            payments.take(3).forEach { PaymentCard(it, onPaymentSelected) }
        }
        SectionTitle(stringResource(R.string.store_tools))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            MerchantShortcut(stringResource(R.string.nav_payments), Icons.Filled.Payments, Modifier.weight(1f), onViewPayments)
            MerchantShortcut(stringResource(R.string.nav_health), Icons.Filled.Shield, Modifier.weight(1f), onReviewSetup)
        }
        dashboard?.let { snapshot ->
            NilePayButton(stringResource(R.string.share_summary), onClick = {
                val summary = context.getString(R.string.summary_template,
                    snapshot.todayTotalEgp, snapshot.todayCount, snapshot.pendingCount)
                context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"; putExtra(Intent.EXTRA_TEXT, summary)
                }, context.getString(R.string.share_summary)))
            }, modifier = Modifier.fillMaxWidth(), style = NilePayButtonStyle.Secondary,
                leadingIcon = { Icon(Icons.Filled.Share, null) })
        }
    }
}

@Composable
private fun StoreMetric(label: String, value: String, icon: ImageVector, modifier: Modifier) {
    Column(modifier.clip(NilePayTheme.shapes.large)
        .background(NilePayTheme.colors.surfaceCard).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(18.dp))
            Text(value, style = NilePayTheme.typography.titleLarge, color = NilePayTheme.colors.onSurface,
                modifier = Modifier.weight(1f))
        }
        Text(label, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
    }
}

@Composable
private fun MerchantShortcut(label: String, icon: ImageVector, modifier: Modifier, onClick: () -> Unit) {
    Row(modifier.clip(NilePayTheme.shapes.large)
        .background(NilePayTheme.colors.primary.copy(alpha = 0.10f))
        .clickable(onClick = onClick).heightIn(min = 48.dp).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(icon, null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(20.dp))
        Text(label, style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.onSurface,
            modifier = Modifier.weight(1f))
    }
}

@Composable
private fun PaymentsScreen(
    contentPadding: PaddingValues,
    session: MerchantSession,
    refreshKey: Int,
    initialQuery: String = "",
    onPaymentSelected: (MerchantPayment) -> Unit
) {
    val query = initialQuery
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
        runCatching { withContext(Dispatchers.IO) { session.gatewayClient.paymentPage(filter, query.trim()) } }
            .onSuccess { payments = it.payments; nextCursor = it.nextCursor }
            .onFailure { if (it is kotlinx.coroutines.CancellationException) throw it; error = it.message }
        loading = false
    }
    PaymentsContent(contentPadding, payments, filter, { filter = it }, error, loading,
        nextCursor != null, onPaymentSelected, onLoadMore = {
                val cursor = nextCursor ?: return@PaymentsContent
                val requestGeneration = generation
                scope.launch {
                    loading = true
                    error = null
                    runCatching { withContext(Dispatchers.IO) { session.gatewayClient.paymentPage(filter, query.trim(), cursor) } }
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
            })
}

@Composable
internal fun PaymentsContent(
    contentPadding: PaddingValues,
    payments: List<MerchantPayment>,
    filter: String,
    onFilter: (String) -> Unit,
    error: String?,
    loading: Boolean,
    hasMore: Boolean,
    onPaymentSelected: (MerchantPayment) -> Unit,
    onLoadMore: () -> Unit
) {
    val context = LocalContext.current
    var sort by remember { mutableStateOf(PaymentSort.Newest) }
    var period by remember { mutableStateOf(PaymentPeriod.Any) }
    var showFilters by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf<String?>(null) }
    val visible = remember(payments, sort, period) { visiblePayments(payments, sort, period) }
    ScreenColumn(contentPadding) {
        Text(
            stringResource(R.string.payments_subtitle),
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary
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
                FilterChip(selected = filter == value, onClick = { onFilter(value) }, label = { Text(stringResource(label)) })
            }
        }
        TextButton(onClick = { showFilters = !showFilters }) {
            Text(stringResource(if (sort != PaymentSort.Newest || period != PaymentPeriod.Any)
                R.string.filters_active else R.string.filters_sort))
        }
        if (showFilters) {
        Text(stringResource(R.string.loaded_results_hint), style = NilePayTheme.typography.bodySmall,
            color = NilePayTheme.colors.onSurfaceSecondary)
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(PaymentPeriod.Any to R.string.period_all, PaymentPeriod.Today to R.string.period_today,
                PaymentPeriod.Week to R.string.period_week).forEach { (value, label) ->
                FilterChip(period == value, { period = value }, label = { Text(stringResource(label)) })
            }
        }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(PaymentSort.Newest to R.string.sort_newest, PaymentSort.Oldest to R.string.sort_oldest,
                PaymentSort.Highest to R.string.sort_highest, PaymentSort.Lowest to R.string.sort_lowest).forEach { (value, label) ->
                FilterChip(sort == value, { sort = value }, label = { Text(stringResource(label)) })
            }
        }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.visible_count, visible.size, payments.size), Modifier.weight(1f),
                style = NilePayTheme.typography.labelMedium, color = NilePayTheme.colors.onSurfaceSecondary)
            IconButton(onClick = {
                runCatching { sharePaymentExport(context, visible) }.onFailure { exportError = it.message }
            }, enabled = visible.isNotEmpty() && !loading) {
                Icon(Icons.Filled.Share, stringResource(R.string.export_results), tint = NilePayTheme.colors.primary)
            }
        }
        (error ?: exportError)?.let { Text(it, color = NilePayTheme.colors.destructive) }
        if (loading && payments.isEmpty()) {
            repeat(3) { NilePaySkeletonCard(height = 84.dp) }
        } else if (visible.isEmpty() && error == null) {
            NilePayCard(contentPadding = PaddingValues(12.dp)) {
                NilePayEmptyState(
                    title = stringResource(R.string.no_matching_payments),
                    subtitle = stringResource(R.string.change_filters),
                    icon = Icons.AutoMirrored.Filled.ReceiptLong
                )
            }
        } else {
            visible.forEach { PaymentCard(it, onPaymentSelected) }
        }
        if (hasMore) NilePayButton(
            text = stringResource(R.string.load_more_payments),
            enabled = !loading,
            onClick = onLoadMore,
            modifier = Modifier.fillMaxWidth(),
            style = NilePayButtonStyle.Secondary
        )
    }
}

@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun PaymentCard(payment: MerchantPayment, onClick: (MerchantPayment) -> Unit) {
    val paymentStatus = NilePayStatus.fromApiStatus(payment.status)
    val iconBg = when (paymentStatus) {
        NilePayStatus.Confirmed -> NilePayTheme.colors.statusConfirmedContainer
        NilePayStatus.Pending -> NilePayTheme.colors.statusPendingContainer
        NilePayStatus.Failed, NilePayStatus.Expired -> NilePayTheme.colors.statusFailedContainer
        else -> NilePayTheme.colors.surfaceSubtle
    }
    val iconTint = when (paymentStatus) {
        NilePayStatus.Confirmed -> NilePayTheme.colors.statusConfirmed
        NilePayStatus.Pending -> NilePayTheme.colors.statusPending
        NilePayStatus.Failed, NilePayStatus.Expired -> NilePayTheme.colors.statusFailed
        else -> NilePayTheme.colors.primary
    }

    NilePayCard(
        onClick = { onClick(payment) },
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(Modifier.size(30.dp).clip(CircleShape).background(iconBg), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Payments, null, tint = iconTint, modifier = Modifier.size(20.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(payment.sender, style = NilePayTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(CairoTime.formatCard(payment.createdAt), style = NilePayTheme.typography.bodySmall.copy(textDirection = androidx.compose.ui.text.style.TextDirection.Ltr),
                        color = NilePayTheme.colors.onSurfaceSecondary)
                }
            }
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)) {
                NilePayAmountText(payment.receivedAmountEgp ?: payment.amountEgp, size = NilePayAmountSize.Small)
                NilePayStatusChip(status = paymentStatus)
            }
            payment.productCategory?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
            }
        }
    }
}

internal data class OrderProductItem(val name: String, val quantity: Int, val unitPrice: Double, val total: Double)

internal fun parseOrderItems(note: String?, amountEgp: Double): List<OrderProductItem> {
    if (note.isNullOrBlank()) return emptyList()
    val cleaned = note.replace(Regex("^Order\\s+#[^\\s—:]+[\\s—:]*", RegexOption.IGNORE_CASE), "").trim()
    if (cleaned.isBlank()) return emptyList()
    val parts = cleaned.split(Regex("[,;\\n]+")).map { it.trim() }.filter { it.isNotBlank() }
    val parsed = mutableListOf<Pair<String, Int>>()
    val itemPattern = Regex("^(.+?)\\s*(?:[x×*]\\s*(\\d+)|\\((\\d+)\\s*(?:pcs|units?)\\))\$", RegexOption.IGNORE_CASE)
    val itemPatternPrefix = Regex("^(\\d+)\\s*[x×*]\\s*(.+)\$", RegexOption.IGNORE_CASE)
    for (part in parts) {
        val m1 = itemPattern.find(part)
        val m2 = if (m1 == null) itemPatternPrefix.find(part) else null
        if (m1 != null) {
            val name = m1.groupValues[1].trim()
            val qty = (m1.groupValues[2].ifBlank { m1.groupValues[3] }).toIntOrNull() ?: 1
            if (name.isNotBlank()) parsed.add(name to qty)
        } else if (m2 != null) {
            val qty = m2.groupValues[1].toIntOrNull() ?: 1
            val name = m2.groupValues[2].trim()
            if (name.isNotBlank()) parsed.add(name to qty)
        }
    }
    if (parsed.isEmpty()) return emptyList()
    val totalUnits = parsed.sumOf { it.second }.coerceAtLeast(1)
    val unitPrice = Math.round((amountEgp / totalUnits) * 100.0) / 100.0
    return parsed.map { (name, qty) ->
        val lineTotal = Math.round(unitPrice * qty * 100.0) / 100.0
        OrderProductItem(name, qty, unitPrice, lineTotal)
    }
}

@Composable
internal fun PaymentDetailsDialog(payment: MerchantPayment, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    val dialogHeight = (LocalConfiguration.current.screenHeightDp * 0.86f).dp
    val paymentStatus = NilePayStatus.fromApiStatus(payment.status)
    val status = stringResource(paymentStatus.labelResource())
    val unavailable = stringResource(R.string.not_available)
    fun amount(value: Double?) = value?.let { "%.2f EGP".format(it) } ?: unavailable
    val paymentId = payment.sessionId.ifBlank { payment.id }
    val formattedDate = CairoTime.formatDetail(payment.createdAt)
    val categoryText = payment.productCategory?.ifBlank { null } ?: unavailable
    val receipt = stringResource(
        R.string.receipt_share_template,
        payment.receivedAmountEgp ?: payment.amountEgp,
        payment.sender,
        status,
        categoryText,
        paymentId,
        formattedDate,
        amount(payment.expectedAmountEgp),
        amount(payment.receivedAmountEgp)
    )

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

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.6f))
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier
                    .testTag("payment-details")
                    .fillMaxWidth(0.94f)
                    .heightIn(max = dialogHeight)
                    .wrapContentHeight()
                    .clickable(enabled = false, onClick = {})
                    .clip(NilePayTheme.shapes.extraLarge),
                shape = NilePayTheme.shapes.extraLarge,
                border = BorderStroke(1.dp, NilePayTheme.colors.border),
                colors = CardDefaults.cardColors(
                    containerColor = NilePayTheme.colors.surfaceCard,
                    contentColor = NilePayTheme.colors.onSurface
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.payment_details),
                            style = NilePayTheme.typography.titleLarge,
                            color = NilePayTheme.colors.onSurface
                        )
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                Icons.Filled.Close,
                                contentDescription = stringResource(R.string.close_notice),
                                tint = NilePayTheme.colors.onSurfaceSecondary
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(NilePayTheme.shapes.medium)
                            .background(NilePayTheme.colors.surfaceSubtle)
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        NilePayAmountText(
                            payment.receivedAmountEgp ?: payment.amountEgp,
                            size = NilePayAmountSize.Large
                        )
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

                    NilePayCard(contentPadding = PaddingValues(12.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            DetailRow(stringResource(R.string.payment_sender), payment.sender)
                            DetailRow(stringResource(R.string.payment_status), status)
                            DetailRow(stringResource(R.string.product_category), categoryText)
                            DetailRow(stringResource(R.string.payment_expected), amount(payment.expectedAmountEgp))
                            DetailRow(stringResource(R.string.payment_received), amount(payment.receivedAmountEgp))
                            if (payment.expectedAmountEgp != null && payment.receivedAmountEgp != null) {
                                DetailRow(stringResource(R.string.payment_difference), amount(payment.receivedAmountEgp - payment.expectedAmountEgp))
                            }
                            payment.expiresAt?.let { DetailRow(stringResource(R.string.payment_expiry), CairoTime.formatDetail(it)) }
                            if (paymentStatus == NilePayStatus.Unknown) DetailRow("API status", payment.status)
                            DetailRow(stringResource(R.string.payment_date), formattedDate)
                            DetailRow(stringResource(R.string.payment_id), paymentId)
                            payment.note?.let { DetailRow(stringResource(R.string.payment_note), it) }
                        }
                    }

                    val parsedProducts = remember(payment.note, payment.amountEgp) {
                        parseOrderItems(payment.note, payment.receivedAmountEgp ?: payment.amountEgp)
                    }
                    if (parsedProducts.isNotEmpty()) {
                        NilePayCard(contentPadding = PaddingValues(12.dp)) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Filled.Payments, contentDescription = null, tint = NilePayTheme.colors.primary, modifier = Modifier.size(16.dp))
                                        Text(stringResource(R.string.product_order_details), style = NilePayTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    }
                                    Text("${parsedProducts.size} items", style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                                }
                                parsedProducts.forEachIndexed { index, item ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(NilePayTheme.shapes.small)
                                            .background(NilePayTheme.colors.surfaceSubtle)
                                            .padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("${index + 1}. ${item.name}", style = NilePayTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                            Text("%.2f EGP/unit".format(item.unitPrice), style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                                        }
                                        Text("×${item.quantity}  %.2f EGP".format(item.total), style = NilePayTheme.typography.labelLarge, color = NilePayTheme.colors.statusConfirmed)
                                    }
                                }
                            }
                        }
                    }

                    NilePayButton(stringResource(if (copied) R.string.id_copied else R.string.copy_payment_id), {
                        clipboard.setText(AnnotatedString(paymentId)); copied = true
                    }, modifier = Modifier.fillMaxWidth(), style = NilePayButtonStyle.Secondary)
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
                        NilePayButton(
                            text = stringResource(R.string.close_notice),
                            onClick = onDismiss,
                            modifier = Modifier.fillMaxWidth(),
                            style = NilePayButtonStyle.Primary
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Column {
        Text(label, style = NilePayTheme.typography.labelMedium, color = NilePayTheme.colors.onSurfaceSecondary)
        Text(value, style = NilePayTheme.typography.bodyMedium.copy(textDirection = androidx.compose.ui.text.style.TextDirection.Content), color = NilePayTheme.colors.onSurface)
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
    onRetryQueue: () -> Unit,
    retrying: Boolean,
    retryFeedback: String?,
    uploadError: String?,
    diagnosticsAt: Long
) {
    val context = LocalContext.current
    DetectorContent(
        contentPadding, notificationAccess, batteryUnrestricted,
        com.nilepay.merchant.detection.InstaPayNotificationListener.connected,
        DetectorKeepAliveService.running, queuedEvents, attentionEvents,
        session.lastDetectedAt, session.lastHeartbeatAt, retrying, retryFeedback, uploadError, diagnosticsAt,
        onOpenSettings, onAllowUnrestrictedBattery, onRetryQueue,
        onReconnect = { DetectorKeepAliveService.ensureRunning(context) }
    )
}

@Composable
internal fun DetectorContent(
    contentPadding: PaddingValues,
    notificationAccess: Boolean,
    batteryUnrestricted: Boolean,
    listenerConnected: Boolean,
    serviceActive: Boolean,
    queuedEvents: Int,
    attentionEvents: Int,
    lastDetectedAt: Long,
    lastHeartbeatAt: Long,
    retrying: Boolean,
    retryFeedback: String?,
    uploadError: String?,
    diagnosticsAt: Long,
    onOpenSettings: () -> Unit,
    onAllowUnrestrictedBattery: () -> Unit,
    onRetryQueue: () -> Unit,
    onReconnect: () -> Unit
) {
    val context = LocalContext.current
    var showDetails by remember { mutableStateOf(false) }
    var reconnectRequested by remember { mutableStateOf(false) }
    LaunchedEffect(reconnectRequested, listenerConnected, serviceActive) {
        if (listenerConnected && serviceActive) reconnectRequested = false
        else if (reconnectRequested) { delay(10_000); reconnectRequested = false }
    }
    ScreenColumn(contentPadding) {
        NilePayCard(contentPadding = PaddingValues(12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                HealthHeader(notificationAccess && batteryUnrestricted && listenerConnected && serviceActive)
                if (!notificationAccess) {
                    NilePayButton(stringResource(R.string.open_notification_access), onOpenSettings,
                        modifier = Modifier.fillMaxWidth())
                } else if (!listenerConnected || !serviceActive) {
                    Text(stringResource(R.string.listener_disconnected), style = NilePayTheme.typography.bodySmall,
                        color = NilePayTheme.colors.onSurfaceSecondary)
                    NilePayButton(stringResource(R.string.reconnect_detector), {
                        onReconnect(); reconnectRequested = true
                    }, modifier = Modifier.fillMaxWidth(), enabled = !reconnectRequested)
                    if (reconnectRequested) Text(stringResource(R.string.reconnect_requested),
                        style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                    TextButton(onClick = onOpenSettings) { Text(stringResource(R.string.open_notification_access)) }
                }
                if (!batteryUnrestricted) {
                    NilePayButton(stringResource(R.string.allow_unrestricted_battery), onAllowUnrestrictedBattery,
                        modifier = Modifier.fillMaxWidth(), style = NilePayButtonStyle.Secondary)
                }
            }
        }
        NilePayCard(contentPadding = PaddingValues(12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DetailRow(stringResource(R.string.last_detected_payment), formatDeviceTime(lastDetectedAt))
                HorizontalDivider(color = NilePayTheme.colors.borderSubtle)
                DetailRow(stringResource(R.string.pending_uploads),
                    if (queuedEvents == 0) stringResource(R.string.no_pending_uploads)
                    else stringResource(R.string.queue_summary, queuedEvents, attentionEvents))
                if (queuedEvents > 0) NilePayButton(stringResource(R.string.retry_queued_uploads), onRetryQueue,
                    modifier = Modifier.fillMaxWidth(), enabled = !retrying, loading = retrying,
                    style = NilePayButtonStyle.Secondary)
                uploadError?.let { Text(stringResource(R.string.last_upload_error, it),
                    style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.destructive) }
                retryFeedback?.let { Text(it, style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary) }
            }
        }
        TextButton(onClick = { showDetails = !showDetails }, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(if (showDetails) R.string.hide_detector_details else R.string.detector_details))
        }
        if (showDetails) NilePayCard(contentPadding = PaddingValues(12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                HealthCheckRow(Icons.Filled.HealthAndSafety, stringResource(R.string.notification_access),
                    stringResource(if (notificationAccess) R.string.notification_access_on else R.string.notification_access_off), notificationAccess)
                HealthCheckRow(Icons.Filled.Wifi, stringResource(R.string.listener_connection),
                    stringResource(if (listenerConnected) R.string.listener_connected else R.string.listener_disconnected), listenerConnected)
                HealthCheckRow(Icons.Filled.Shield, stringResource(R.string.continuous_service_title),
                    stringResource(if (serviceActive) R.string.continuous_service_on else R.string.continuous_service_off), serviceActive)
                HealthCheckRow(Icons.Filled.Shield, stringResource(R.string.battery_protection_title),
                    stringResource(if (batteryUnrestricted) R.string.battery_protection_on else R.string.battery_protection_off), batteryUnrestricted)
                DetailRow(stringResource(R.string.last_heartbeat), formatDeviceTime(lastHeartbeatAt))
                Text(stringResource(R.string.diagnostics_updated, formatDeviceTime(diagnosticsAt)),
                    style = NilePayTheme.typography.bodySmall, color = NilePayTheme.colors.onSurfaceSecondary)
                NilePayButton(stringResource(R.string.share_diagnostics), {
                    val report = "NilePay ${BuildConfig.VERSION_NAME} / Android ${android.os.Build.VERSION.RELEASE}\n" +
                        "Notification access: $notificationAccess\nListener connected: $listenerConnected\n" +
                        "Foreground service: $serviceActive\nBattery unrestricted: $batteryUnrestricted\n" +
                        "Queued: $queuedEvents; needs attention: $attentionEvents\n" +
                        "Last heartbeat: ${formatDeviceTime(lastHeartbeatAt)}\n" +
                        "Last detection: ${formatDeviceTime(lastDetectedAt)}\nUpload error: ${uploadError.orEmpty()}"
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"; putExtra(Intent.EXTRA_TEXT, report)
                    }, context.getString(R.string.share_diagnostics)))
                }, modifier = Modifier.fillMaxWidth(), style = NilePayButtonStyle.Secondary)
            }
        }
    }
}

private fun formatDeviceTime(timestamp: Long): String = if (timestamp <= 0L) {
    "—"
} else {
    CairoTime.formatCardWithYear(java.time.Instant.ofEpochMilli(timestamp).toString())
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
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
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
internal fun SettingsScreen(
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
        NilePayCard(contentPadding = PaddingValues(12.dp)) {
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
        NilePayCard(contentPadding = PaddingValues(12.dp)) {
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
