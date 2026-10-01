import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

import { db } from '../server/src/db.js';
import { hashPassword, hashToken } from '../server/src/services/authService.js';

async function seedLocal() {
  console.log('🌱 Seeding local database for testing and verification...');

  // 1. Seed Subscription Plans
  const plans = [
    {
      name: 'FREE_TRIAL',
      priceEgp: 0,
      maxTransactions: 50,
      periodDays: 14,
      description: '14-Day introductory free trial with live InstaPay detection and 50 transactions',
      isActive: true,
    },
    {
      name: 'BASIC',
      priceEgp: 199,
      maxTransactions: 200,
      periodDays: 30,
      description: 'Essential tier for small stores and emerging merchants',
      isActive: true,
    },
    {
      name: 'PLUS',
      priceEgp: 349,
      maxTransactions: 600,
      periodDays: 30,
      description: 'Enhanced performance and higher transaction volume for expanding businesses',
      isActive: true,
    },
    {
      name: 'PRO',
      priceEgp: 599,
      maxTransactions: 2000,
      periodDays: 30,
      description: 'Most popular growth tier with high priority matching and webhooks',
      isActive: true,
    },
    {
      name: 'ENTERPRISE',
      priceEgp: 0,
      maxTransactions: 10000,
      periodDays: 30,
      description: 'Tailored scale, custom limits, dedicated SLA, and 24/7 VIP customer service support',
      isActive: true,
    },
  ];

  for (const plan of plans) {
    await db.plan.upsert({
      where: { name: plan.name },
      update: {
        priceEgp: plan.priceEgp,
        maxTransactions: plan.maxTransactions,
        periodDays: plan.periodDays,
        description: plan.description,
        isActive: plan.isActive,
      },
      create: plan,
    });
  }
  console.log('✓ Seeded 5 subscription plans (FREE_TRIAL, BASIC, PLUS, PRO, ENTERPRISE)');

  // 2. Seed Superadmin Owner
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@paymentgateway.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const adminPasswordHash = hashPassword(adminPassword);

  await db.owner.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash, name: 'System Superadmin' },
    create: {
      email: adminEmail,
      name: 'System Superadmin',
      passwordHash: adminPasswordHash,
      dstMode: 'AUTO',
    },
  });
  console.log(`✓ Seeded superadmin owner (${adminEmail})`);

  // 3. Seed Pre-approved Merchant Account
  const merchantEmail = 'merchant@localtest.com';
  const merchantPassword = 'MerchantPassword123!';
  const apiKey = 'sk_test_cairo_hub_live_89412a';
  const detectToken = 'dtk_test_cairo_hub_detector_99812';

  const merchant = await db.client.upsert({
    where: { email: merchantEmail },
    update: {
      businessName: 'Cairo Retail Hub',
      passwordHash: hashPassword(merchantPassword),
      slug: 'cairo-hub',
      instapayHandle: 'mohammedshabana77@instapay',
      instapayPaymentUrl: 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      approvalStatus: 'APPROVED',
      isActive: true,
      apiKey,
      apiKeyHash: hashToken(apiKey),
      detectToken,
      detectTokenHash: hashToken(detectToken),
      subscriptionPlan: 'PRO',
      txLimit: 1000,
      checkoutTtlMin: 15,
    },
    create: {
      id: 'client_local_cairo_hub',
      email: merchantEmail,
      firstName: 'Mohammed',
      lastName: 'Shabana',
      passwordHash: hashPassword(merchantPassword),
      businessName: 'Cairo Retail Hub',
      businessType: 'Retail & Electronics',
      slug: 'cairo-hub',
      instapayHandle: 'mohammedshabana77@instapay',
      instapayPaymentUrl: 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      approvalStatus: 'APPROVED',
      isActive: true,
      apiKey,
      apiKeyHash: hashToken(apiKey),
      detectToken,
      detectTokenHash: hashToken(detectToken),
      subscriptionPlan: 'PRO',
      txLimit: 1000,
      checkoutTtlMin: 15,
    },
  });
  console.log(`✓ Seeded test approved merchant: ${merchant.businessName} (${merchant.email})`);

  // 4. Seed Test Checkout Transaction (using merchant's configured checkoutTtlMin)
  const testSessionId = 'cmt_test_local_session';
  const ttlMin = merchant.checkoutTtlMin || 15;
  const testExpiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

  await db.transaction.upsert({
    where: { sessionId: testSessionId },
    update: {
      status: 'PENDING',
      amountEgp: 150.0,
      amountCents: 15000,
      senderHandle: 'ahmed_kamal@instapay',
      recipientHandle: 'mohammedshabana77@instapay',
      expiresAt: testExpiresAt,
    },
    create: {
      sessionId: testSessionId,
      clientId: merchant.id,
      amountEgp: 150.0,
      amountCents: 15000,
      currency: 'EGP',
      status: 'PENDING',
      senderHandle: 'ahmed_kamal@instapay',
      recipientHandle: 'mohammedshabana77@instapay',
      note: 'Order #4819 • Express Delivery',
      deepLinkUrl: 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'test_token_token_123',
      expiresAt: testExpiresAt,
    },
  });
  console.log(`✓ Seeded live test checkout session: ${testSessionId} (150.00 EGP)`);

  // 5. Seed Manual Review Queue Items — All Anomaly & Review Cases

  // Case 1: Underpaid Checkouts
  const underpaid1SessionId = 'cmt_rev_underpaid_101';
  await db.transaction.upsert({
    where: { sessionId: underpaid1SessionId },
    update: {
      status: 'UNDERPAID',
      amountEgp: 350.0,
      detectedAmountEgp: 300.0,
      senderHandle: 'hassan_elmasry@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-REV-88210',
      note: 'Sneakers Order #8821',
    },
    create: {
      sessionId: underpaid1SessionId,
      clientId: merchant.id,
      amountEgp: 350.0,
      amountCents: 35000,
      detectedAmountEgp: 300.0,
      detectedAmountCents: 30000,
      detectedRef: 'IPN-REV-88210',
      detectedAt: new Date(Date.now() - 15 * 60 * 1000),
      currency: 'EGP',
      status: 'UNDERPAID',
      senderHandle: 'hassan_elmasry@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Sneakers Order #8821',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_101',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const underpaid2SessionId = 'cmt_rev_underpaid_102';
  await db.transaction.upsert({
    where: { sessionId: underpaid2SessionId },
    update: {
      status: 'UNDERPAID',
      amountEgp: 500.0,
      detectedAmountEgp: 450.0,
      senderHandle: 'nour_rashad@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-REV-99124',
      note: 'Annual Gym Membership',
    },
    create: {
      sessionId: underpaid2SessionId,
      clientId: merchant.id,
      amountEgp: 500.0,
      amountCents: 50000,
      detectedAmountEgp: 450.0,
      detectedAmountCents: 45000,
      detectedRef: 'IPN-REV-99124',
      detectedAt: new Date(Date.now() - 40 * 60 * 1000),
      currency: 'EGP',
      status: 'UNDERPAID',
      senderHandle: 'nour_rashad@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Annual Gym Membership',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_102',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Case 2: Overpaid Checkouts (Excess transferred)
  const overpaid1SessionId = 'cmt_rev_overpaid_201';
  await db.transaction.upsert({
    where: { sessionId: overpaid1SessionId },
    update: {
      status: 'OVERPAID',
      amountEgp: 250.0,
      detectedAmountEgp: 300.0,
      senderHandle: 'tamer_kamal@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-OVR-2019',
      note: 'Artisan Coffee Beans',
    },
    create: {
      sessionId: overpaid1SessionId,
      clientId: merchant.id,
      amountEgp: 250.0,
      amountCents: 25000,
      detectedAmountEgp: 300.0,
      detectedAmountCents: 30000,
      detectedRef: 'IPN-OVR-2019',
      detectedAt: new Date(Date.now() - 30 * 60 * 1000),
      currency: 'EGP',
      status: 'OVERPAID',
      senderHandle: 'tamer_kamal@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Artisan Coffee Beans',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_201',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const overpaid2SessionId = 'cmt_rev_overpaid_202';
  await db.transaction.upsert({
    where: { sessionId: overpaid2SessionId },
    update: {
      status: 'OVERPAID',
      amountEgp: 600.0,
      detectedAmountEgp: 750.0,
      senderHandle: 'sara_hegazi@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-OVR-7512',
      note: 'Custom Leather Backpack',
    },
    create: {
      sessionId: overpaid2SessionId,
      clientId: merchant.id,
      amountEgp: 600.0,
      amountCents: 60000,
      detectedAmountEgp: 750.0,
      detectedAmountCents: 75000,
      detectedRef: 'IPN-OVR-7512',
      detectedAt: new Date(Date.now() - 50 * 60 * 1000),
      currency: 'EGP',
      status: 'OVERPAID',
      senderHandle: 'sara_hegazi@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Custom Leather Backpack',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_202',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Case 3: Late / Expired Session Payments
  const late1SessionId = 'cmt_rev_late_301';
  await db.transaction.upsert({
    where: { sessionId: late1SessionId },
    update: {
      status: 'LATE_PAYMENT',
      amountEgp: 400.0,
      detectedAmountEgp: 400.0,
      senderHandle: 'mahmoud_saad@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-LTE-3011',
      note: 'Gaming Headset Order #9140',
    },
    create: {
      sessionId: late1SessionId,
      clientId: merchant.id,
      amountEgp: 400.0,
      amountCents: 40000,
      detectedAmountEgp: 400.0,
      detectedAmountCents: 40000,
      detectedRef: 'IPN-LTE-3011',
      detectedAt: new Date(Date.now() - 22 * 60 * 1000),
      currency: 'EGP',
      status: 'LATE_PAYMENT',
      senderHandle: 'mahmoud_saad@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Gaming Headset Order #9140',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_301',
      expiresAt: new Date(Date.now() - 25 * 60 * 1000), // Expired before transfer
    },
  });

  const late2SessionId = 'cmt_rev_late_302';
  await db.transaction.upsert({
    where: { sessionId: late2SessionId },
    update: {
      status: 'LATE_PAYMENT',
      amountEgp: 175.0,
      detectedAmountEgp: 175.0,
      senderHandle: 'aya_khalil@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-LTE-4022',
      note: 'English Novel Set',
    },
    create: {
      sessionId: late2SessionId,
      clientId: merchant.id,
      amountEgp: 175.0,
      amountCents: 17500,
      detectedAmountEgp: 175.0,
      detectedAmountCents: 17500,
      detectedRef: 'IPN-LTE-4022',
      detectedAt: new Date(Date.now() - 14 * 60 * 1000),
      currency: 'EGP',
      status: 'LATE_PAYMENT',
      senderHandle: 'aya_khalil@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'English Novel Set',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_302',
      expiresAt: new Date(Date.now() - 20 * 60 * 1000),
    },
  });

  // Case 4: Sender Handle Discrepancy (Third-Party Payer)
  const mismatch1SessionId = 'cmt_rev_mismatch_401';
  await db.transaction.upsert({
    where: { sessionId: mismatch1SessionId },
    update: {
      status: 'HANDLE_MISMATCH',
      amountEgp: 220.0,
      detectedAmountEgp: 220.0,
      senderHandle: 'fawzy_parent_acc@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-SND-4018',
      note: 'Prescription Glasses (Expected: kareem_fawzy@instapay)',
    },
    create: {
      sessionId: mismatch1SessionId,
      clientId: merchant.id,
      amountEgp: 220.0,
      amountCents: 22000,
      detectedAmountEgp: 220.0,
      detectedAmountCents: 22000,
      detectedRef: 'IPN-SND-4018',
      detectedAt: new Date(Date.now() - 35 * 60 * 1000),
      currency: 'EGP',
      status: 'HANDLE_MISMATCH',
      senderHandle: 'fawzy_parent_acc@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Prescription Glasses (Expected: kareem_fawzy@instapay)',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_401',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const mismatch2SessionId = 'cmt_rev_mismatch_402';
  await db.transaction.upsert({
    where: { sessionId: mismatch2SessionId },
    update: {
      status: 'HANDLE_MISMATCH',
      amountEgp: 850.0,
      detectedAmountEgp: 850.0,
      senderHandle: 'boutique_finance@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-SND-8501',
      note: 'Wholesale Silk Scarves (Expected: mariam_boutique@instapay)',
    },
    create: {
      sessionId: mismatch2SessionId,
      clientId: merchant.id,
      amountEgp: 850.0,
      amountCents: 85000,
      detectedAmountEgp: 850.0,
      detectedAmountCents: 85000,
      detectedRef: 'IPN-SND-8501',
      detectedAt: new Date(Date.now() - 55 * 60 * 1000),
      currency: 'EGP',
      status: 'HANDLE_MISMATCH',
      senderHandle: 'boutique_finance@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Wholesale Silk Scarves (Expected: mariam_boutique@instapay)',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_402',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Case 5: Suspected Duplicate Payments
  const dup1SessionId = 'cmt_rev_dup_501';
  await db.transaction.upsert({
    where: { sessionId: dup1SessionId },
    update: {
      status: 'DUPLICATE_SUSPECT',
      amountEgp: 320.0,
      detectedAmountEgp: 320.0,
      senderHandle: 'adel_nabil@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-DUP-5011',
      note: 'Wireless Earbuds Order #6612 (Duplicate transfer 3m apart)',
    },
    create: {
      sessionId: dup1SessionId,
      clientId: merchant.id,
      amountEgp: 320.0,
      amountCents: 32000,
      detectedAmountEgp: 320.0,
      detectedAmountCents: 32000,
      detectedRef: 'IPN-DUP-5011',
      detectedAt: new Date(Date.now() - 18 * 60 * 1000),
      currency: 'EGP',
      status: 'DUPLICATE_SUSPECT',
      senderHandle: 'adel_nabil@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Wireless Earbuds Order #6612 (Duplicate transfer 3m apart)',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_501',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Case 6: High-Value / Risk Velocity Flag
  const risk1SessionId = 'cmt_rev_risk_601';
  await db.transaction.upsert({
    where: { sessionId: risk1SessionId },
    update: {
      status: 'HIGH_VALUE_REVIEW',
      amountEgp: 12500.0,
      detectedAmountEgp: 12500.0,
      senderHandle: 'delta_trading_co@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      detectedRef: 'IPN-RSK-6019',
      note: 'Commercial Espresso Machine Parts (Flagged for risk clearance)',
    },
    create: {
      sessionId: risk1SessionId,
      clientId: merchant.id,
      amountEgp: 12500.0,
      amountCents: 1250000,
      detectedAmountEgp: 12500.0,
      detectedAmountCents: 1250000,
      detectedRef: 'IPN-RSK-6019',
      detectedAt: new Date(Date.now() - 45 * 60 * 1000),
      currency: 'EGP',
      status: 'HIGH_VALUE_REVIEW',
      senderHandle: 'delta_trading_co@instapay',
      recipientHandle: merchant.instapayHandle || 'mohammedshabana77@instapay',
      note: 'Commercial Espresso Machine Parts (Flagged for risk clearance)',
      deepLinkUrl: merchant.instapayPaymentUrl || 'https://ipn.eg/S/mohammedshabana77/instapay/test',
      deepLinkToken: 'rev_token_601',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // Case 7: Unmatched Direct Transfers
  const existingMismatched = await db.mismatchedPayment.findFirst({
    where: { clientId: merchant.id, senderHandle: 'omar_tanta77@instapay' },
  });
  if (!existingMismatched) {
    await db.mismatchedPayment.create({
      data: {
        clientId: merchant.id,
        senderHandle: 'omar_tanta77@instapay',
        amountEgp: 180.0,
        amountCents: 18000,
        reference: 'IPN-MIS-41901',
        status: 'UNMATCHED',
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
      },
    });
  }

  const existingMismatched2 = await db.mismatchedPayment.findFirst({
    where: { clientId: merchant.id, senderHandle: 'fatma_alex99@instapay' },
  });
  if (!existingMismatched2) {
    await db.mismatchedPayment.create({
      data: {
        clientId: merchant.id,
        senderHandle: 'fatma_alex99@instapay',
        amountEgp: 420.0,
        amountCents: 42000,
        reference: 'IPN-MIS-73205',
        status: 'UNMATCHED',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
  }

  const existingMismatched3 = await db.mismatchedPayment.findFirst({
    where: { clientId: merchant.id, senderHandle: 'khaled_mansour@instapay' },
  });
  if (!existingMismatched3) {
    await db.mismatchedPayment.create({
      data: {
        clientId: merchant.id,
        senderHandle: 'khaled_mansour@instapay',
        amountEgp: 950.0,
        amountCents: 95000,
        reference: 'IPN-MIS-95023',
        status: 'UNMATCHED',
        createdAt: new Date(Date.now() - 85 * 60 * 1000),
      },
    });
  }
  console.log('✓ Seeded Manual Review Queue: All 7 Anomaly Cases (Underpaid, Overpaid, Late, Handle Mismatch, Duplicate Suspect, High-Value Risk, and Unmatched)');

  console.log('\n======================================================');
  console.log('🎉 Local database seeding completed successfully!');
  console.log('======================================================\n');
  process.exit(0);
}

seedLocal().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
