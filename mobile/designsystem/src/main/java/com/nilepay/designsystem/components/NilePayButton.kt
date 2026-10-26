package com.nilepay.designsystem.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.theme.NilePayTheme

enum class NilePayButtonStyle {
    Primary,
    Secondary,
    Text,
    Destructive
}

@Composable
fun NilePayButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: NilePayButtonStyle = NilePayButtonStyle.Primary,
    enabled: Boolean = true,
    loading: Boolean = false,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null
) {
    val minHeight = 48.dp
    val shape = NilePayTheme.shapes.medium

    when (style) {
        NilePayButtonStyle.Primary -> {
            Button(
                onClick = onClick,
                modifier = modifier
                    .defaultMinSize(minHeight = minHeight)
                    .semantics { role = Role.Button },
                enabled = enabled && !loading,
                shape = shape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = NilePayTheme.colors.primary,
                    contentColor = NilePayTheme.colors.onPrimary,
                    disabledContainerColor = NilePayTheme.colors.primary.copy(alpha = 0.4f),
                    disabledContentColor = NilePayTheme.colors.onPrimary.copy(alpha = 0.6f)
                ),
                contentPadding = PaddingValues(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.sm)
            ) {
                ButtonContent(
                    text = text,
                    loading = loading,
                    contentColor = NilePayTheme.colors.onPrimary,
                    leadingIcon = leadingIcon,
                    trailingIcon = trailingIcon
                )
            }
        }
        NilePayButtonStyle.Secondary -> {
            OutlinedButton(
                onClick = onClick,
                modifier = modifier
                    .defaultMinSize(minHeight = minHeight)
                    .semantics { role = Role.Button },
                enabled = enabled && !loading,
                shape = shape,
                border = BorderStroke(
                    width = 1.dp,
                    color = if (enabled) NilePayTheme.colors.borderSubtle else NilePayTheme.colors.border
                ),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = NilePayTheme.colors.surface,
                    contentColor = NilePayTheme.colors.onSurface,
                    disabledContainerColor = NilePayTheme.colors.surface.copy(alpha = 0.5f),
                    disabledContentColor = NilePayTheme.colors.onSurfaceSecondary.copy(alpha = 0.5f)
                ),
                contentPadding = PaddingValues(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.sm)
            ) {
                ButtonContent(
                    text = text,
                    loading = loading,
                    contentColor = NilePayTheme.colors.onSurface,
                    leadingIcon = leadingIcon,
                    trailingIcon = trailingIcon
                )
            }
        }
        NilePayButtonStyle.Text -> {
            TextButton(
                onClick = onClick,
                modifier = modifier
                    .defaultMinSize(minHeight = minHeight)
                    .semantics { role = Role.Button },
                enabled = enabled && !loading,
                shape = shape,
                colors = ButtonDefaults.textButtonColors(
                    contentColor = NilePayTheme.colors.primary,
                    disabledContentColor = NilePayTheme.colors.onSurfaceSecondary.copy(alpha = 0.4f)
                ),
                contentPadding = PaddingValues(horizontal = NilePayTheme.spacing.sm, vertical = NilePayTheme.spacing.sm)
            ) {
                ButtonContent(
                    text = text,
                    loading = loading,
                    contentColor = NilePayTheme.colors.primary,
                    leadingIcon = leadingIcon,
                    trailingIcon = trailingIcon
                )
            }
        }
        NilePayButtonStyle.Destructive -> {
            Button(
                onClick = onClick,
                modifier = modifier
                    .defaultMinSize(minHeight = minHeight)
                    .semantics { role = Role.Button },
                enabled = enabled && !loading,
                shape = shape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = NilePayTheme.colors.destructive,
                    contentColor = NilePayTheme.colors.onDestructive,
                    disabledContainerColor = NilePayTheme.colors.destructive.copy(alpha = 0.4f),
                    disabledContentColor = NilePayTheme.colors.onDestructive.copy(alpha = 0.6f)
                ),
                contentPadding = PaddingValues(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.sm)
            ) {
                ButtonContent(
                    text = text,
                    loading = loading,
                    contentColor = NilePayTheme.colors.onDestructive,
                    leadingIcon = leadingIcon,
                    trailingIcon = trailingIcon
                )
            }
        }
    }
}

@Composable
private fun ButtonContent(
    text: String,
    loading: Boolean,
    contentColor: Color,
    leadingIcon: (@Composable () -> Unit)?,
    trailingIcon: (@Composable () -> Unit)?
) {
    if (loading) {
        CircularProgressIndicator(
            modifier = Modifier.size(20.dp),
            color = contentColor,
            strokeWidth = 2.dp
        )
    } else {
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (leadingIcon != null) {
                leadingIcon()
                Spacer(modifier = Modifier.width(NilePayTheme.spacing.sm))
            }
            Text(
                text = text,
                style = NilePayTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold
            )
            if (trailingIcon != null) {
                Spacer(modifier = Modifier.width(NilePayTheme.spacing.sm))
                trailingIcon()
            }
        }
    }
}
