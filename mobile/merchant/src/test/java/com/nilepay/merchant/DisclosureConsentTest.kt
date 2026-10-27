package com.nilepay.merchant

import android.app.Application
import android.content.Context
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class, manifest = Config.NONE)
class DisclosureConsentTest {
    private val context get() = RuntimeEnvironment.getApplication()

    @Before fun clearState() {
        context.getSharedPreferences("nilepay_merchant_state", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test fun missingAndOldDisclosureDoNotAuthorizeCollection() {
        val session = MerchantSession(context)
        assertFalse(session.hasDisclosureConsent)
        context.getSharedPreferences("nilepay_merchant_state", Context.MODE_PRIVATE)
            .edit().putLong("disclosure_consent_at", System.currentTimeMillis()).commit()
        assertFalse(session.hasDisclosureConsent)
    }

    @Test fun explicitConsentPersistsAndSignOutRevokesIt() {
        val session = MerchantSession(context)
        session.recordConsent()
        assertTrue(MerchantSession(context).hasDisclosureConsent)
        session.signOut()
        assertFalse(MerchantSession(context).hasDisclosureConsent)
    }
}
