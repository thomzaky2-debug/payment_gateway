package com.nilepay.merchant

import com.nilepay.merchant.detection.InstaPayParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InstaPayParserTest {
    @Test fun parsesKnownEnglishFormat() {
        val payment = InstaPayParser.parse("You have received 125.50 EGP from payer@instapay IPAY-ABC123")!!
        assertEquals(125.50, payment.amountEgp, 0.0)
        assertEquals("payer@instapay", payment.senderHandle)
        assertEquals("IPAY-ABC123", payment.reference)
    }

    @Test fun parsesEnglishWithCurrencyPrefix() {
        val payment = InstaPayParser.parse("You have received EGP 250.75 from customer@instapay TXN-789012")!!
        assertEquals(250.75, payment.amountEgp, 0.0)
        assertEquals("customer@instapay", payment.senderHandle)
        assertEquals("TXN-789012", payment.reference)
    }

    @Test fun parsesArabicStandardFormat() {
        val payment = InstaPayParser.parse("لقد استلمت 125.50 جنيهًا من payer@instapay IPAY-ABC123")!!
        assertEquals(125.50, payment.amountEgp, 0.0)
        assertEquals("payer@instapay", payment.senderHandle)
        assertEquals("IPAY-ABC123", payment.reference)
    }

    @Test fun parsesArabicWithEasternNumeralsAndComma() {
        val payment = InstaPayParser.parse("تم استلام مبلغ ١٢٥٫٥٠ ج.م من 01012345678 بنجاح. الرقم المرجعي: IPAY-654321")!!
        assertEquals(125.50, payment.amountEgp, 0.0)
        assertEquals("01012345678@instapay", payment.senderHandle)
        assertEquals("IPAY-654321", payment.reference)
    }

    @Test fun parsesTransferFromPersonName() {
        val payment = InstaPayParser.parse("تحويل وارد بمبلغ 500 ج.م من سارة علي مرجع: REF-998877")!!
        assertEquals(500.0, payment.amountEgp, 0.0)
        assertEquals("سارةعلي@instapay", payment.senderHandle)
        assertEquals("REF-998877", payment.reference)
    }

    @Test fun ignoresUnrelatedText() {
        assertNull(InstaPayParser.parse("Your weekly account summary is ready"))
        assertNull(InstaPayParser.parse("مرحبا بك في تطبيق البنك الأهلي المصري"))
    }

    @Test fun eventIdIsStableAndNotificationSpecific() {
        assertEquals(InstaPayParser.eventId("pkg", 10, "key"), InstaPayParser.eventId("pkg", 10, "key"))
        assertNotEquals(InstaPayParser.eventId("pkg", 10, "key"), InstaPayParser.eventId("pkg", 11, "key"))
    }
}
