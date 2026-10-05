#!/usr/bin/env bash

# =====================================================================
# Local Deployment & Pre-Cloud Testing Orchestrator
# =====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

export PATH="$HOME/.local/bin:$PATH"

echo "======================================================"
echo "🚀 InstaPay Payment Gateway — Local Deployment Setup"
echo "======================================================"

# 1. Load Local Environment
if [ ! -f "$SCRIPT_DIR/.env.local" ] && [ -f "$SCRIPT_DIR/.env.local.example" ]; then
  echo "📄 Creating local-deploy/.env.local from example template..."
  cp "$SCRIPT_DIR/.env.local.example" "$SCRIPT_DIR/.env.local"
fi

if [ -f "$SCRIPT_DIR/.env.local" ]; then
  echo "📄 Loading environment from local-deploy/.env.local..."
  set -a
  source "$SCRIPT_DIR/.env.local"
  set +a
fi

# These escape hatches are intentionally scoped to this local orchestrator.
export AUTH_ALLOW_DEV_BYPASS=true
export AUTH_EXPOSE_DEV_OTP=true

# Ensure data directory exists
mkdir -p "$SCRIPT_DIR/data"

# 2. Start Local Embedded PostgreSQL Server
echo "🐘 Starting local PostgreSQL engine (port 54329)..."
node "$SCRIPT_DIR/db-manager.mjs" start > "$SCRIPT_DIR/data/pg.log" 2>&1 &
PG_PID=$!

cleanup() {
  echo ""
  echo "🛑 Shutting down local deployment..."
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -n "$CLIENT_PID" ] && kill -0 "$CLIENT_PID" 2>/dev/null; then
    kill "$CLIENT_PID" 2>/dev/null || true
  fi
  if [ -n "$PG_PID" ] && kill -0 "$PG_PID" 2>/dev/null; then
    kill "$PG_PID" 2>/dev/null || true
  fi
  echo "✓ All local processes stopped cleanly."
  exit 0
}

trap cleanup INT TERM EXIT

# Wait for PostgreSQL port to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
RETRIES=30
until node -e "
const net = require('net');
const client = net.createConnection({ port: 54329, host: '127.0.0.1' }, () => {
  client.end();
  process.exit(0);
});
client.on('error', () => process.exit(1));
" 2>/dev/null; do
  sleep 0.5
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "❌ Failed to connect to local PostgreSQL within 15 seconds."
    cat "$SCRIPT_DIR/data/pg.log"
    exit 1
  fi
done

echo "✓ PostgreSQL is online and accepting connections!"

# 3. Synchronize Prisma Database Schema
echo "🔄 Synchronizing database tables with Prisma..."
npx prisma db push --skip-generate

# 4. Seed Local Database
echo "🌱 Seeding local database..."
npx tsx "$SCRIPT_DIR/seed-local.ts"

# 5. Start Backend Express API & Socket.IO
echo "⚡ Starting backend API server on port 3001..."
npx tsx watch server/src/index.ts > "$SCRIPT_DIR/data/server.log" 2>&1 &
SERVER_PID=$!

# Wait for backend health endpoint
echo "⏳ Waiting for backend API to be ready..."
RETRIES=20
until curl -s http://localhost:3001/api/health > /dev/null 2>&1; do
  sleep 0.5
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "❌ Failed to connect to backend server within 10 seconds."
    cat "$SCRIPT_DIR/data/server.log"
    exit 1
  fi
done

echo "✓ Backend API & Real-time Socket.IO is online!"

# 6. Start Frontend Web Client
echo "🌐 Starting Vite Web Frontend on port 3000..."
npx vite --port 3000 --host 0.0.0.0 > "$SCRIPT_DIR/data/client.log" 2>&1 &
CLIENT_PID=$!

sleep 1

echo ""
echo "======================================================"
echo "🎉 LOCAL DEPLOYMENT IS READY & RUNNING!"
echo "======================================================"
echo ""
echo "📱 Local Web App & Dashboards:"
echo "   • Customer Checkout Demo: http://localhost:3000/pay/cmt_test_local_session"
echo "   • Merchant Portal:        http://localhost:3000/login"
echo "   • Backend API Health:     http://localhost:3001/api/health"
echo ""
echo "🔑 Pre-seeded Credentials:"
echo "   • Merchant Login:         merchant@localtest.com / MerchantPassword123!"
echo "   • Superadmin Password:    AdminPassword123!"
echo "   • Merchant API Key:       sk_test_cairo_hub_live_89412a"
echo "   • Android Detector Token: dtk_test_cairo_hub_detector_99812"
echo ""
echo "🧪 To run end-to-end automated verification, open a terminal and run:"
echo "   npx tsx local-deploy/test-system.ts"
echo ""
echo "Press Ctrl+C at any time to gracefully stop all services."
echo "======================================================"
echo ""

# Keep running
wait $SERVER_PID $CLIENT_PID
