package com.nilepay.designsystem.components

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme
import java.text.NumberFormat
import java.util.Locale

enum class NilePayAmountSize {
    Display,
    Large,
    Medium,
    Small
}

@Composable
fun NilePayAmountText(
    amount: Double,
    modifier: Modifier = Modifier,
    size: NilePayAmountSize = NilePayAmountSize.Large,
    color: Color = NilePayTheme.colors.onSurface
) {
    // Re-read locale when configuration changes
    val configuration = LocalConfiguration.current
    val locale = remember(configuration) {
        val locales = configuration.locales
        if (!locales.isEmpty) locales[0] else Locale.getDefault()
    }

    val formattedNumber = remember(amount, locale) {
        val format = NumberFormat.getNumberInstance(locale).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        format.format(amount)
    }

    val amountString = stringResource(R.string.amount_format_egp, formattedNumber)

    val textStyle: TextStyle = when (size) {
        NilePayAmountSize.Display -> NilePayTheme.typography.amountDisplay
        NilePayAmountSize.Large -> NilePayTheme.typography.amountLarge
        NilePayAmountSize.Medium -> NilePayTheme.typography.amountMedium
        NilePayAmountSize.Small -> NilePayTheme.typography.amountSmall
    }

    Text(
        text = amountString,
        style = textStyle,
        color = color,
        modifier = modifier.semantics {
            contentDescription = amountString
        }
    )
}
