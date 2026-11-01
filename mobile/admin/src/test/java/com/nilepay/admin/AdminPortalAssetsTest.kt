package com.nilepay.admin

import android.app.Application
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class AdminPortalAssetsTest {
    @Test fun servesBundledAdminUiButLeavesLiveApiAndOtherOriginsUntouched() {
        assertEquals("portal/index.html", AdminPortalAssets.assetPath(AdminPortalPolicy.PORTAL_URL))
        assertEquals("portal/assets/admin-test.js", AdminPortalAssets.assetPath("https://nilepay-admin.runasp.net/assets/admin-test.js"))
        assertNull(AdminPortalAssets.assetPath("https://nilepay-api.runasp.net/api/admin/session"))
        assertNull(AdminPortalAssets.assetPath("https://nilepay-admin.runasp.net/api/admin/session"))
        assertNull(AdminPortalAssets.assetPath("https://evil.example/assets/admin-test.js"))
        assertNull(AdminPortalAssets.assetPath("https://nilepay-admin.runasp.net/assets/../private"))
        assertNull(AdminPortalAssets.assetPath("https://nilepay-admin.runasp.net/assets/%2e%2e/private"))
        val response = AdminPortalAssets.response(RuntimeEnvironment.getApplication(), AdminPortalPolicy.PORTAL_URL)!!
        assertEquals(200, response.statusCode)
        assertEquals("text/html", response.mimeType)
        assertTrue(response.data.bufferedReader().use { it.readText() }.contains("/assets/admin-"))
    }
    @Test fun missingBundledResourceDoesNotMixInAnOlderHostedBundle() {
        val response = AdminPortalAssets.response(RuntimeEnvironment.getApplication(), "https://nilepay-admin.runasp.net/assets/no-such-file.js")!!
        assertEquals(404, response.statusCode)
    }
}
