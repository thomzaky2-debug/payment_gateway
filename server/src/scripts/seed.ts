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

  console.log('Seeding completed successfully!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
