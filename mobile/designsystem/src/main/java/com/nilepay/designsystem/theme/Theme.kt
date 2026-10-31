package com.nilepay.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable

private val MaterialLightColors = lightColorScheme(
    primary = NileViolet600,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    primaryContainer = NileViolet100,
    onPrimaryContainer = NileViolet900,
    secondary = NileIndigo600,
    onSecondary = androidx.compose.ui.graphics.Color.White,
    background = NileSlate100,
    onBackground = NileSlate800,
    surface = androidx.compose.ui.graphics.Color.White,
    onSurface = NileSlate800,
    error = NileRose600,
    onError = androidx.compose.ui.graphics.Color.White,
    outline = NileSlate300,
    surfaceVariant = NileSlate100,
    onSurfaceVariant = NileSlate600,
    secondaryContainer = NileViolet100,
    onSecondaryContainer = NileViolet900
)

private val MaterialDarkColors = darkColorScheme(
    primary = NileViolet400,
    onPrimary = androidx.compose.ui.graphics.Color.Black,
    primaryContainer = NileViolet900,
    onPrimaryContainer = NileViolet100,
    secondary = NileIndigo500,
    onSecondary = androidx.compose.ui.graphics.Color.Black,
    background = NileMidnight,
    onBackground = NileSlate50,
    surface = NileDarkCard,
    onSurface = NileSlate50,
    error = NileRose500,
    onError = androidx.compose.ui.graphics.Color.White,
    outline = NileSlate700,
    surfaceVariant = NileDarkSubcard,
    onSurfaceVariant = NileSlate300,
    secondaryContainer = NileViolet900,
    onSecondaryContainer = NileViolet100
)

@Composable
fun NilePayTheme(
    darkTheme: Boolean = true,
    compact: Boolean = false,
    content: @Composable () -> Unit
) {
    val customColors = if (darkTheme) DarkNilePayColors else LightNilePayColors
    val materialColors = if (darkTheme) MaterialDarkColors else MaterialLightColors
    val spacing = if (compact) NilePaySpacing(base = 12.dp, md = 8.dp) else NilePaySpacing()
    val shapes = NilePayShapes()
    val font = if (LocalConfiguration.current.locales[0].language == "ar") NotoSansArabicFontFamily else InterFontFamily
    val typography = NilePayTypography().let { t ->
        t.copy(
            displayLarge = t.displayLarge.copy(fontFamily = font), displayMedium = t.displayMedium.copy(fontFamily = font),
            headlineLarge = t.headlineLarge.copy(fontFamily = font), headlineMedium = t.headlineMedium.copy(fontFamily = font),
            headlineSmall = t.headlineSmall.copy(fontFamily = font), titleLarge = t.titleLarge.copy(fontFamily = font),
            titleMedium = t.titleMedium.copy(fontFamily = font), bodyLarge = t.bodyLarge.copy(fontFamily = font),
            bodyMedium = t.bodyMedium.copy(fontFamily = font), bodySmall = t.bodySmall.copy(fontFamily = font),
            labelLarge = t.labelLarge.copy(fontFamily = font), labelMedium = t.labelMedium.copy(fontFamily = font),
            labelSmall = t.labelSmall.copy(fontFamily = font)
        )
    }

    CompositionLocalProvider(
        LocalNilePayColors provides customColors,
        LocalNilePaySpacing provides spacing,
        LocalNilePayShapes provides shapes,
        LocalNilePayTypography provides typography
    ) {
        MaterialTheme(
            colorScheme = materialColors,
            typography = Typography(
                headlineLarge = typography.headlineLarge, headlineMedium = typography.headlineMedium,
                headlineSmall = typography.headlineSmall, titleLarge = typography.titleLarge,
                titleMedium = typography.titleMedium, bodyLarge = typography.bodyLarge,
                bodyMedium = typography.bodyMedium, bodySmall = typography.bodySmall,
                labelLarge = typography.labelLarge, labelMedium = typography.labelMedium, labelSmall = typography.labelSmall
            ),
            content = content
        )
    }
}

object NilePayTheme {
    val colors: NilePayColors
        @Composable
        @ReadOnlyComposable
        get() = LocalNilePayColors.current

    val spacing: NilePaySpacing
        @Composable
        @ReadOnlyComposable
        get() = LocalNilePaySpacing.current

    val shapes: NilePayShapes
        @Composable
        @ReadOnlyComposable
        get() = LocalNilePayShapes.current

    val typography: NilePayTypography
        @Composable
        @ReadOnlyComposable
        get() = LocalNilePayTypography.current
}
