package com.nilepay.merchant

import android.graphics.Bitmap
import android.util.Base64
import java.io.ByteArrayOutputStream
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], application = android.app.Application::class)
class MerchantAvatarTest {
    @Test fun `valid inline profile photo is decoded at a bounded resolution`() {
        val source = Bitmap.createBitmap(2048, 1024, Bitmap.Config.ARGB_8888)
        val stream = ByteArrayOutputStream()
        source.compress(Bitmap.CompressFormat.PNG, 100, stream)
        val data = "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        val avatar = decodeMerchantAvatar(data)
        assertNotNull(avatar)
        assertTrue(avatar!!.width <= 512)
        assertTrue(avatar.height <= 512)
    }

    @Test fun `missing removed unsupported and corrupt photos use the fallback`() {
        listOf(null, "", "https://example.com/image.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,broken", "data:image/png;base64," + "a".repeat(1_100_000)).forEach {
            assertNull(decodeMerchantAvatar(it))
        }
    }
}
