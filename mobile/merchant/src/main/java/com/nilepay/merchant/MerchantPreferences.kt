package com.nilepay.merchant

import android.content.Context

enum class MerchantTheme { System, Light, Dark }

class MerchantPreferences(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("nilepay_merchant_preferences", Context.MODE_PRIVATE)

    var theme: MerchantTheme
        get() = runCatching { MerchantTheme.valueOf(prefs.getString("theme", MerchantTheme.Dark.name)!!) }
            .getOrDefault(MerchantTheme.Dark)
        set(value) { prefs.edit().putString("theme", value.name).apply() }

    var language: String
        get() = prefs.getString("language", "en")?.takeIf { it == "en" || it == "ar" } ?: "en"
        set(value) { prefs.edit().putString("language", if (value == "ar") "ar" else "en").apply() }

    var compact: Boolean
        get() = prefs.getBoolean("compact", true)
        set(value) { prefs.edit().putBoolean("compact", value).apply() }
}
