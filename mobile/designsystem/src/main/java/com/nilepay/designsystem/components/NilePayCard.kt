package com.nilepay.designsystem.components

import com.nilepay.designsystem.theme.NilePayTheme
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.PaddingValues

@Composable
fun NilePayCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues? = null,
    content: @Composable BoxScope.() -> Unit
) {
    val shape = NilePayTheme.shapes.large
    val border = BorderStroke(1.dp, NilePayTheme.colors.border)
    val padding = contentPadding ?: PaddingValues(NilePayTheme.spacing.base)

    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) {
                    Modifier
                        .clip(shape)
                        .clickable(onClick = onClick)
                } else {
                    Modifier
                }
            ),
        shape = shape,
        border = border,
        colors = CardDefaults.cardColors(
            containerColor = NilePayTheme.colors.surfaceCard,
            contentColor = NilePayTheme.colors.onSurface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Box(
            modifier = Modifier.padding(padding),
            content = content
        )
    }
}
