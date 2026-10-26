package com.nilepay.designsystem.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.theme.NilePayTheme

data class NilePayBarEntry(
    val label: String,
    val value: Float,
    val formattedValue: String
)

@Composable
fun NilePayBarChart(
    entries: List<NilePayBarEntry>,
    modifier: Modifier = Modifier,
    chartHeight: Int = 160
) {
    if (entries.isEmpty()) return

    val maxValue = remember(entries) {
        val max = entries.maxOfOrNull { it.value } ?: 1f
        if (max > 0f) max else 1f
    }

    var selectedIndex by remember { mutableIntStateOf(-1) }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight.dp)
                .padding(horizontal = NilePayTheme.spacing.xs),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            entries.forEachIndexed { index, entry ->
                val isSelected = selectedIndex == index
                val fraction = (entry.value / maxValue).coerceIn(0.04f, 1f)

                val animatedFraction by animateFloatAsState(
                    targetValue = fraction,
                    animationSpec = tween(durationMillis = 600),
                    label = "bar_anim_$index"
                )

                val barColor: Color = when {
                    isSelected -> NilePayTheme.colors.primary
                    entry.value == maxValue -> NilePayTheme.colors.primary.copy(alpha = 0.85f)
                    else -> if (NilePayTheme.colors.isDark) NilePayTheme.colors.surfaceSubtle else NilePayTheme.colors.borderSubtle
                }

                val barDescription = "${entry.label}: ${entry.formattedValue}"

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .semantics {
                            role = Role.Button
                            contentDescription = barDescription
                        }
                        .clickable {
                            selectedIndex = if (selectedIndex == index) -1 else index
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom
                ) {
                    if (isSelected) {
                        Text(
                            text = entry.formattedValue,
                            style = NilePayTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = NilePayTheme.colors.primary,
                            modifier = Modifier.padding(bottom = 2.dp)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.55f)
                            .fillMaxHeight(animatedFraction)
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(barColor)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(NilePayTheme.spacing.sm))

        // X-Axis Labels
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = NilePayTheme.spacing.xs),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            entries.forEachIndexed { index, entry ->
                val isSelected = selectedIndex == index
                Text(
                    text = entry.label,
                    style = NilePayTheme.typography.labelSmall,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    color = if (isSelected) NilePayTheme.colors.primary else NilePayTheme.colors.onSurfaceSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}
