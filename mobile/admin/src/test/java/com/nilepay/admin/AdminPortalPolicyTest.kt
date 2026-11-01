package com.nilepay.admin

import org.junit.Assert.*
import org.junit.Test

class AdminPortalPolicyTest {
    @Test fun keepsAllPortalScreensOnTheirRealHttpsOrigin() {
        listOf(AdminPortalPolicy.PORTAL_URL, "https://nilepay-admin.runasp.net/admin",
            "https://nilepay-admin.runasp.net:443/portal/admin?tab=merchants#details").forEach {
            assertTrue(it, AdminPortalPolicy.isPortalUrl(it))
        }
    }
    @Test fun rejectsLookalikesCredentialsInUrlsAndNonHttpsNavigation() {
        listOf(null, "", "http://nilepay-admin.runasp.net/", "https://nilepay-admin.runasp.net.evil.example/",
            "https://nilepay-admin.runasp.net@evil.example/", "https://evil.example@nilepay-admin.runasp.net/",
            "https://nilepay-admin.runasp.net:444/", "javascript:alert(1)", "file:///sdcard/secret",
            "content://private/data", "intent://anything", "https://nilepay.runasp.net/").forEach {
            assertFalse(it, AdminPortalPolicy.isPortalUrl(it))
        }
    }
    @Test fun allowsNormalExternalLinksButBlocksExecutableAndLocalSchemes() {
        listOf("https://nilepay-api.runasp.net/privacy", "mailto:support@example.com", "tel:+201000000000").forEach {
            assertTrue(it, AdminPortalPolicy.canOpenExternally(it))
        }
        listOf("http://example.com", "javascript:alert(1)", "file:///private", "content://private", "intent://launch", "https://user:pass@example.com").forEach {
            assertFalse(it, AdminPortalPolicy.canOpenExternally(it))
        }
    }
}
