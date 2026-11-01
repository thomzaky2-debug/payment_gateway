package com.nilepay.merchant

import android.app.Application
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.nilepay.designsystem.theme.NilePayTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = Application::class, qualifiers = "w360dp-h760dp-mdpi")
class MerchantScreenPreviewTest {
    @get:Rule val compose = createComposeRule()
    private val profile = MerchantProfile("NilePay Store", "merchant@example.com", null)
    private val payments = listOf(
        MerchantPayment("1", "receipt-1", "long.customer.name@instapay", 1250.50, "CONFIRMED", "2026-11-01T18:00:00Z", "REF123456", "Order #4092"),
        MerchantPayment("2", "receipt-2", "customer@instapay", 15.0, "PENDING", "2026-11-01T17:00:00Z", null, null))

    private fun preview(name: String, destination: MerchantDestination, dark: Boolean = true,
        fontScale: Float = 1f, rtl: Boolean = false, content: @Composable (PaddingValues) -> Unit) {
        System.setProperty("roborazzi.test.record", "true")
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, fontScale),
                LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                NilePayTheme(darkTheme = dark, storeStyle = true) {
                    MerchantScaffold(destination, profile, false, {}, {}, content = content)
                }
            }
        }
        compose.onRoot().captureRoboImage("build/outputs/merchant-design/$name.png")
    }
    @Composable private fun detector(padding: PaddingValues, access: Boolean = true,
        connected: Boolean = true, queue: Int = 0, error: String? = null) {
        DetectorContent(padding, access, access, connected, connected, queue,
            if (error != null) queue else 0, 1793556000000, 1793556000000, false, null, error,
            1793556000000, {}, {}, {}, {})
    }
    @Test fun detectorReadyIsConciseAndDetailsAreExpandable() {
        preview("detector-dark", MerchantDestination.Health) { detector(it) }
        compose.onNodeWithText("Share detector diagnostics").assertDoesNotExist()
        compose.onNodeWithText("Troubleshooting details").performClick()
        compose.onNodeWithText("Share detector diagnostics").performScrollTo().assertExists()
    }
    @Test fun detectorLight() = preview("detector-light", MerchantDestination.Health, dark = false) { detector(it) }
    @Test fun detectorSetup() = preview("detector-setup", MerchantDestination.Health) { detector(it, access = false, connected = false) }
    @Test fun detectorNeedsReconnect() = preview("detector-reconnect", MerchantDestination.Health) { detector(it, connected = false) }
    @Test fun detectorUploadError() = preview("detector-upload-error", MerchantDestination.Health) { detector(it, queue = 3, error = "HTTP 401") }
    @Test fun detectorLargeText() = preview("detector-large-text", MerchantDestination.Health, fontScale = 1.3f) { detector(it) }
    @Test @Config(qualifiers = "ar-w360dp-h760dp-mdpi") fun detectorArabic() = preview("detector-ar", MerchantDestination.Health, rtl = true) { detector(it) }

    @Composable private fun paymentList(padding: PaddingValues) {
        PaymentsContent(padding, payments, "ALL", {}, null, false, true, {}, {})
    }
    @Test fun paymentsDark() {
        preview("payments-dark", MerchantDestination.Payments) { paymentList(it) }
        compose.onNodeWithText("long.customer.name@instapay").assertIsDisplayed()
        compose.onNodeWithText("Filters and sorting").performClick()
        compose.onNodeWithText("Highest amount").assertExists()
    }
    @Test fun paymentsLight() = preview("payments-light", MerchantDestination.Payments, dark = false) { paymentList(it) }
    @Test fun paymentsLargeText() = preview("payments-large-text", MerchantDestination.Payments, fontScale = 1.3f) { paymentList(it) }
    @Test @Config(qualifiers = "ar-w360dp-h760dp-mdpi") fun paymentsArabic() = preview("payments-ar", MerchantDestination.Payments, rtl = true) { paymentList(it) }
    @Composable private fun settings(padding: PaddingValues) {
        val context = LocalContext.current
        SettingsScreen(padding, MerchantSession(context), profile, MerchantPreferences(context), MerchantTheme.Dark, {}, {})
    }
    @Test fun settingsDark() = preview("settings-dark", MerchantDestination.Settings) { settings(it) }
    @Test fun settingsLargeText() = preview("settings-large-text", MerchantDestination.Settings, fontScale = 1.3f) { settings(it) }
    @Test @Config(qualifiers = "ar-w360dp-h760dp-mdpi") fun settingsArabic() = preview("settings-ar", MerchantDestination.Settings, rtl = true) { settings(it) }
    @Test fun loginDark() {
        System.setProperty("roborazzi.test.record", "true")
        compose.setContent { NilePayTheme(storeStyle = true) { LoginScreen(MerchantSession(LocalContext.current)) {} } }
        compose.onRoot().captureRoboImage("build/outputs/merchant-design/login-dark.png")
    }
}
