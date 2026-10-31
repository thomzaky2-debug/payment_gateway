package com.nilepay.designsystem.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePayOtpField(
    otpValue: String,
    onOtpChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    length: Int = 6,
    isError: Boolean = false,
    enabled: Boolean = true,
    onComplete: ((String) -> Unit)? = null
) {
    BasicTextField(
        value = otpValue,
        onValueChange = { newValue ->
            val filtered = newValue.filter { it.isDigit() }.take(length)
            onOtpChange(filtered)
            if (filtered.length == length) {
                onComplete?.invoke(filtered)
            }
        },
        modifier = modifier.fillMaxWidth(),
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        keyboardActions = KeyboardActions(
            onDone = {
                if (otpValue.length == length) {
                    onComplete?.invoke(otpValue)
                }
            }
        ),
        decorationBox = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically
            ) {
                for (i in 0 until length) {
                    val char = otpValue.getOrNull(i)?.toString().orEmpty()
                    val isFocused = otpValue.length == i
                    val borderColor = when {
                        isError -> NilePayTheme.colors.destructive
                        isFocused -> NilePayTheme.colors.primary
                        char.isNotEmpty() -> NilePayTheme.colors.borderSubtle
                        else -> NilePayTheme.colors.border
                    }

                    val digitDescription = stringResource(R.string.otp_box_cd, i + 1)

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(0.85f)
                            .clip(RoundedCornerShape(8.dp))
                            .border(
                                width = if (isFocused) 2.dp else 1.dp,
                                color = borderColor,
                                shape = RoundedCornerShape(8.dp)
                            )
                            .semantics {
                                contentDescription = digitDescription
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = char,
                            style = NilePayTheme.typography.headlineMedium.copy(
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center,
                                fontSize = 22.sp
                            ),
                            color = NilePayTheme.colors.onSurface
                        )
                    }
                }
            }
        }
    )
}
