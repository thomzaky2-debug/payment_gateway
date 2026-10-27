package com.nilepay.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.components.NilePayLogo
import com.nilepay.designsystem.theme.NilePayTheme

@Composable
fun AppContent() {
    NilePayTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(NilePayTheme.colors.background),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                NilePayLogo(Modifier.size(64.dp))
                Text(
                    text = "NilePay Admin",
                    style = NilePayTheme.typography.headlineLarge,
                    color = NilePayTheme.colors.onBackground
                )
            }
        }
    }
}
