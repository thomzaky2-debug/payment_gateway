package com.nilepay.merchant

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CairoTimeTest {

    @Test
    fun `formats UTC ISO timestamp to Cairo GMT+2 accurately`() {
        // 12:00:00 UTC should be 14:00:00 (02:00 PM) in Cairo (GMT+2)
        val utcTimestamp = "2026-11-01T12:00:00.000Z"
        val card = CairoTime.formatCard(utcTimestamp)
        assertEquals("1 Nov, 02:00 PM", card)

        val detail = CairoTime.formatDetail(utcTimestamp)
        assertEquals("1 Nov 2026, 02:00:00 PM (GMT+2)", detail)
    }

    @Test
    fun `handles blank and null timestamps gracefully`() {
        assertEquals("—", CairoTime.formatCard(null))
        assertEquals("—", CairoTime.formatCard(""))
        assertEquals("—", CairoTime.formatDetail(null))
        assertEquals("—", CairoTime.formatDetail("   "))
    }

    @Test
    fun `handles timestamps without Z as UTC fallback`() {
        val raw = "2026-11-01 10:30:00"
        val card = CairoTime.formatCard(raw)
        // 10:30 UTC -> 12:30 PM Cairo
        assertEquals("1 Nov, 12:30 PM", card)
    }
}
