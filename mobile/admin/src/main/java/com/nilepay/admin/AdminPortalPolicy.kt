package com.nilepay.admin

import java.net.URI

/** Keep the privileged portal inside its real HTTPS origin. */
internal object AdminPortalPolicy {
    const val PORTAL_URL = "https://nilepay-admin.runasp.net/"

    fun isPortalUrl(value: String?): Boolean = runCatching {
        val uri = URI(value ?: return false)
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals("nilepay-admin.runasp.net", ignoreCase = true) &&
            uri.rawUserInfo == null && (uri.port == -1 || uri.port == 443)
    }.getOrDefault(false)

    fun canOpenExternally(value: String?): Boolean = runCatching {
        val uri = URI(value ?: return false)
        when (uri.scheme?.lowercase()) {
            "https" -> !uri.host.isNullOrBlank() && uri.rawUserInfo == null
            "mailto", "tel" -> !uri.rawSchemeSpecificPart.isNullOrBlank()
            else -> false
        }
    }.getOrDefault(false)
}
