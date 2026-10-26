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

    @Test fun ignoresUnrelatedText() {
        assertNull(InstaPayParser.parse("Your weekly account summary is ready"))
    }

    @Test fun eventIdIsStableAndNotificationSpecific() {
        assertEquals(InstaPayParser.eventId("pkg", 10, "key"), InstaPayParser.eventId("pkg", 10, "key"))
        assertNotEquals(InstaPayParser.eventId("pkg", 10, "key"), InstaPayParser.eventId("pkg", 11, "key"))
    }
}
