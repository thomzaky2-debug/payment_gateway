package com.nilepay.merchant

import android.content.Context
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = android.app.Application::class)
class MerchantSessionTest {

    @Test
    fun `gatewayClient instance is cached on session`() {
        val context = RuntimeEnvironment.getApplication()
        val session = MerchantSession(context)

        val client1 = session.gatewayClient
        val client2 = session.gatewayClient

        assertSame("gatewayClient should be reused across calls to avoid recreating OkHttp clients", client1, client2)
    }
}
