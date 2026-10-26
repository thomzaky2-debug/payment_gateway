package com.nilepay.designsystem.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePayErrorState(
    modifier: Modifier = Modifier,
    title: String = stringResource(R.string.error_title_default),
    subtitle: String = stringResource(R.string.error_subtitle_default),
    icon: ImageVector = Icons.Outlined.ErrorOutline,
    onRetry: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(NilePayTheme.spacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = NilePayTheme.colors.destructive,
            modifier = Modifier.size(56.dp)
        )
        Spacer(modifier = Modifier.height(NilePayTheme.spacing.base))
        Text(
            text = title,
            style = NilePayTheme.typography.titleLarge,
            color = NilePayTheme.colors.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(NilePayTheme.spacing.xs))
        Text(
            text = subtitle,
            style = NilePayTheme.typography.bodyMedium,
            color = NilePayTheme.colors.onSurfaceSecondary,
            textAlign = TextAlign.Center
        )
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.lg))
            NilePayButton(
                text = stringResource(R.string.action_retry),
                onClick = onRetry,
                style = NilePayButtonStyle.Primary
            )
        }
    }
}
