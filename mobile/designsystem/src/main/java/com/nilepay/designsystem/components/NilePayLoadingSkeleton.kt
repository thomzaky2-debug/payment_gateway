package com.nilepay.designsystem.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePaySkeletonBox(
    modifier: Modifier = Modifier,
    shape: Shape = NilePayTheme.shapes.small
) {
    val shimmerColors = if (NilePayTheme.colors.isDark) {
        listOf(
            NilePayTheme.colors.surfaceSubtle,
            NilePayTheme.colors.surfaceSubtle.copy(alpha = 0.5f),
            NilePayTheme.colors.surfaceSubtle
        )
    } else {
        listOf(
            NilePayTheme.colors.surfaceSubtle,
            NilePayTheme.colors.border,
            NilePayTheme.colors.surfaceSubtle
        )
    }

    val transition = rememberInfiniteTransition(label = "skeleton_shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "skeleton_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 500f, translateAnim - 500f),
        end = Offset(translateAnim, translateAnim)
    )

    Box(
        modifier = modifier
            .clip(shape)
            .background(brush)
    )
}

@Composable
fun NilePaySkeletonListRow(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = NilePayTheme.spacing.base, vertical = NilePayTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        NilePaySkeletonBox(
            modifier = Modifier.size(40.dp),
            shape = CircleShape
        )
        Spacer(modifier = Modifier.width(NilePayTheme.spacing.base))
        Column(modifier = Modifier.weight(1f)) {
            NilePaySkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(16.dp)
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.xs))
            NilePaySkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(12.dp)
            )
        }
        Spacer(modifier = Modifier.width(NilePayTheme.spacing.base))
        NilePaySkeletonBox(
            modifier = Modifier
                .width(64.dp)
                .height(20.dp)
        )
    }
}

@Composable
fun NilePaySkeletonCard(
    modifier: Modifier = Modifier,
    height: Dp = 120.dp
) {
    NilePayCard(modifier = modifier) {
        Column {
            NilePaySkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .height(20.dp)
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))
            NilePaySkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.8f)
                    .height(14.dp)
            )
            Spacer(modifier = Modifier.height(NilePayTheme.spacing.md))
            NilePaySkeletonBox(
                modifier = Modifier
                    .fillMaxWidth(0.3f)
                    .height(28.dp)
            )
        }
    }
}
