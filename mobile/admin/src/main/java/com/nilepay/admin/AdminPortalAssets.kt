package com.nilepay.admin

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException

/** Serve the signed APK's admin UI at the real admin origin; API calls remain HTTPS network requests. */
internal object AdminPortalAssets {
    fun assetPath(url: String): String? {
        if (!AdminPortalPolicy.isPortalUrl(url)) return null
        val path = Uri.parse(url).path ?: "/"
        if (path == "/" || path == "/admin" || path == "/portal/admin") return "portal/index.html"
        if (!path.startsWith("/assets/") && !path.startsWith("/brand/")) return null
        if (path.length > 512 || !Regex("^/[A-Za-z0-9._/-]+$").matches(path) || path.split('/').any { it == "." || it == ".." }) return null
        return "portal${path}"
    }
    fun response(context: Context, url: String): WebResourceResponse? {
        val path = assetPath(url) ?: return null
        val mime = when (path.substringAfterLast('.').lowercase()) {
            "html" -> "text/html"; "js" -> "application/javascript"; "css" -> "text/css"
            "svg" -> "image/svg+xml"; "png" -> "image/png"; "jpg", "jpeg" -> "image/jpeg"
            "woff2" -> "font/woff2"; "woff" -> "font/woff"; "ttf" -> "font/ttf"; else -> "application/octet-stream"
        }
        return try {
            WebResourceResponse(mime, "UTF-8", 200, "OK", mapOf("Cache-Control" to "no-store"), context.assets.open(path))
        } catch (_: FileNotFoundException) {
            WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", emptyMap(), ByteArrayInputStream(byteArrayOf()))
        }
    }
}
