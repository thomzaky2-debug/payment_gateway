package com.nilepay.designsystem.theme

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// ─── Primitive Palette ────────────────────────────────────────────────────────
val NileViolet50 = Color(0xFFF5F3FF)
val NileViolet100 = Color(0xFFEDE9FE)
val NileViolet200 = Color(0xFFDDD6FE)
val NileViolet300 = Color(0xFFC4B5FD)
val NileViolet400 = Color(0xFFA78BFA)
val NileViolet500 = Color(0xFF8B5CF6)
val NileViolet600 = Color(0xFF7C3AED) // Brand Primary
val NileViolet700 = Color(0xFF6D28D9)
val NileViolet800 = Color(0xFF5B21B6)
val NileViolet900 = Color(0xFF4C1D95)

val NileIndigo500 = Color(0xFF6366F1)
val NileIndigo600 = Color(0xFF4F46E5) // Brand Secondary Gradient
val NileIndigo700 = Color(0xFF4338CA)

val NileSlate50 = Color(0xFFF8FAFC)
val NileSlate100 = Color(0xFFF1F5F9) // Light Page Background
val NileSlate200 = Color(0xFFE2E8F0) // Light Card Border
val NileSlate300 = Color(0xFFCBD5E1)
val NileSlate400 = Color(0xFF94A3B8)
val NileSlate500 = Color(0xFF64748B) // Secondary Text
val NileSlate600 = Color(0xFF475569)
val NileSlate700 = Color(0xFF334155) // Dark Border Subtle
val NileSlate800 = Color(0xFF1E293B) // Light Primary Text
val NileSlate900 = Color(0xFF0F172A)
val NileMidnight = Color(0xFF090D16)  // Web Portal Dark Page Background
val NileDarkCard = Color(0xFF111827)  // Web Portal Dark Card
val NileDarkSubcard = Color(0xFF162033) // Web Portal Dark Subcard

// Semantic Status Colors
val NileEmerald500 = Color(0xFF10B981) // Confirmed
val NileEmerald600 = Color(0xFF059669)
val NileEmeraldContainer = Color(0xFFD1FAE5)
val NileEmeraldDarkContainer = Color(0xFF064E3B)

val NileAmber500 = Color(0xFFF59E0B)   // Pending
val NileAmberContainer = Color(0xFFFEF3C7)
val NileAmberDarkContainer = Color(0xFF78350F)

val NileRose500 = Color(0xFFEF4444)    // Failed / Destructive
val NileRose600 = Color(0xFFDC2626)
val NileRoseContainer = Color(0xFFFEE2E2)
val NileRoseDarkContainer = Color(0xFF7F1D1D)

val NileSky500 = Color(0xFF0EA5E9)
val NileSky400 = Color(0xFF38BDF8)

// ─── Semantic Design System Colors ───────────────────────────────────────────
@Immutable
data class NilePayColors(
    val isDark: Boolean,
    val background: Color,
    val surface: Color,
    val surfaceSubtle: Color,
    val surfaceCard: Color,
    val onBackground: Color,
    val onSurface: Color,
    val onSurfaceSecondary: Color,
    val primary: Color,
    val onPrimary: Color,
    val primaryGradient: Brush,
    val border: Color,
    val borderSubtle: Color,
    val statusConfirmed: Color,
    val statusConfirmedContainer: Color,
    val statusPending: Color,
    val statusPendingContainer: Color,
    val statusFailed: Color,
    val statusFailedContainer: Color,
    val statusExpired: Color,
    val statusExpiredContainer: Color,
    val destructive: Color,
    val onDestructive: Color
)

val LightNilePayColors = NilePayColors(
    isDark = false,
    background = NileSlate100,
    surface = Color.White,
    surfaceSubtle = NileSlate50,
    surfaceCard = Color.White,
    onBackground = NileSlate800,
    onSurface = NileSlate800,
    onSurfaceSecondary = NileSlate500,
    primary = NileViolet600,
    onPrimary = Color.White,
    primaryGradient = Brush.horizontalGradient(listOf(NileViolet600, NileIndigo600)),
    border = NileSlate200,
    borderSubtle = NileSlate300,
    statusConfirmed = NileEmerald600,
    statusConfirmedContainer = NileEmeraldContainer,
    statusPending = Color(0xFFB45309), // Amber 700 for high text contrast (>4.5:1)
    statusPendingContainer = NileAmberContainer,
    statusFailed = NileRose600,
    statusFailedContainer = NileRoseContainer,
    statusExpired = NileSlate600,
    statusExpiredContainer = NileSlate200,
    destructive = NileRose600,
    onDestructive = Color.White
)

val DarkNilePayColors = NilePayColors(
    isDark = true,
    background = NileMidnight,
    surface = NileDarkCard,
    surfaceSubtle = NileDarkSubcard,
    surfaceCard = NileDarkCard,
    onBackground = NileSlate50,
    onSurface = NileSlate50,
    onSurfaceSecondary = NileSlate400,
    primary = NileViolet400,
    onPrimary = Color.Black,
    primaryGradient = Brush.horizontalGradient(listOf(NileViolet500, NileIndigo500)),
    border = Color(0xFF1F2937),
    borderSubtle = NileSlate700,
    statusConfirmed = NileEmerald500,
    statusConfirmedContainer = NileEmeraldDarkContainer,
    statusPending = NileAmber500,
    statusPendingContainer = NileAmberDarkContainer,
    statusFailed = NileRose500,
    statusFailedContainer = NileRoseDarkContainer,
    statusExpired = NileSlate400,
    statusExpiredContainer = Color(0xFF1E293B),
    destructive = NileRose500,
    onDestructive = Color.White
)

val LocalNilePayColors = staticCompositionLocalOf { LightNilePayColors }
