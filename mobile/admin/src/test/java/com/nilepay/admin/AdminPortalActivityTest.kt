package com.nilepay.admin

import android.net.Uri
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.widget.TextView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = AdminApplication::class)
class AdminPortalActivityTest {
    private fun request(url: String, mainFrame: Boolean = true, gesture: Boolean = true) = object : WebResourceRequest {
        override fun getUrl() = Uri.parse(url)
        override fun isForMainFrame() = mainFrame
        override fun isRedirect() = false
        override fun hasGesture() = gesture
        override fun getMethod() = "GET"
        override fun getRequestHeaders() = emptyMap<String, String>()
    }
    @Test fun opensThePortalWithRequiredWebCapabilitiesAndRestrictedLocalAccess() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val web = activity.portal
        assertEquals(AdminPortalPolicy.PORTAL_URL, shadowOf(web).lastLoadedUrl)
        assertTrue(web.settings.javaScriptEnabled)
        assertTrue(web.settings.domStorageEnabled)
        assertFalse(web.settings.allowFileAccess)
        assertFalse(web.settings.allowContentAccess)
        assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, web.settings.mixedContentMode)
        assertTrue(CookieManager.getInstance().acceptCookie())
        assertFalse(web.webViewClient.shouldOverrideUrlLoading(web, request(AdminPortalPolicy.PORTAL_URL)))
        assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request("javascript:alert(1)")))
        controller.pause().stop().destroy()
    }
    @Test fun successfulPortalLoadAppliesOnlyTheBundledResponsiveFix() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val web = controller.get().portal
        web.webViewClient.onPageFinished(web, AdminPortalPolicy.PORTAL_URL)
        val script = shadowOf(web).lastEvaluatedJavascript
        assertTrue(script.contains("nilepay-admin-mobile-layout"))
        assertTrue(script.contains("0.85fr"))
        assertTrue(script.contains("max-width: 768px"))
        controller.pause().stop().destroy()
    }
    @Test fun csvExportRequiresUserGestureAndOpensTheSystemSavePicker() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val web = activity.portal
        val pending = java.io.File(activity.cacheDir, "admin-export-pending.csv")
        pending.delete()
        val export = Uri.Builder().scheme("nilepay-export").authority("csv")
            .appendQueryParameter("filename", "payments.csv").appendQueryParameter("csv", "Amount\n1.00").build().toString()
        assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request(export, gesture = false)))
        assertFalse(pending.exists())
        assertTrue(web.webViewClient.shouldOverrideUrlLoading(web, request(export)))
        assertEquals("Amount\n1.00", pending.readText())
        val picker = shadowOf(activity).nextStartedActivityForResult.intent
        assertEquals(android.content.Intent.ACTION_CREATE_DOCUMENT, picker.action)
        assertEquals("text/csv", picker.type)
        pending.delete()
        controller.pause().stop().destroy()
    }
    @Test fun apiSubresourceErrorsDoNotReplaceTheWholePortalButPageErrorsShowRetry() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        val web = activity.portal
        val root = activity.findViewById<View>(android.R.id.content)
        fun retryVisible(): Boolean {
            fun find(view: View): Boolean = when (view) {
                is TextView -> view.text.toString() == activity.getString(R.string.admin_retry) && view.isShown
                is android.view.ViewGroup -> (0 until view.childCount).any { find(view.getChildAt(it)) }
                else -> false
            }
            return find(root)
        }
        val failure = WebResourceResponse("text/plain", "UTF-8", 503, "Unavailable", emptyMap(), null)
        web.webViewClient.onReceivedHttpError(web, request("https://nilepay-api.runasp.net/api/admin/session", false), failure)
        assertFalse(retryVisible())
        web.webViewClient.onReceivedHttpError(web, request(AdminPortalPolicy.PORTAL_URL), failure)
        assertTrue(retryVisible())
        web.webViewClient.onPageFinished(web, AdminPortalPolicy.PORTAL_URL)
        assertTrue("A finish callback must not hide a failed main-page load", retryVisible())
        controller.pause().stop().destroy()
    }
}
