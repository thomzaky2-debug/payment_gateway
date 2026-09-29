import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

async function runPortalsAudit() {
  console.log('======================================================');
  console.log('🔬 Testing Merchant & Superadmin Web Portals Endpoints');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function check(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`✅ [${total}] ${name}: PASSED`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [${total}] ${name}: FAILED -`, err.response?.data || err.message);
    }
  }

  let adminToken = '';
  let merchantToken = '';
  let merchantApiKey = '';
  let testClientId = '';
  let testSessionId = '';

  // 1. Admin Authentication
  await check('Superadmin Authentication (/admin/auth)', async () => {
    const res = await axios.post(`${BASE_URL}/admin/auth`, {
      password: 'AdminPassword123!',
    });
    if (!res.data?.ok || !res.data?.token) throw new Error('Token not returned');
    adminToken = res.data.token;
  });

  // 2. Admin Session Check
  await check('Superadmin Session Verification (/admin/session)', async () => {
    const res = await axios.get(`${BASE_URL}/admin/session`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.data?.ok || !res.data?.authenticated) throw new Error('Session invalid');
  });

  // 3. Platform Overview KPI Stats
  await check('Platform Overview Stats (/admin/stats)', async () => {
    const res = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const s = res.data?.stats;
    if (!s || s.totalClients === undefined || s.totalVolumeEgp === undefined) {
      throw new Error('Stats structure missing');
    }
  });

  // 4. Admin Merchants Directory
  await check('List All Merchants (/admin/clients)', async () => {
    const res = await axios.get(`${BASE_URL}/admin/clients`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!Array.isArray(res.data?.clients) || res.data.clients.length === 0) {
      throw new Error('No merchants found');
    }
    testClientId = res.data.clients[0].id;
  });

  // 5. Admin Approve Merchant
  await check('Approve Merchant & Generate Keys (/admin/clients/:id/approve)', async () => {
    const res = await axios.post(
      `${BASE_URL}/admin/clients/${testClientId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (!res.data?.ok || res.data?.client?.approvalStatus !== 'APPROVED') {
      throw new Error('Approval failed');
    }
    if (!res.data.client.apiKey || !res.data.client.detectToken) {
      throw new Error('Keys not generated on approval');
    }
  });

  // 6. Admin Audit Logs
  await check('System Audit Trail (/admin/audit)', async () => {
    const res = await axios.get(`${BASE_URL}/admin/audit`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!Array.isArray(res.data?.logs) || res.data.logs.length === 0) {
      throw new Error('Audit logs empty');
    }
  });

  // 7. Merchant Login
  await check('Merchant Login (/auth/login)', async () => {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'merchant@localtest.com',
      password: 'MerchantPassword123!',
    });
    if (!res.data?.ok || !res.data?.token) throw new Error('Merchant login failed');
    merchantToken = res.data.token;
    merchantApiKey = res.data.client.apiKey;
  });

  // 8. Merchant Dashboard Stats
  await check('Merchant Dashboard Stats (/transactions/stats)', async () => {
    const res = await axios.get(`${BASE_URL}/transactions/stats`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    if (!res.data?.ok || !res.data?.stats) throw new Error('Merchant stats missing');
  });

  // 9. Merchant Checkout Creation
  await check('Merchant Checkout Creation (/v1/checkout/create)', async () => {
    const res = await axios.post(
      `${BASE_URL}/v1/checkout/create`,
      {
        amountEgp: 75.5,
        senderHandle: 'test_payer@instapay',
        note: 'Audit Check',
      },
      { headers: { Authorization: `Bearer ${merchantApiKey}` } }
    );
    if (!res.data?.ok || !res.data?.checkout?.sessionId) {
      throw new Error('Checkout creation failed');
    }
    testSessionId = res.data.checkout.sessionId;
  });

  // 10. Merchant Manual Review Resolution
  await check('Merchant Manual Confirm (/transactions/:sessionId/confirm)', async () => {
    const res = await axios.post(
      `${BASE_URL}/transactions/${testSessionId}/confirm`,
      {},
      { headers: { Authorization: `Bearer ${merchantToken}` } }
    );
    if (!res.data?.ok || res.data?.transaction?.status !== 'CONFIRMED') {
      throw new Error('Manual confirm failed');
    }
  });

  // 11. Merchant Settings Update with URL Handle Sync
  await check('Merchant Settings & Handle Sync (/settings)', async () => {
    const res = await axios.put(
      `${BASE_URL}/settings`,
      {
        instapayPaymentUrl: 'https://ipn.eg/S/cairo_hub_sync/instapay/new_token',
        checkoutTtlMin: 20,
      },
      { headers: { Authorization: `Bearer ${merchantToken}` } }
    );
    if (!res.data?.ok) throw new Error('Settings update failed');
    if (res.data.settings.instapayHandle !== 'cairo_hub_sync@instapay') {
      throw new Error(`Handle not synced: got ${res.data.settings.instapayHandle}`);
    }
  });

  // 12. Admin Force Confirm Transaction
  await check('Superadmin Force Confirm (/admin/transactions/:sessionId/confirm)', async () => {
    const res = await axios.post(
      `${BASE_URL}/admin/transactions/${testSessionId}/confirm`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (!res.data?.ok || res.data?.transaction?.status !== 'CONFIRMED') {
      throw new Error('Admin force confirm failed');
    }
  });

  console.log('\n======================================================');
  console.log(`Summary: ${passed}/${total} TESTS PASSED`);
  if (passed === total) {
    console.log('🎉 ALL MERCHANT AND ADMIN PORTAL TESTS PASSED PERFECTLY!');
  } else {
    console.log('⚠️ Some tests failed. Please review.');
  }
  console.log('======================================================\n');
}

runPortalsAudit().catch(console.error);
