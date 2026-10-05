package com.instapaydetector.app

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.instapaydetector.app.BuildConfig
import com.instapaydetector.app.databinding.ActivityLoginBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private val loginTag = "InstaPayDetectorLogin"
    private lateinit var config: GatewayConfig
    private var otpTimer: CountDownTimer? = null
    private var otpExpiresAt: Long = 0L
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.tvBuildInfo.text = "Build ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

        config = GatewayConfig.get(this)

        binding.btnSendOtp.setOnClickListener {
            if (validateConfiguredGateway()) requestOtp(config)
        }
        updateOtpUi(false)

        binding.btnLogin.setOnClickListener {
            if (validateConfiguredGateway()) handleLogin(config)
        }
    }

    private fun validateConfiguredGateway(): Boolean {
        val serverUrl = config.serverBaseUrl.trim().trimEnd('/')
        if (serverUrl.isBlank() || serverUrl.contains("example.invalid")) {
            showError("This app build does not have a gateway server configured.")
            return false
        }
        if (!BuildConfig.DEBUG && !serverUrl.startsWith("https://")) {
            showError("This app build requires a secure HTTPS gateway.")
            return false
        }
        return true
    }

    private fun handleLogin(config: GatewayConfig) {
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString() ?: ""
        val otp = binding.etOtp.text?.toString()?.trim() ?: ""
        val otpRequested = config.pendingVerificationId.isNotBlank()

        Log.d(loginTag, "handleLogin(version=${BuildConfig.VERSION_NAME}, code=${BuildConfig.VERSION_CODE}, email=$email, otpVisible=${binding.etOtp.visibility == View.VISIBLE}, otpProvided=${otp.isNotBlank()})")

        if (email.isEmpty() || password.isEmpty()) {
            showError(if (otp.isBlank()) "[v${BuildConfig.VERSION_NAME}] Enter your email and password to receive a verification code." else "[v${BuildConfig.VERSION_NAME}] Enter the verification code sent to your email.")
            return
        }

        if (!otpRequested) {
            showError("[v${BuildConfig.VERSION_NAME}] Tap Send OTP first, then paste the code before signing in.")
            return
        }

        if (otp.isBlank()) {
            showError("[v${BuildConfig.VERSION_NAME}] Paste the 6-digit OTP before signing in.")
            return
        }

        if (otp.length != 6) {
            showError("[v${BuildConfig.VERSION_NAME}] OTP must be 6 digits.")
            return
        }

        binding.btnLogin.isEnabled = false
        binding.btnLogin.text = "Logging in..."
        binding.tvError.visibility = View.GONE

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                performLoginRequest(email, password, config.pendingVerificationId, otp)
            }

            result.fold(
                onSuccess = { responseJson ->
                    val merchant = responseJson.optJSONObject("client") ?: responseJson
                    val sessionToken = responseJson.optString("token", "")
                    val detectToken = responseJson.optString("detectToken", "")
                    val instapayHandle = merchant.optString("instapayHandle", "")
                    val responseEmail = merchant.optString("email", email)
                    val plan = merchant.optString("subscriptionPlan", "FREE_TRIAL")
                    val subscriptionEndsAt = merchant.optString("subscriptionEndsAt", "")

                    val businessName = merchant.optString("businessName", "")
                    val webhookUrl = merchant.optString("webhookUrl", "")
                    val paymentUrl = merchant.optString("instapayPaymentUrl", "")

                    if (responseJson.optBoolean("otpRequired", false)) {
                        config.pendingVerificationId = responseJson.optString("verificationId")
                        startOtpCountdown(responseJson.optInt("expiresInSeconds", 600))
                        binding.btnLogin.text = "Verify and log in"
                        showError("[v${BuildConfig.VERSION_NAME}] Verification code sent to your email.")
                        binding.btnLogin.isEnabled = true
                    } else if (sessionToken.isNotEmpty() && detectToken.isNotEmpty() && instapayHandle.isNotEmpty()) {
                        config.gatewayUrl = "${config.serverBaseUrl}/api/webhooks/instapay"
                        config.merchantSessionToken = sessionToken
                        config.authToken = detectToken
                        config.merchantHandle = instapayHandle
                        config.merchantBusinessName = businessName
                        config.merchantEmail = responseEmail
                        config.merchantWebhookUrl = webhookUrl
                        config.merchantPaymentUrl = paymentUrl
                        config.subscriptionPlan = plan
                        config.subscriptionEndsAt = subscriptionEndsAt.ifBlank { null }
                        config.pendingVerificationId = ""
                        config.isLoggedIn = true
                        MerchantNotificationPoller.start(this@LoginActivity)
                        MerchantNotificationPoller.pollNow(this@LoginActivity)
                        MerchantNotificationService.start(this@LoginActivity)

                        Toast.makeText(this@LoginActivity, "Login Successful!", Toast.LENGTH_SHORT).show()
                        
                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        binding.btnLogin.isEnabled = true
                        binding.btnLogin.text = "Log In"
                        Log.w(loginTag, "Invalid login response payload shape")
                        showError("Invalid response from server.")
                    }
                },
                onFailure = { exception ->
                    Log.e(loginTag, "loginFailed", exception)
                    binding.btnLogin.isEnabled = true
                    binding.btnLogin.text = "Log In"
                    showError("[v${BuildConfig.VERSION_NAME}] ${exception.message ?: "Connection failed."}")
                }
            )
        }
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun requestOtp(config: GatewayConfig) {
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString() ?: ""
        if (email.isBlank() || password.isBlank()) {
            showError("[v${BuildConfig.VERSION_NAME}] Enter your email and password first.")
            return
        }
        binding.btnSendOtp.isEnabled = false
        binding.btnSendOtp.text = "Sending..."
        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                performLoginRequest(email, password, config.pendingVerificationId, "")
            }
            result.fold(
                onSuccess = { responseJson ->
                    if (responseJson.optBoolean("otpRequired", false)) {
                        config.pendingVerificationId = responseJson.optString("verificationId")
                        startOtpCountdown(responseJson.optInt("expiresInSeconds", 600))
                        showError("[v${BuildConfig.VERSION_NAME}] Verification code sent to your email.")
                    } else {
                        showError("[v${BuildConfig.VERSION_NAME}] Unable to request OTP right now.")
                    }
                },
                onFailure = { exception ->
                    showError("[v${BuildConfig.VERSION_NAME}] ${exception.message ?: "Failed to send OTP."}")
                }
            )
            binding.btnSendOtp.isEnabled = true
            binding.btnSendOtp.text = "Send OTP"
        }
    }

    private fun startOtpCountdown(expiresInSeconds: Int) {
        otpTimer?.cancel()
        val totalMs = (expiresInSeconds.coerceAtLeast(1)) * 1000L
        otpExpiresAt = System.currentTimeMillis() + totalMs
        updateOtpUi(true)
        otpTimer = object : CountDownTimer(totalMs, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                updateOtpCountdownLabel(millisUntilFinished)
            }

            override fun onFinish() {
                otpExpiresAt = 0L
                binding.etOtp.text?.clear()
                config.pendingVerificationId = ""
                updateOtpUi(false)
                showError("[v${BuildConfig.VERSION_NAME}] OTP expired. Tap Send OTP to request a new code.")
            }
        }.start()
    }

    private fun updateOtpUi(active: Boolean) {
        binding.btnSendOtp.text = if (active) "Resend OTP" else "Send OTP"
        binding.btnSendOtp.isEnabled = true
        binding.etOtp.isEnabled = active
        binding.etOtp.isFocusable = active
        binding.etOtp.isFocusableInTouchMode = active
        binding.tvOtpTimer.visibility = View.VISIBLE
        if (active) {
            updateOtpCountdownLabel(otpExpiresAt - System.currentTimeMillis())
        } else {
            binding.tvOtpTimer.text = "OTP expires in 10:00"
        }
    }

    private fun updateOtpCountdownLabel(millisRemaining: Long) {
        val totalSeconds = (millisRemaining / 1000L).coerceAtLeast(0)
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        binding.tvOtpTimer.text = String.format("OTP expires in %02d:%02d", minutes, seconds)
    }

    override fun onDestroy() {
        otpTimer?.cancel()
        super.onDestroy()
    }

    private fun performLoginRequest(email: String, password: String, verificationId: String, otp: String): Result<JSONObject> {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val jsonBody = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("tokenTransport", "bearer")
            if (verificationId.isNotBlank()) put("verificationId", verificationId)
            if (otp.isNotBlank()) put("otp", otp)
        }
        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val baseUrl = config.serverBaseUrl
        val request = Request.Builder()
            .url("$baseUrl/api/auth/apk-login")
            .post(requestBody)
            .build()

        return try {
            httpClient.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string().orEmpty()
                Log.d(loginTag, "Login endpoint returned HTTP ${response.code}")
                if (response.code == 200) {
                    Result.success(JSONObject(bodyStr))
                } else {
                    val errMsg = try {
                        JSONObject(bodyStr).optString("error", "HTTP ${response.code}")
                    } catch (e: Exception) {
                        "HTTP ${response.code}"
                    }
                    Result.failure(Exception(errMsg))
                }
            }
        } catch (e: IOException) {
            e.printStackTrace()
            Result.failure(e)
        }
    }
}
