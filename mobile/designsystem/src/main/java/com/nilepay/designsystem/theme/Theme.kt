package com.nilepay.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
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
    outline = NileSlate300
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
    outline = NileSlate700
)

@Composable
fun NilePayTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val customColors = if (darkTheme) DarkNilePayColors else LightNilePayColors
    val materialColors = if (darkTheme) MaterialDarkColors else MaterialLightColors
    val spacing = NilePaySpacing()
    val shapes = NilePayShapes()
    val typography = NilePayTypography()

    CompositionLocalProvider(
        LocalNilePayColors provides customColors,
        LocalNilePaySpacing provides spacing,
        LocalNilePayShapes provides shapes,
        LocalNilePayTypography provides typography
    ) {
        MaterialTheme(
            colorScheme = materialColors,
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
