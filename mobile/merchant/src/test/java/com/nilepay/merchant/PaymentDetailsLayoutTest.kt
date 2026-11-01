package com.nilepay.merchant

import android.app.Application
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import org.junit.Assert.assertTrue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.Density
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
class PaymentDetailsLayoutTest {
    @get:Rule val compose = createComposeRule()

    @Test fun receiptStaysBoundedAndCopyActionRemainsReachableWithLargeText() {
        System.setProperty("roborazzi.test.record", "true")
        compose.setContent {
            CompositionLocalProvider(LocalDensity provides Density(LocalDensity.current.density, 1.3f)) {
                NilePayTheme(storeStyle = true) {
                    PaymentDetailsDialog(MerchantPayment(
                        "payment", "payment-preview-123456789", "long.customer.name@instapay", 125.50,
                        "CONFIRMED", "2026-11-01T18:00:00Z", "REF123456", "Order details. ".repeat(30)
                    ), {})
                }
            }
        }
        assertTrue(compose.onNodeWithTag("payment-details").fetchSemanticsNode().boundsInRoot.height <= 654f)
        compose.onNodeWithText("Copy payment ID").performScrollTo().performClick()
        compose.onNodeWithText("Payment ID copied").assertExists()
        compose.onNodeWithTag("payment-details").captureRoboImage("build/outputs/merchant-design/receipt-large-text.png")
    }
}
