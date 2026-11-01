package com.nilepay.merchant.detection

import java.security.MessageDigest
import java.time.Instant
import java.util.regex.Pattern

data class ParsedPayment(
    val amountEgp: Double,
    val senderHandle: String,
    val reference: String? = null,
    val rawSender: String? = null
)

object InstaPayParser {
    const val INSTAPAY_PACKAGE = "com.egyptianbanks.instapay"

    val SUPPORTED_PACKAGES = setOf(
        INSTAPAY_PACKAGE,
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms"
    )

    fun isSupportedPackage(packageName: String): Boolean =
        SUPPORTED_PACKAGES.contains(packageName)

    private val englishPattern = Pattern.compile(
        "(?:you\\s+have\\s+received|received|incoming\\s+transfer(?:\\s+of)?|payment\\s+of|payment\\s+received|transfer\\s+of)\\s+" +
        "(?:egp|le|l\\.e\\.)?\\s*" +
        "([0-9]+(?:[\\.,][0-9]+)*)\\s*" +
        "(?:egp|le|l\\.e\\.)?\\s*" +
        "(?:from)\\s+" +
        "([^\\n\\r,;]+)",
        Pattern.CASE_INSENSITIVE
    )

    private val arabicPattern = Pattern.compile(
        "(?:تم\\s+استلام|لقد\\s+استلمت|استلمت|تحويل\\s+وارد(?:\\s+بمبلغ)?|تم\\s+تحويل|تم\\s+إيداع|ايداع\\s+بمبلغ|دفعة\\s+واردة(?:\\s+بمبلغ)?)\\s+" +
        "(?:مبلغ|بقيمة)?\\s*" +
        "([0-9]+(?:[\\.,][0-9]+)*)\\s*" +
        "(?:جنيه(?:ًا|ا)?|ج\\.م|جم|جنيه\\s+مصري|egp|le)?\\s*" +
        "(?:من|بواسطة|لحسابك\\s+من|عبر)\\s+" +
        "([^\\n\\r,;]+)",
        Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
    )

    private val directHandlePattern = Pattern.compile(
        "([a-z0-9_.\\-]+@[a-z0-9_.\\-]+)",
        Pattern.CASE_INSENSITIVE
    )

    private val egyptPhonePattern = Pattern.compile(
        "(?:\\+?20|0)?(1[0125][0-9]{8})"
    )

    private val referencePatterns = listOf(
        Pattern.compile("((?:IPAY|TXN|REF)[-_]?[A-Z0-9]{5,})", Pattern.CASE_INSENSITIVE),
        Pattern.compile("(?:الرقم\\s+المرجعي|رقم\\s+المرجع|رقم\\s+العملية|رقم\\s+المعاملة|مرجع|ref(?:erence)?|txn|trans(?:action)?\\s*id)[\\s:]+([A-Z0-9\\-_]{6,})", Pattern.CASE_INSENSITIVE)
    )

