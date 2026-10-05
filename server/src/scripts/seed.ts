import { db } from '../db.js'

async function seed() {
  console.log('Seeding default subscription plans...')

  const plans = [
    { name: 'FREE_TRIAL', priceEgp: 0, maxTransactions: 20 },
    { name: 'BASIC', priceEgp: 199, maxTransactions: 200 },
    { name: 'PRO', priceEgp: 499, maxTransactions: 1000 },
    { name: 'ENTERPRISE', priceEgp: 1299, maxTransactions: 10000 },
  ]

  for (const plan of plans) {
    await db.plan.upsert({
      where: { name: plan.name },
      update: {
        priceEgp: plan.priceEgp,
        maxTransactions: plan.maxTransactions,
      },
      create: plan,
    })
    console.log(`✓ Seeded plan: ${plan.name} (${plan.priceEgp} EGP, max ${plan.maxTransactions} tx)`)
  }

  // ─── Seed Top-Up Bundles ─────────────────────────────────────────
  console.log('\nSeeding top-up bundles...')

  const bundles = [
    { name: 'STARTER_PACK', displayName: 'Starter Pack', priceEgp: 49, extraTx: 50, sortOrder: 1, description: 'Quick top-up for light usage spikes' },
    { name: 'GROWTH_PACK', displayName: 'Growth Pack', priceEgp: 99, extraTx: 150, sortOrder: 2, description: 'Best value for growing businesses' },
    { name: 'MEGA_PACK', displayName: 'Mega Pack', priceEgp: 179, extraTx: 350, sortOrder: 3, description: 'Maximum extra capacity at the lowest rate per transaction' },
  ]

  for (const bundle of bundles) {
    await (db as any).topUpBundle.upsert({
      where: { name: bundle.name },
      update: {
        displayName: bundle.displayName,
        priceEgp: bundle.priceEgp,
        extraTx: bundle.extraTx,
        sortOrder: bundle.sortOrder,
        description: bundle.description,
      },
      create: bundle,
    })
    console.log(`✓ Seeded bundle: ${bundle.displayName} (${bundle.priceEgp} EGP, +${bundle.extraTx} tx)`)
  }

  console.log('\nSeeding completed successfully!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
