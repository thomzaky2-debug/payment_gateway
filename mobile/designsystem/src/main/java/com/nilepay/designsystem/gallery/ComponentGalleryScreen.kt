package com.nilepay.designsystem.gallery

import android.content.res.Configuration
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Brightness4
import androidx.compose.material.icons.filled.Brightness7
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
import com.nilepay.designsystem.components.NilePayBarChart
import com.nilepay.designsystem.components.NilePayBarEntry
import com.nilepay.designsystem.components.NilePayBottomSheet
import com.nilepay.designsystem.components.NilePayBottomNav
import com.nilepay.designsystem.components.NilePayBottomNavItem
import com.nilepay.designsystem.components.NilePayButton
import com.nilepay.designsystem.components.NilePayButtonStyle
import com.nilepay.designsystem.components.NilePayCard
import com.nilepay.designsystem.components.NilePayDialog
import com.nilepay.designsystem.components.NilePayDisclosureLayout
import com.nilepay.designsystem.components.NilePayEmptyState
import com.nilepay.designsystem.components.NilePayErrorState
import com.nilepay.designsystem.components.NilePayListRow
import com.nilepay.designsystem.components.NilePayOtpField
import com.nilepay.designsystem.components.NilePayPasswordField
import com.nilepay.designsystem.components.NilePaySkeletonCard
import com.nilepay.designsystem.components.NilePaySkeletonListRow
import com.nilepay.designsystem.components.NilePaySnackbarHost
import com.nilepay.designsystem.components.NilePayStatus
import com.nilepay.designsystem.components.NilePayStatusChip
import com.nilepay.designsystem.components.NilePayTextField
import com.nilepay.designsystem.components.NilePayTopBar
import com.nilepay.designsystem.theme.NilePayTheme
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun ComponentGalleryScreen(
    initialDarkTheme: Boolean = false,
    initialArabic: Boolean = false
) {
    var isDarkTheme by remember { mutableStateOf(initialDarkTheme) }
    var isArabic by remember { mutableStateOf(initialArabic) }

    val locale = if (isArabic) Locale.forLanguageTag("ar") else Locale.ENGLISH
    val layoutDirection = if (isArabic) LayoutDirection.Rtl else LayoutDirection.Ltr

    val currentConfig = LocalConfiguration.current
    val localizedConfig = remember(isArabic, currentConfig) {
        Configuration(currentConfig).apply {
            setLocale(locale)
        }
    }

    val context = LocalContext.current
    val localizedContext = remember(isArabic) {
        val conf = Configuration(context.resources.configuration)
        conf.setLocale(locale)
        context.createConfigurationContext(conf)
    }

    CompositionLocalProvider(
        LocalConfiguration provides localizedConfig,
        LocalContext provides localizedContext,
        LocalLayoutDirection provides layoutDirection
    ) {
        NilePayTheme(darkTheme = isDarkTheme) {
            GalleryScaffold(
                isDark = isDarkTheme,
                isArabic = isArabic,
                onToggleTheme = { isDarkTheme = !isDarkTheme },
                onToggleLocale = { isArabic = !isArabic }
            )
        }
    }
}

