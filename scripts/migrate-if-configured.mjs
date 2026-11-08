// Applies pending Prisma migrations during API builds (e.g. MonsterASP) so a
// deploy never ships code that expects columns the database does not have.
// Frontend-only builds (Cloudflare) have no database variables and skip it.
import { execSync } from 'node:child_process'

if (!process.env.DATABASE_URL) {
  console.log('[migrate] DATABASE_URL not set; skipping build-time migrations. For an API release, apply migrations separately before publishing.')
  process.exit(0)
}

console.log('[migrate] Applying pending Prisma migrations...')
execSync('npx prisma migrate deploy', { stdio: 'inherit' })

