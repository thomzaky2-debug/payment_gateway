package com.nilepay.designsystem.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarData
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.nilepay.designsystem.theme.NilePayTheme
import com.nilepay.designsystem.theme.NileSlate900

@Composable
fun NilePaySnackbar(
    snackbarData: SnackbarData,
    modifier: Modifier = Modifier,
    isError: Boolean = false
) {
    val containerColor = if (isError) {
        NilePayTheme.colors.destructive
    } else if (NilePayTheme.colors.isDark) {
        NilePayTheme.colors.surfaceCard
    } else {
        NileSlate900
    }

    val contentColor = Color.White
    val actionColor = if (isError) Color.White else NilePayTheme.colors.primary

    Snackbar(
        snackbarData = snackbarData,
        modifier = modifier.padding(NilePayTheme.spacing.base),
        shape = NilePayTheme.shapes.medium,
        containerColor = containerColor,
        contentColor = contentColor,
        actionColor = actionColor
    )
}

@Composable
fun NilePaySnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    SnackbarHost(
        hostState = hostState,
        modifier = modifier
    ) { data ->
        NilePaySnackbar(snackbarData = data)
    }
}