@Composable
private fun GalleryScaffold(
    isDark: Boolean,
    isArabic: Boolean,
    onToggleTheme: () -> Unit,
    onToggleLocale: () -> Unit
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var showDialog by remember { mutableStateOf(false) }
    var showBottomSheet by remember { mutableStateOf(false) }
    var showDisclosure by remember { mutableStateOf(false) }

    var emailValue by remember { mutableStateOf("merchant@cairo-coffee.eg") }
    var passwordValue by remember { mutableStateOf("secret123") }
    var otpValue by remember { mutableStateOf("942817") }
    var selectedBottomNav by remember { mutableStateOf("dashboard") }

    if (showDisclosure) {
        NilePayDisclosureLayout(
            onAgree = { showDisclosure = false },
            onCancel = { showDisclosure = false }
        )
        return
    }

    Scaffold(
        topBar = {
            NilePayTopBar(
                title = stringResource(R.string.gallery_title),
                actions = {
                    IconButton(onClick = onToggleLocale) {
                        Icon(
                            imageVector = Icons.Filled.Language,
                            contentDescription = if (isArabic) "Switch to English" else "التبديل إلى العربية",
                            tint = NilePayTheme.colors.onSurface
                        )
                    }
                    IconButton(onClick = onToggleTheme) {
                        Icon(
                            imageVector = if (isDark) Icons.Filled.Brightness7 else Icons.Filled.Brightness4,
                            contentDescription = if (isDark) "Switch to Light Mode" else "Switch to Dark Mode",
                            tint = NilePayTheme.colors.onSurface
                        )
                    }
                }
            )
        },
        bottomBar = {
            NilePayBottomNav(
                items = listOf(
                    NilePayBottomNavItem("dashboard", stringResource(R.string.nav_dashboard), Icons.Filled.Home),
                    NilePayBottomNavItem("transactions", stringResource(R.string.nav_transactions), Icons.Filled.Receipt),
                    NilePayBottomNavItem("notifications", stringResource(R.string.nav_notifications), Icons.Filled.Notifications),
                    NilePayBottomNavItem("settings", stringResource(R.string.nav_settings), Icons.Filled.Settings)
                ),
                selectedItemId = selectedBottomNav,
                onItemSelected = { selectedBottomNav = it }
            )
        },
        snackbarHost = { NilePaySnackbarHost(hostState = snackbarHostState) },
        containerColor = NilePayTheme.colors.background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(scrollState)
                .padding(NilePayTheme.spacing.base)
        ) {
            // Mode Indicator
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.sm)
            ) {
                FilterChip(
                    selected = true,
                    onClick = onToggleTheme,
                    label = { Text(if (isDark) "Dark Mode" else "Light Mode") }
                )
                FilterChip(
                    selected = true,
                    onClick = onToggleLocale,
                    label = { Text(if (isArabic) "العربية (RTL)" else "English (LTR)") }
                )
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.base))

            // 1. Status Chips & Amounts
            SectionHeader(stringResource(R.string.gallery_section_chips))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.xs)
            ) {
                NilePayStatusChip(status = NilePayStatus.Confirmed)
                NilePayStatusChip(status = NilePayStatus.Pending)
                NilePayStatusChip(status = NilePayStatus.Failed)
                NilePayStatusChip(status = NilePayStatus.Expired)
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.base))

            // Tabular Amount Text
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                NilePayAmountText(amount = 2850.50, size = NilePayAmountSize.Display)
                NilePayAmountText(amount = 450.00, size = NilePayAmountSize.Large)
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 2. Buttons
            SectionHeader(stringResource(R.string.gallery_section_buttons))
            Column(verticalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.sm)) {
                NilePayButton(
                    text = stringResource(R.string.gallery_btn_primary),
                    onClick = {
                        scope.launch { snackbarHostState.showSnackbar("Primary button clicked") }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Primary
                )
                NilePayButton(
                    text = stringResource(R.string.gallery_btn_secondary),
                    onClick = { showDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    style = NilePayButtonStyle.Secondary
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    NilePayButton(
                        text = stringResource(R.string.gallery_btn_text),
                        onClick = { showBottomSheet = true },
                        style = NilePayButtonStyle.Text
                    )
                    NilePayButton(
                        text = stringResource(R.string.gallery_btn_destructive),
                        onClick = {
                            scope.launch { snackbarHostState.showSnackbar("Destructive action requested") }
                        },
                        style = NilePayButtonStyle.Destructive
                    )
                }
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 3. Text Fields & OTP
            SectionHeader(stringResource(R.string.gallery_section_text_fields))
            Column(verticalArrangement = Arrangement.spacedBy(NilePayTheme.spacing.md)) {
                NilePayTextField(
                    value = emailValue,
                    onValueChange = { emailValue = it },
                    label = stringResource(R.string.label_email),
                    placeholder = stringResource(R.string.hint_email)
                )
                NilePayPasswordField(
                    value = passwordValue,
                    onValueChange = { passwordValue = it },
                    label = stringResource(R.string.label_password)
                )
                Text(
                    text = stringResource(R.string.label_otp),
                    style = NilePayTheme.typography.titleMedium,
                    color = NilePayTheme.colors.onSurface
                )
                NilePayOtpField(
                    otpValue = otpValue,
                    onOtpChange = { otpValue = it }
                )
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 4. Cards & List Rows
            SectionHeader(stringResource(R.string.gallery_section_cards))
            NilePayCard {
                Column {
                    Text(
                        text = stringResource(R.string.gallery_card_title),
                        style = NilePayTheme.typography.titleLarge,
                        color = NilePayTheme.colors.onSurface
                    )
                    Text(
                        text = stringResource(R.string.gallery_card_subtitle),
                        style = NilePayTheme.typography.bodyMedium,
                        color = NilePayTheme.colors.onSurfaceSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))

            NilePayCard {
                NilePayListRow(
                    title = stringResource(R.string.gallery_row_title),
                    subtitle = stringResource(R.string.gallery_row_subtitle),
                    trailing = {
                        Column(horizontalAlignment = Alignment.End) {
                            NilePayAmountText(amount = 120.00, size = NilePayAmountSize.Medium)
                            NilePayStatusChip(status = NilePayStatus.Confirmed)
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 5. Weekly Transaction Chart
            SectionHeader(stringResource(R.string.gallery_section_chart))
            NilePayCard {
                Column {
                    Text(
                        text = stringResource(R.string.gallery_chart_title),
                        style = NilePayTheme.typography.titleMedium,
                        color = NilePayTheme.colors.onSurface
                    )
                    Spacer(modifier = Modifier.height(NilePayTheme.spacing.md))
                    NilePayBarChart(
                        entries = listOf(
                            NilePayBarEntry("Sat", 1500f, "1.5k"),
                            NilePayBarEntry("Sun", 2800f, "2.8k"),
                            NilePayBarEntry("Mon", 2200f, "2.2k"),
                            NilePayBarEntry("Tue", 3400f, "3.4k"),
                            NilePayBarEntry("Wed", 2900f, "2.9k"),
                            NilePayBarEntry("Thu", 4800f, "4.8k"),
                            NilePayBarEntry("Fri", 4100f, "4.1k")
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 6. Skeletons
            SectionHeader("Loading Skeletons")
            NilePaySkeletonCard()
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))
            NilePaySkeletonListRow()

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))

            // 7. States & Disclosure Trigger
            SectionHeader(stringResource(R.string.gallery_section_states))
            NilePayCard {
                NilePayEmptyState(
                    title = stringResource(R.string.empty_title_default),
                    subtitle = stringResource(R.string.empty_subtitle_default),
                    actionText = "Open Google Play Disclosure",
                    onActionClick = { showDisclosure = true }
                )
            }

            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))

            NilePayCard {
                NilePayErrorState(
                    title = stringResource(R.string.error_title_default),
                    subtitle = stringResource(R.string.error_subtitle_default),
                    onRetry = {
                        scope.launch { snackbarHostState.showSnackbar("Retrying operation...") }
                    }
                )
            }
        }
    }

    if (showDialog) {
        NilePayDialog(
            title = stringResource(R.string.gallery_dialog_title),
            description = stringResource(R.string.gallery_dialog_desc),
            onDismissRequest = { showDialog = false },
            onConfirm = { showDialog = false }
        )
    }

    if (showBottomSheet) {
        NilePayBottomSheet(
            onDismissRequest = { showBottomSheet = false },
            title = "NilePay Sheet"
        ) {
            Text(
                text = "Modal sheet component with custom handle, title bar and design system tokens.",
                style = NilePayTheme.typography.bodyMedium,
                color = NilePayTheme.colors.onSurface
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.base))
            NilePayButton(
                text = stringResource(R.string.action_confirm),
                onClick = { showBottomSheet = false },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        style = NilePayTheme.typography.titleLarge,
        color = NilePayTheme.colors.primary,
        modifier = Modifier.padding(bottom = NilePayTheme.spacing.sm)
    )
}
