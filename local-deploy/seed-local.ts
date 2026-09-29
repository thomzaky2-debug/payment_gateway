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
    { name: 'FREE_TRIAL', priceEgp: 0, maxTransactions: 20 },
    { name: 'BASIC', priceEgp: 199, maxTransactions: 200 },
    { name: 'PRO', priceEgp: 499, maxTransactions: 1000 },
    { name: 'ENTERPRISE', priceEgp: 1299, maxTransactions: 10000 },
  ];

  for (const plan of plans) {
    await db.plan.upsert({
      where: { name: plan.name },
      update: { priceEgp: plan.priceEgp, maxTransactions: plan.maxTransactions },
      create: plan,
    });
  }
  console.log('✓ Seeded 4 subscription plans (FREE_TRIAL, BASIC, PRO, ENTERPRISE)');

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

  // 4. Seed Test Checkout Transaction
  const testSessionId = 'cmt_test_local_session';
  await db.transaction.upsert({
    where: { sessionId: testSessionId },
    update: {
      status: 'PENDING',
      amountEgp: 150.0,
      amountCents: 15000,
      senderHandle: 'ahmed_kamal@instapay',
      recipientHandle: 'mohammedshabana77@instapay',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  console.log(`✓ Seeded live test checkout session: ${testSessionId} (150.00 EGP)`);

  console.log('\n======================================================');
  console.log('🎉 Local database seeding completed successfully!');
  console.log('======================================================\n');
  process.exit(0);
}

seedLocal().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
