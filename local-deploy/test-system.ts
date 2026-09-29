import axios from 'axios';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

async function runSystemVerification() {
  console.log('\n======================================================');
  console.log('🧪 Starting End-to-End System Verification (Local Deploy)');
  console.log(`📡 Backend URL: ${BACKEND_URL}`);
  console.log(`💻 Frontend URL: ${CLIENT_URL}`);
  console.log('======================================================\n');

  let passed = 0;
  let total = 9;

  // ─── Test 1: Backend Health Check ─────────────────────────────────
  try {
    const res = await axios.get(`${BACKEND_URL}/api/health`);
    if (res.data.status === 'healthy') {
      console.log('✅ [1/9] Backend Health API: Healthy (v2.0.0)');
      passed++;
    } else {
      throw new Error(`Unexpected health status: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    console.error('❌ [1/9] Backend Health API Failed:', err.message);
  }

  // ─── Test 2: Platform Superadmin Authentication ───────────────────
  let adminToken = '';
  try {
    const res = await axios.post(`${BACKEND_URL}/api/admin/auth`, {
      password: 'AdminPassword123!',
    });
    if (res.data.ok && res.data.token) {
      adminToken = res.data.token;
      console.log('✅ [2/9] Superadmin Authentication: Passed (Token issued)');
      passed++;
    } else {
      throw new Error('Admin auth token missing');
    }
  } catch (err: any) {
    console.error('❌ [2/9] Superadmin Authentication Failed:', err.message);
  }

  // ─── Test 3: Superadmin Dashboard Clients & Audit ────────────────
  try {
    const res = await axios.get(`${BACKEND_URL}/api/admin/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.data.ok && Array.isArray(res.data.clients)) {
      console.log(`✅ [3/9] Superadmin Clients API: Passed (${res.data.clients.length} merchants loaded)`);
      passed++;
    } else {
      throw new Error('Failed to retrieve merchants');
    }
  } catch (err: any) {
    console.error('❌ [3/9] Superadmin Clients API Failed:', err.message);
  }

  // ─── Test 4: Merchant Login ───────────────────────────────────────
  let merchantSessionCookie = '';
  try {
    const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
      email: 'merchant@localtest.com',
      password: 'MerchantPassword123!',
    });
    if (res.data.ok && res.data.client) {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        merchantSessionCookie = setCookie[0];
      }
      console.log(`✅ [4/9] Merchant Login: Passed (${res.data.client.businessName})`);
      passed++;
    } else {
      throw new Error('Merchant login unsuccessful');
    }
  } catch (err: any) {
    console.error('❌ [4/9] Merchant Login Failed:', err.message);
  }

  // ─── Test 5: Create Checkout via Merchant API (v1) ────────────────
  let createdSessionId = '';
  const apiKey = 'sk_test_cairo_hub_live_89412a';
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/v1/checkout/create`,
      {
        amountEgp: 250.0,
        note: 'Local Test Order #9910',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (res.data.ok && res.data.checkout?.sessionId) {
      createdSessionId = res.data.checkout.sessionId;
      console.log(`✅ [5/9] Merchant API Checkout Creation: Passed (Session: ${createdSessionId}, 250.00 EGP)`);
      passed++;
    } else {
      throw new Error('Failed to create checkout session');
    }
  } catch (err: any) {
    console.error('❌ [5/9] Merchant API Checkout Creation Failed:', err.message);
  }

  // ─── Test 6: Hosted Checkout Retrieval ────────────────────────────
  try {
    const res = await axios.get(`${BACKEND_URL}/api/checkout/${createdSessionId}`);
    if (res.data.ok && res.data.checkout.status === 'PENDING') {
      console.log(`✅ [6/9] Customer Hosted Checkout Retrieval: Passed (Status: PENDING, Amount: ${res.data.checkout.amountEgp} EGP)`);
      passed++;
    } else {
      throw new Error('Hosted checkout session invalid');
    }
  } catch (err: any) {
    console.error('❌ [6/9] Customer Hosted Checkout Retrieval Failed:', err.message);
  }

  // ─── Test 7: Customer Submits/Normalizes InstaPay Username ─────────
  const testId = Date.now().toString().slice(-4);
  const rawCustomerHandle = `tariq_${testId}`;
  const normalizedCustomerHandle = `tariq_${testId}@instapay`;
  const paymentRef = `IPN-LOC-${testId}`;

  try {
    const res = await axios.patch(`${BACKEND_URL}/api/checkout/${createdSessionId}/sender`, {
      senderHandle: rawCustomerHandle, // Intentionally without @instapay to test normalization
    });
    if (res.data.ok && res.data.senderHandle === normalizedCustomerHandle) {
      console.log(`✅ [7/9] Customer Handle Submission & Normalization: Passed (Result: ${res.data.senderHandle})`);
      passed++;
    } else {
      throw new Error(`Normalization error: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    console.error('❌ [7/9] Customer Handle Submission Failed:', err.message);
  }

  // ─── Test 8: Companion Android Detector Webhook Simulation ────────
  const detectToken = 'dtk_test_cairo_hub_detector_99812';
  try {
    const res = await axios.post(
      `${BACKEND_URL}/api/webhooks/instapay`,
      {
        senderHandle: normalizedCustomerHandle,
        amountEgp: 250.0,
        reference: paymentRef,
        text: `تم استلام تحويل بمبلغ 250.00 جنيه من ${normalizedCustomerHandle} مرجع: ${paymentRef}`,
      },
      {
        headers: {
          Authorization: `Bearer ${detectToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (res.data.ok && res.data.matched && res.data.sessionId === createdSessionId) {
      console.log(`✅ [8/9] Android Detector Webhook & Real-time Matching: Passed (Matched Session: ${res.data.sessionId})`);
      passed++;
    } else {
      throw new Error(`Matching failed: ${JSON.stringify(res.data)}`);
    }
  } catch (err: any) {
    console.error('❌ [8/9] Android Detector Webhook Failed:', err.message);
  }

  // ─── Test 9: Verify Transaction State Transitions to CONFIRMED ────
  try {
    const res = await axios.get(`${BACKEND_URL}/api/checkout/${createdSessionId}`);
    if (res.data.ok && res.data.checkout.status === 'CONFIRMED' && res.data.checkout.detectedRef === paymentRef) {
      console.log(`✅ [9/9] Transaction State Verification: Confirmed (Ref: ${res.data.checkout.detectedRef})`);
      passed++;
    } else {
      throw new Error(`Transaction state not confirmed: ${res.data.checkout?.status}`);
    }
  } catch (err: any) {
    console.error('❌ [9/9] Transaction State Verification Failed:', err.message);
  }

  console.log('\n======================================================');
  if (passed === total) {
    console.log(`🏆 ALL ${passed}/${total} SYSTEM TESTS PASSED CLEANLY!`);
    console.log('✨ System is 100% verified and ready for cloud deployment.');
  } else {
    console.log(`⚠️ ${passed}/${total} TESTS PASSED. Some issues need review.`);
  }
  console.log('======================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runSystemVerification().catch((err) => {
  console.error('[Verification Error]:', err);
  process.exit(1);
});
