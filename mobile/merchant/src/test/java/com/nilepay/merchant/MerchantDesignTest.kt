package com.nilepay.merchant

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import org.junit.Assert.assertEquals
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
@Config(sdk = [34], application = Application::class, qualifiers = "w390dp-h1100dp-mdpi")
class MerchantDesignTest {
    @get:Rule val compose = createComposeRule()

    private fun render(dark: Boolean, rtl: Boolean = false, suffix: String = "", fontScale: Float = 1f) {
        System.setProperty("roborazzi.test.record", "true")
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, fontScale), LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                NilePayTheme(darkTheme = dark, storeStyle = true) {
                    Box(Modifier.size(390.dp, 1100.dp).background(NilePayTheme.colors.background)) {
                        MerchantScaffold(MerchantDestination.Overview,
                            MerchantProfile("NilePay Store", "", null), false, {}, {}) { padding ->
                        OverviewScreen(
                            contentPadding = padding,
                            dashboard = DashboardSnapshot(1250.50, 12, 2, 74, 500),
                            dashboardError = null,
                            payments = listOf(MerchantPayment(
                                "preview", "receipt-preview", "customer@instapay", 125.50,
                                "CONFIRMED", "2026-11-01T18:00:00Z", "REF123456", "Order #4092")),
                            notificationAccess = true, loading = false,
                            onPaymentSelected = {}, onReviewSetup = {}, onViewPayments = {}
                        )
                        }
                    }
                }
            }
        }
        compose.onRoot().captureRoboImage("build/outputs/merchant-design/${if (dark) "dark" else "light"}${if (rtl) "-ar" else ""}$suffix.png")
    }
    @Test fun searchAndTabsRouteToPayments() {
        var searched = ""
        var selected = MerchantDestination.Overview
        compose.setContent {
            NilePayTheme(storeStyle = true) {
                MerchantScaffold(MerchantDestination.Overview, MerchantProfile("Store", "", null),
                    false, {}, { selected = it }, onSearch = { searched = it }) {}
            }
        }
        compose.onNodeWithText("Search payments").performClick()
        compose.onNodeWithText("Search payments").performTextInput("REF123")
        assertEquals("REF123", searched)
        compose.onAllNodesWithText("Payments")[0].performClick()
        assertEquals(MerchantDestination.Payments, selected)
        compose.onAllNodes(hasSetTextAction()).assertCountEquals(0)
    }
    @Test @Config(qualifiers = "w360dp-h760dp-mdpi") fun phoneOverview() = render(true, suffix = "-phone")
    @Test @Config(qualifiers = "w360dp-h760dp-mdpi") fun largeTextOverview() = render(true, suffix = "-large-text", fontScale = 1.3f)
    @Test fun darkOverview() = render(true)
    @Test fun lightOverview() = render(false)
    @Test @Config(qualifiers = "ar-w390dp-h1100dp-mdpi") fun arabicOverview() = render(true, true)
}
