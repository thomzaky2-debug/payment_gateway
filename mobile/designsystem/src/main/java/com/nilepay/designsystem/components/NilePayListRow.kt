package com.nilepay.designsystem.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePayListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    onClick: (() -> Unit)? = null
) {
    val rowModifier = modifier
        .fillMaxWidth()
        .defaultMinSize(minHeight = 56.dp)
        .then(
            if (onClick != null) {
                Modifier
                    .clickable(onClick = onClick)
                    .semantics { role = Role.Button }
            } else {
                Modifier
            }
        )
        .padding(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.md)

    Row(
        modifier = rowModifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (leading != null) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .padding(end = NilePayTheme.spacing.xs),
                contentAlignment = Alignment.Center
            ) {
                leading()
            }
            Spacer(modifier = Modifier.width(NilePayTheme.spacing.sm))
        }

        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                style = NilePayTheme.typography.titleMedium,
                color = NilePayTheme.colors.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = NilePayTheme.typography.bodySmall,
                    color = NilePayTheme.colors.onSurfaceSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        if (trailing != null) {
            Spacer(modifier = Modifier.width(NilePayTheme.spacing.sm))
            Box(
                contentAlignment = Alignment.CenterEnd
            ) {
                trailing()
            }
        }
    }
}
