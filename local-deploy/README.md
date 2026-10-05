# Local Deployment & Pre-Cloud Testing Guide

This directory (`local-deploy/`) contains a complete, self-contained local deployment stack for the **InstaPay Payment Gateway**. It allows you to run, test, and verify the entire payment lifecycle locally—including an embedded PostgreSQL database, backend API, real-time WebSockets, merchant dashboard, superadmin portal, and hosted checkout pages—**before deploying onto a cloud server**.

---

## 🚀 Quick Start (One Command)

From the project root directory, run:

```bash
./local-deploy/start-local.sh
```

### What this command does automatically:

1. Loads the pre-configured local environment from `local-deploy/.env.local`.
2. Starts a persistent, embedded **PostgreSQL** instance on port `54329` (stored in `local-deploy/data/pg/`).
3. Runs `npx prisma db push` to synchronize all database tables and indexes.
4. Runs `local-deploy/seed-local.ts` to pre-seed subscription plans, superadmin, a test merchant, and a live demo checkout session.
5. Launches the **Express API + Socket.IO server** on `http://localhost:3001`.
6. Launches the **Vite React Frontend** on `http://localhost:3000`.

---

## 🌐 Local Access URLs & Pre-Seeded Credentials

Once started, open your browser to:

| Destination                      | Local URL                                            | Credentials / Notes                                                                     |
| :------------------------------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Customer Checkout Demo** | `http://localhost:3000/pay/cmt_test_local_session` | 150.00 EGP checkout with live timer & handle input                                      |
| **Merchant Portal**        | `http://localhost:3000/login`                      | **Email:** `merchant@localtest.com`**Password:** `MerchantPassword123!` |
| **Superadmin Portal**      | `http://localhost:3000/portal/admin`               | **Password:** `AdminPassword123!`                                               |
| **Backend REST API**       | `http://localhost:3001/api/health`                 | Service health & version status                                                         |

### Pre-Configured API & Detector Keys:

* **Merchant API Key:** `sk_test_cairo_hub_live_89412a`
* **Merchant Slug:** `cairo-hub` (Cairo Retail Hub)
* **InstaPay Handle:** `mohammedshabana77@instapay`
* **Companion Android Detector Token:** `dtk_test_cairo_hub_detector_99812`

---

## 🧪 Automated End-to-End System Verification

To run automated verification tests that exercise the full payment lifecycle on your local deployment:

1. Keep `./local-deploy/start-local.sh` running in one terminal.
2. In a second terminal, run:

```bash
npx tsx local-deploy/test-system.ts
```

### What the test suite verifies:

* [X] **[1/9]** Backend Health Check (`GET /api/health`)
* [X] **[2/9]** Superadmin Authentication (`POST /api/admin/auth`)
* [X] **[3/9]** Superadmin Metrics & Merchants summary
* [X] **[4/9]** Merchant Login & Session generation
* [X] **[5/9]** Programmatic Checkout Creation (`POST /api/v1/checkout/create` with API Key)
* [X] **[6/9]** Customer Hosted Checkout retrieval (`GET /api/checkout/:id`)
* [X] **[7/9]** Customer InstaPay Username Submission & Normalization (`PATCH /api/checkout/:id/sender`)
* [X] **[8/9]** Companion Android Detector Webhook Simulation (`POST /api/webhooks/detector`)
* [X] **[9/9]** Transaction State Transition to `CONFIRMED` with bank reference verification

---

## 📁 Directory Structure

```
local-deploy/
├── .env.local             # Local environment configuration
├── db-manager.mjs         # Embedded PostgreSQL server lifecycle controller
├── seed-local.ts          # Comprehensive local database seeder
├── start-local.sh         # One-command orchestration script
├── test-system.ts         # 9-step automated verification test suite
├── docker-compose.yml     # Optional Docker Compose stack (PostgreSQL + Adminer)
├── README.md              # This documentation
└── data/                  # Git-ignored local database storage & logs
    ├── pg/                # Embedded PostgreSQL database files
    ├── pg.log             # Database server logs
    ├── server.log         # Backend Express logs
    └── client.log         # Frontend Vite logs
```

---

## ☁️ Cloud Server Deployment Transition Checklist

When you are ready to deploy to a cloud server (e.g. Supabase, Render, Railway, DigitalOcean, AWS):

1. **Database:**
   * Create a PostgreSQL database on **Supabase**, **Render**, or **AWS RDS**.
   * Copy the connection string to `DATABASE_URL` and `DIRECT_URL`.
   * Run `npm run db:push` or apply Prisma migrations.
2. **Secrets:**
   * Generate secure 64-character random hex strings for `OWNER_SECRET` and `TOKEN_PEPPER` (`openssl rand -hex 32`).
   * Set a strong `ADMIN_PASSWORD`.
3. **Domain & URLs:**
   * Update `CLIENT_URL` to your production domain (e.g. `https://pay.yourdomain.com`).
   * Set `PORT=3001` or standard cloud port.
4. **Android Detector APK:**
   * Enter the production gateway URL and the merchant's detector token in the Android Companion APK settings.
