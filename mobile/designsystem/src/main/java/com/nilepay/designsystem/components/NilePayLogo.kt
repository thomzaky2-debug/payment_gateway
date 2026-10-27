package com.nilepay.designsystem.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.R

/** Original brand colors are preserved in both light and dark themes. */
@Composable
fun NilePayLogo(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.nilepay_mark),
        contentDescription = stringResource(R.string.brand_name),
        contentScale = ContentScale.Fit,
        modifier = modifier.size(40.dp)
    )
}
