package com.nilepay.merchant

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.dp
import com.nilepay.designsystem.theme.NilePayTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Decode only supported inline photos, downsampled to bound bitmap memory. */
internal fun decodeMerchantAvatar(data: String?): Bitmap? = runCatching {
    if (data == null || data.length > 1_100_000 || !data.startsWith("data:image/")) return null
    val split = data.indexOf(";base64,")
    if (split < 0 || data.substring(5, split) !in setOf("image/jpeg", "image/png", "image/webp")) return null
    val bytes = Base64.decode(data.substring(split + 8), Base64.DEFAULT)
    if (bytes.size > 750 * 1024) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || maxOf(bounds.outWidth, bounds.outHeight) > 100_000) return null
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 512) sample *= 2
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
}.getOrNull()

@Composable
fun MerchantAvatar(imageData: String?, name: String, modifier: Modifier = Modifier) {
    val description = stringResource(R.string.action_profile)
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = imageData) {
        value = null
        value = withContext(Dispatchers.IO) { decodeMerchantAvatar(imageData) }
    }
    Box(modifier.size(40.dp).clip(CircleShape).background(NilePayTheme.colors.primary.copy(alpha = 0.12f)).semantics(mergeDescendants = true) { contentDescription = description }, contentAlignment = Alignment.Center) {
        bitmap?.let { Image(it.asImageBitmap(), null, Modifier.matchParentSize(), contentScale = ContentScale.Crop) }
            ?: Text(name.trim().firstOrNull()?.uppercase() ?: "N", style = NilePayTheme.typography.titleMedium, color = NilePayTheme.colors.primary)
    }
}
