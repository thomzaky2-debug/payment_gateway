package com.nilepay.designsystem.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun NilePayTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    errorMessage: String? = null,
    isError: Boolean = errorMessage != null,
    enabled: Boolean = true,
    singleLine: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None
) {
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            singleLine = singleLine,
            label = {
                Text(
                    text = label,
                    style = NilePayTheme.typography.bodyMedium
                )
            },
            placeholder = placeholder?.let {
                {
                    Text(
                        text = it,
                        style = NilePayTheme.typography.bodyMedium,
                        color = NilePayTheme.colors.onSurfaceSecondary.copy(alpha = 0.6f)
                    )
                }
            },
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            isError = isError,
            visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            shape = NilePayTheme.shapes.medium,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = NilePayTheme.colors.surface,
                unfocusedContainerColor = NilePayTheme.colors.surface,
                disabledContainerColor = NilePayTheme.colors.surfaceSubtle,
                focusedBorderColor = NilePayTheme.colors.primary,
                unfocusedBorderColor = NilePayTheme.colors.border,
                focusedLabelColor = NilePayTheme.colors.primary,
                unfocusedLabelColor = NilePayTheme.colors.onSurfaceSecondary,
                focusedTextColor = NilePayTheme.colors.onSurface,
                unfocusedTextColor = NilePayTheme.colors.onSurface,
                errorBorderColor = NilePayTheme.colors.destructive,
                errorLabelColor = NilePayTheme.colors.destructive,
                errorTextColor = NilePayTheme.colors.onSurface
            )
        )

        if (errorMessage != null) {
            Text(
                text = errorMessage,
                style = NilePayTheme.typography.bodySmall,
                color = NilePayTheme.colors.destructive,
                modifier = Modifier.padding(start = NilePayTheme.spacing.base, top = NilePayTheme.spacing.xs)
            )
        }
    }
}

@Composable
fun NilePayPasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    errorMessage: String? = null,
    isError: Boolean = errorMessage != null,
    enabled: Boolean = true,
    keyboardActions: KeyboardActions = KeyboardActions.Default
) {
    var passwordVisible by remember { mutableStateOf(false) }

    NilePayTextField(
        value = value,
        onValueChange = onValueChange,
        label = label,
        modifier = modifier,
        placeholder = placeholder,
        errorMessage = errorMessage,
        isError = isError,
        enabled = enabled,
        singleLine = true,
        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        keyboardActions = keyboardActions,
        trailingIcon = {
            IconButton(
                onClick = { passwordVisible = !passwordVisible },
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    contentDescription = if (passwordVisible) {
                        stringResource(R.string.hide_password)
                    } else {
                        stringResource(R.string.show_password)
                    },
                    tint = NilePayTheme.colors.onSurfaceSecondary
                )
            }
        }
    )
}
