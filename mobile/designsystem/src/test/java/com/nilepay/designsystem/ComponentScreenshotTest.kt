package com.nilepay.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.nilepay.designsystem.components.NilePayAmountSize
import com.nilepay.designsystem.components.NilePayAmountText
import com.nilepay.designsystem.components.NilePayBarChart
import com.nilepay.designsystem.components.NilePayBarEntry
import com.nilepay.designsystem.components.NilePayBottomNav
import com.nilepay.designsystem.components.NilePayBottomNavItem
import com.nilepay.designsystem.components.NilePayButton
import com.nilepay.designsystem.components.NilePayButtonStyle
import com.nilepay.designsystem.components.NilePayCard
import com.nilepay.designsystem.components.NilePayDisclosureLayout
import com.nilepay.designsystem.components.NilePayEmptyState
import com.nilepay.designsystem.components.NilePayErrorState
import com.nilepay.designsystem.components.NilePayListRow
import com.nilepay.designsystem.components.NilePayOtpField
import com.nilepay.designsystem.components.NilePayStatus
import com.nilepay.designsystem.components.NilePayStatusChip
import com.nilepay.designsystem.components.NilePayTextField
import com.nilepay.designsystem.components.NilePayTopBar
import com.nilepay.designsystem.theme.NilePayTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = RobolectricDeviceQualifiers.Pixel5)
class ComponentScreenshotTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun testButtons_light() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayButton(text = "Primary Button", onClick = {}, style = NilePayButtonStyle.Primary)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/button_primary_light.png")
    }

    @Test
    fun testButtons_dark() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = true) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayButton(text = "Destructive Button", onClick = {}, style = NilePayButtonStyle.Destructive)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/button_destructive_dark.png")
    }

    @Test
    fun testStatusChips_all() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayStatusChip(status = NilePayStatus.Confirmed)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/status_chip_confirmed.png")
    }

    @Test
    fun testStatusChips_pending() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = true) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayStatusChip(status = NilePayStatus.Pending)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/status_chip_pending_dark.png")
    }

    @Test
    fun testAmountText_tabular() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayAmountText(amount = 1450.75, size = NilePayAmountSize.Large)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/amount_text_large.png")
    }

    @Test
    fun testOtpField() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayOtpField(otpValue = "123", onOtpChange = {})
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/otp_field_partial.png")
    }

    @Test
    fun testCardAndListRow() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayCard {
                        NilePayListRow(
                            title = "Merchant Order #4088",
                            subtitle = "InstaPay ref: 998822",
                            trailing = { NilePayStatusChip(status = NilePayStatus.Confirmed) }
                        )
                    }
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/card_list_row.png")
    }

    @Test
    fun testBarChart() {
        val testEntries = listOf(
            NilePayBarEntry("Sat", 1200f, "1.2k"),
            NilePayBarEntry("Sun", 2500f, "2.5k"),
            NilePayBarEntry("Mon", 1800f, "1.8k"),
            NilePayBarEntry("Tue", 3200f, "3.2k"),
            NilePayBarEntry("Wed", 2100f, "2.1k"),
            NilePayBarEntry("Thu", 4500f, "4.5k"),
            NilePayBarEntry("Fri", 3900f, "3.9k")
        )
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayBarChart(entries = testEntries)
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/bar_chart.png")
    }

    @Test
    fun testTopBarAndBottomNav() {
        val navItems = listOf(
            NilePayBottomNavItem(id = "home", label = "Home", icon = Icons.Filled.Home),
            NilePayBottomNavItem(id = "profile", label = "Profile", icon = Icons.Filled.Person)
        )
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                Box(modifier = Modifier.padding(16.dp)) {
                    NilePayTopBar(title = "NilePay Merchant")
                }
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/top_bar.png")
    }

    @Test
    fun testDisclosureLayout() {
        composeTestRule.setContent {
            NilePayTheme(darkTheme = false) {
                NilePayDisclosureLayout(onAgree = {}, onCancel = {})
            }
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/disclosure_layout.png")
    }

    @Test
    fun testGallery_light_english() {
        composeTestRule.setContent {
            com.nilepay.designsystem.gallery.ComponentGalleryScreen(
                initialDarkTheme = false,
                initialArabic = false
            )
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/gallery_light_en.png")
    }

    @Test
    fun testGallery_dark_english() {
        composeTestRule.setContent {
            com.nilepay.designsystem.gallery.ComponentGalleryScreen(
                initialDarkTheme = true,
                initialArabic = false
            )
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/gallery_dark_en.png")
    }

    @Test
    fun testGallery_light_arabic() {
        composeTestRule.setContent {
            com.nilepay.designsystem.gallery.ComponentGalleryScreen(
                initialDarkTheme = false,
                initialArabic = true
            )
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/gallery_light_ar.png")
    }

    @Test
    fun testGallery_dark_arabic() {
        composeTestRule.setContent {
            com.nilepay.designsystem.gallery.ComponentGalleryScreen(
                initialDarkTheme = true,
                initialArabic = true
            )
        }
        composeTestRule.onRoot().captureRoboImage("build/outputs/roborazzi/gallery_dark_ar.png")
    }
}
