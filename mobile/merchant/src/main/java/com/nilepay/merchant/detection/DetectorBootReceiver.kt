package com.nilepay.merchant.detection

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.nilepay.merchant.MerchantSession

class DetectorBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val appContext = context?.applicationContext ?: return
        val action = intent?.action ?: return
        if (action in SUPPORTED_ACTIONS) {
            val session = MerchantSession(appContext)
            if (session.isSignedIn && session.hasDisclosureConsent) {
                DetectorKeepAliveService.ensureRunning(appContext)
                DetectorWork.heartbeatNow(appContext)
            }
        }
    }

    companion object {
        const val ACTION_RESTART_DETECTOR = "com.nilepay.merchant.action.RESTART_DETECTOR"
        private val SUPPORTED_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON",
            ACTION_RESTART_DETECTOR
        )
    }
}

