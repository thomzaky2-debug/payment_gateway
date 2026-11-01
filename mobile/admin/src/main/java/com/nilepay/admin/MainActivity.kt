package com.nilepay.admin

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Bundle
import android.os.Message
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import dagger.hilt.android.AndroidEntryPoint

/** The actual admin website supplies every screen, permission and admin action. */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    internal lateinit var portal: WebView
        private set
    private lateinit var loading: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private lateinit var root: FrameLayout
    private var mainFrameFailed = false
    private var rendererGone = false
    private var retryUrl = AdminPortalPolicy.PORTAL_URL

    private val exportDocument = registerForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        val pending = java.io.File(cacheDir, "admin-export-pending.csv")
        try {
            if (uri != null && pending.isFile) {
                val output = contentResolver.openOutputStream(uri, "wt") ?: error("Cannot open destination")
                output.use { stream -> pending.inputStream().use { it.copyTo(stream) } }
                Toast.makeText(this, R.string.admin_export_saved, Toast.LENGTH_SHORT).show()
            }
        } catch (_: Exception) {
            Toast.makeText(this, R.string.admin_export_failed, Toast.LENGTH_LONG).show()
        } finally { pending.delete() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.rgb(9, 13, 22)
        window.navigationBarColor = Color.rgb(9, 13, 22)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(9, 13, 22)) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            insets
        }
        setContentView(root)
        portal = WebView(this).apply {
            id = View.generateViewId()
            setBackgroundColor(Color.rgb(9, 13, 22))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(true)
                useWideViewPort = true
                loadWithOverviewMode = true
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false
                safeBrowsingEnabled = true
                userAgentString = "$userAgentString NilePayAdmin/${BuildConfig.VERSION_NAME}"
            }
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            // The admin UI and its API use separate configured HTTPS hostnames.
            setAcceptThirdPartyCookies(portal, true)
        }
        root.addView(portal, FrameLayout.LayoutParams(-1, -1))
        loading = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = ColorStateList.valueOf(Color.rgb(37, 99, 235))
        }
        root.addView(loading, FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP))
        errorPanel = createErrorPanel()
        root.addView(errorPanel, FrameLayout.LayoutParams(-1, -1))
        portal.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (request.method == "GET") AdminPortalAssets.response(this@MainActivity, request.url.toString()) else null

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                if (request.url.scheme == "nilepay-export") {
                    if (request.hasGesture() && AdminPortalPolicy.isPortalUrl(view.url)) beginCsvExport(request.url)
                    return true
                }
                return handleNavigation(request.url.toString())
            }

            @Deprecated("Required for older WebView implementations")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = handleNavigation(url)

            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                if (!AdminPortalPolicy.isPortalUrl(url)) {
                    view.stopLoading()
                    showLoadError()
                    return
                }
                retryUrl = url!!
                mainFrameFailed = false
                errorPanel.visibility = View.GONE
                loading.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                loading.visibility = View.GONE
                if (!mainFrameFailed) {
                    errorPanel.visibility = View.GONE
                    if (AdminPortalPolicy.isPortalUrl(url)) applyMobileLayout(view)
                }
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showLoadError()
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame && response.statusCode >= 400) showLoadError()
            }

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                if (AdminPortalPolicy.isPortalUrl(error.url)) showLoadError()
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                rendererGone = true
                root.removeView(view)
                view.destroy()
                showLoadError()
                return true
            }
        }
        portal.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, progress: Int) {
                loading.progress = progress
                loading.visibility = if (progress < 100 && !mainFrameFailed) View.VISIBLE else View.GONE
            }

            // Target="_blank" links keep the same trusted-origin rules as ordinary links.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                if (!isUserGesture || !AdminPortalPolicy.isPortalUrl(view.url)) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    private fun navigate(url: String): Boolean {
                        if (AdminPortalPolicy.isPortalUrl(url)) portal.loadUrl(url) else openExternal(url)
                        popup.post { popup.destroy() }
                        return true
                    }
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = navigate(request.url.toString())
                    @Deprecated("Required for older WebView implementations")
                    override fun shouldOverrideUrlLoading(view: WebView, url: String) = navigate(url)
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (rendererGone) { finish(); return }
                portal.evaluateJavascript("""
                    (function() {
                        var close = document.querySelector('[data-admin-close]');
                        if (close) { close.click(); return true; }
                        return false;
                    })();
                """.trimIndent()) { handled ->
                    if (isFinishing || isDestroyed) return@evaluateJavascript
                    if (handled != "true") {
                        if (portal.canGoBack()) portal.goBack() else finish()
                    }
                }
            }
        })
        val restored = savedInstanceState?.getBundle(WEB_STATE)?.let { portal.restoreState(it) }
        if (restored == null || !AdminPortalPolicy.isPortalUrl(portal.url)) portal.loadUrl(AdminPortalPolicy.PORTAL_URL)
        ViewCompat.requestApplyInsets(root)
    }

    private fun beginCsvExport(uri: Uri) {
        if (uri.host != "csv") return
        val csv = uri.getQueryParameter("csv") ?: return
        if (csv.toByteArray(Charsets.UTF_8).size > 2 * 1024 * 1024) {
            Toast.makeText(this, R.string.admin_export_too_large, Toast.LENGTH_LONG).show()
            return
        }
        val name = uri.getQueryParameter("filename").orEmpty().replace(Regex("[^A-Za-z0-9._-]"), "_")
            .take(100).let { if (it.endsWith(".csv")) it else "NilePay-admin-export.csv" }
        try {
            java.io.File(cacheDir, "admin-export-pending.csv").writeText(csv, Charsets.UTF_8)
            exportDocument.launch(name)
        } catch (_: Exception) {
            Toast.makeText(this, R.string.admin_export_failed, Toast.LENGTH_LONG).show()
        }
    }

    private fun applyMobileLayout(view: WebView) {
        val css = assets.open("admin-mobile.css").bufferedReader().use { it.readText() }
        val quotedCss = org.json.JSONObject.quote(css)
        view.evaluateJavascript("""
            (function() {
                if (document.getElementById('nilepay-admin-mobile-layout')) return;
                var style = document.createElement('style');
                style.id = 'nilepay-admin-mobile-layout';
                style.textContent = $quotedCss;
                document.head.appendChild(style);
            })();
        """.trimIndent(), null)
    }

    private fun handleNavigation(url: String): Boolean {
        if (AdminPortalPolicy.isPortalUrl(url)) return false
        openExternal(url)
        return true
    }

    private fun openExternal(url: String) {
        if (!AdminPortalPolicy.canOpenExternally(url)) return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.admin_no_link_app, Toast.LENGTH_SHORT).show()
        }
    }

    private fun createErrorPanel() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(28), dp(28), dp(28), dp(28))
        setBackgroundColor(Color.rgb(9, 13, 22))
        visibility = View.GONE
        addView(TextView(this@MainActivity).apply {
            setText(R.string.admin_app_name)
            textSize = 24f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        })
        addView(TextView(this@MainActivity).apply {
            setText(R.string.admin_connection_error)
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(148, 163, 184))
            setPadding(0, dp(16), 0, dp(20))
        })
        addView(Button(this@MainActivity).apply {
            setText(R.string.admin_retry)
            setOnClickListener {
                if (rendererGone) recreate() else portal.loadUrl(retryUrl)
            }
        })
    }

    private fun showLoadError() {
        mainFrameFailed = true
        loading.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (!rendererGone) {
            val state = Bundle()
            portal.saveState(state)
            outState.putBundle(WEB_STATE, state)
        }
        super.onSaveInstanceState(outState)
    }

    override fun onResume() { super.onResume(); if (::portal.isInitialized && !rendererGone) portal.onResume() }
    override fun onPause() {
        if (::portal.isInitialized && !rendererGone) portal.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }
    override fun onDestroy() {
        if (::portal.isInitialized && !rendererGone) {
            root.removeView(portal)
            portal.stopLoading()
            portal.destroy()
        }
        super.onDestroy()
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private companion object { const val WEB_STATE = "nilepay_admin_web_state" }
}