    fun parse(text: String): ParsedPayment? {
        val normalized = normalizeDigits(text).replace(Regex("\\s+"), " ").trim()
        val englishMatch = englishPattern.matcher(normalized).takeIf { it.find() }
        val arabicMatch = if (englishMatch == null) arabicPattern.matcher(normalized).takeIf { it.find() } else null
        val match = englishMatch ?: arabicMatch ?: return null

        val amountStr = match.group(1) ?: return null
        val amount = cleanNumber(amountStr)?.takeIf { it > 0.0 } ?: return null

        val rawSenderPart = match.group(2)?.trim() ?: return null

        // Extract reference
        var extractedRef: String? = null
        for (p in referencePatterns) {
            val rm = p.matcher(normalized)
            if (rm.find()) {
                extractedRef = rm.group(1)?.uppercase()?.trim()
                break
            }
        }

        // Clean sender part by removing known reference tokens
        var cleanSender = rawSenderPart
        if (extractedRef != null) {
            cleanSender = cleanSender.replace(extractedRef, "", ignoreCase = true)
        }
        cleanSender = cleanSender.replace(Regex("(?i)\\b(?:IPAY|TXN|REF)[-_]?[A-Z0-9]+\\b"), "")
            .replace(Regex("(?i)(?:الرقم\\s+المرجعي|رقم\\s+المرجع|رقم\\s+العملية|مرجع|ref(?:erence)?)[\\s:]*"), "")
            .replace(Regex("(?i)(?:بنجاح|successfully|via|عبر|لحسابك|في|in)\\b"), "")
            .trim()

        val handleMatch = directHandlePattern.matcher(cleanSender).takeIf { it.find() }
        val senderHandle = if (handleMatch != null) {
            handleMatch.group(1)?.lowercase() ?: "payer@instapay"
        } else {
            val phoneMatch = egyptPhonePattern.matcher(cleanSender).takeIf { it.find() }
            if (phoneMatch != null) {
                "0${phoneMatch.group(1)}@instapay"
            } else {
                val asciiLetters = cleanSender.filter { it.isLetterOrDigit() }.lowercase()
                if (asciiLetters.isNotBlank()) {
                    "$asciiLetters@instapay"
                } else {
                    val romanized = arabicToLatin(cleanSender)
                    if (romanized.isNotBlank()) "$romanized@instapay" else "payer@instapay"
                }
            }
        }

        return ParsedPayment(
            amountEgp = amount,
            senderHandle = senderHandle,
            reference = extractedRef,
            rawSender = rawSenderPart
        )
    }

    private fun cleanNumber(str: String): Double? {
        var s = str.trim()
        if (s.contains(",") && s.contains(".")) {
            s = s.replace(",", "")
        } else if (s.contains(",")) {
            val parts = s.split(",")
            s = if (parts.size == 2 && parts[1].length <= 2) {
                "${parts[0]}.${parts[1]}"
            } else {
                s.replace(",", "")
            }
        }
        return s.toDoubleOrNull()
    }

    private fun arabicToLatin(text: String): String = buildString {
        text.forEach { c ->
            when (c) {
                'ا', 'أ', 'إ', 'آ' -> append('a')
                'ب' -> append('b')
                'ت', 'ة' -> append('t')
                'ث' -> append("th")
                'ج' -> append('g')
                'ح', 'ه' -> append('h')
                'خ' -> append("kh")
                'د' -> append('d')
                'ذ' -> append("dh")
                'ر' -> append('r')
                'ز' -> append('z')
                'س' -> append('s')
                'ش' -> append("sh")
                'ص' -> append('s')
                'ض' -> append('d')
                'ط' -> append('t')
                'ظ' -> append('z')
                'ع' -> append('a')
                'غ' -> append("gh")
                'ف' -> append('f')
                'ق', 'ك' -> append('k')
                'ل' -> append('l')
                'م' -> append('m')
                'ن' -> append('n')
                'و' -> append('w')
                'ي', 'ى' -> append('y')
            }
        }
    }.take(20)

    fun eventId(packageName: String, postTime: Long, notificationKey: String): String {
        val source = "$packageName|$postTime|$notificationKey"
        return MessageDigest.getInstance("SHA-256").digest(source.toByteArray())
            .joinToString("") { "%02x".format(it) }
    }

    fun timestamp(postTime: Long): String = Instant.ofEpochMilli(postTime).toString()

    private fun normalizeDigits(value: String): String = buildString(value.length) {
        value.forEach { char ->
            append(when (char) {
                '٠' -> '0'; '١' -> '1'; '٢' -> '2'; '٣' -> '3'; '٤' -> '4'
                '٥' -> '5'; '٦' -> '6'; '٧' -> '7'; '٨' -> '8'; '٩' -> '9'
                '٫' -> '.'
                else -> char
            })
        }
    }
}
