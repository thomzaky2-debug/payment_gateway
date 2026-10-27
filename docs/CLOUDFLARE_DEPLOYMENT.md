# Cloudflare frontend builds

The `payment-gateway` Worker serves the Vite frontend in `dist`. It does not run
the Express API, Prisma, Socket.IO server, or background workers. Those remain
on the MonsterASP API host.

The failed build on 27 October 2026 compiled successfully but stopped at
`npx wrangler preview` because the Wrangler configuration lacked `previews`.
The root `wrangler.jsonc` now declares that block, the Worker name, and the
frontend asset directory with SPA routing.

Cloudflare Workers Builds settings:

- Root directory: repository root.
- Build command: `npm run client:build` (the existing `npm run build` also works).
- Production deploy command: `npx wrangler deploy`.
- Preview command: `npx wrangler preview`.
- Node version: 22.20.0 or the project's supported Node 22 version.

The preview command requires Wrangler with Preview support (the failed build
used 4.153.0). Do not replace it with a production deploy command for PRs.

For an interactive frontend deployment, set `VITE_API_BASE_URL` at build time
to the intended HTTPS API origin. The hostname fallback only recognizes the
existing MonsterASP domains. API CORS/origin configuration and cookie rules
must explicitly allow any new frontend origin; do not wildcard production
origins or weaken authentication just to enable preview login. Never put
database, SMTP, or API secrets in `VITE_*` variables.

Validate packaging without deploying using:

```sh
npm run client:build
npx wrangler deploy --dry-run
```

After pushing, check the new Cloudflare preview build. A successful local
dry run does not prove that Cloudflare credentials or dashboard settings are
valid. If production still runs `wrangler preview`, correct its deploy command
in the dashboard; this repository cannot change that dashboard setting.
