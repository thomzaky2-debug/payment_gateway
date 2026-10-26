package com.nilepay.designsystem.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.BasicAlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NilePayDialog(
    title: String,
    description: String,
    onDismissRequest: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
    confirmText: String = stringResource(R.string.action_confirm),
    dismissText: String? = stringResource(R.string.action_cancel),
    isDestructive: Boolean = false
) {
    BasicAlertDialog(
        onDismissRequest = onDismissRequest,
        modifier = modifier
            .fillMaxWidth()
            .clip(NilePayTheme.shapes.extraLarge)
            .background(NilePayTheme.colors.surface)
            .padding(NilePayTheme.spacing.xl)
    ) {
        Column {
            Text(
                text = title,
                style = NilePayTheme.typography.titleLarge,
                color = NilePayTheme.colors.onSurface
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))
            Text(
                text = description,
                style = NilePayTheme.typography.bodyMedium,
                color = NilePayTheme.colors.onSurfaceSecondary
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xl))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (dismissText != null) {
                    NilePayButton(
                        text = dismissText,
                        onClick = onDismissRequest,
                        style = NilePayButtonStyle.Text
                    )
                    Spacer(modifier = Modifier.width(NilePayTheme.spacing.sm))
                }
                NilePayButton(
                    text = confirmText,
                    onClick = onConfirm,
                    style = if (isDestructive) NilePayButtonStyle.Destructive else NilePayButtonStyle.Primary
                )
            }
        }
    }
}
