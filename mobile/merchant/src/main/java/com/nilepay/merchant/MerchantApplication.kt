package com.nilepay.merchant

import android.app.Application
import dagger.hilt.android.HiltAndroidApp
import com.nilepay.merchant.detection.DetectorWork

@HiltAndroidApp
class MerchantApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        DetectorWork.scheduleHeartbeat(this)
    }
}
