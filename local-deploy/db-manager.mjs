import embeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, 'data/pg');
const pidFile = path.resolve(__dirname, 'data/pg.pid');
const PORT = 54329;

function isPortOpen(port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: '127.0.0.1' }, () => {
      tester.end();
      resolve(true);
    });
    tester.on('error', () => {
      resolve(false);
    });
  });
}

async function startDb() {
  const isOpen = await isPortOpen(PORT);
  if (isOpen) {
    console.log(`[Local DB] PostgreSQL is already active and listening on port ${PORT}.`);
    return;
  }

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log(`[Local DB] Starting embedded PostgreSQL server on port ${PORT}...`);
  console.log(`[Local DB] Storage path: ${dataDir}`);

  const pg = new embeddedPostgres({
    port: PORT,
    databaseDir: dataDir,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (err) {
    // Might already be initialized
  }

  await pg.start();
  console.log(`[Local DB] ✓ PostgreSQL started successfully on port ${PORT}!`);
  fs.writeFileSync(pidFile, String(process.pid));

  const shutdown = async () => {
    console.log(`\n[Local DB] Stopping PostgreSQL gracefully...`);
    try {
      await pg.stop();
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      console.log(`[Local DB] ✓ PostgreSQL stopped.`);
    } catch (e) {
      console.error('[Local DB] Error stopping PostgreSQL:', e);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep process alive if called directly
  setInterval(() => {}, 1000 * 60 * 60);
}

const command = process.argv[2] || 'start';

if (command === 'start') {
  startDb().catch((err) => {
    console.error('[Local DB] Fatal startup error:', err);
    process.exit(1);
  });
} else if (command === 'status') {
  isPortOpen(PORT).then((open) => {
    if (open) {
      console.log(`[Local DB] PostgreSQL status: ONLINE (listening on port ${PORT})`);
      process.exit(0);
    } else {
      console.log(`[Local DB] PostgreSQL status: OFFLINE`);
      process.exit(1);
    }
  });
} else {
  console.log(`Usage: node local-deploy/db-manager.mjs [start|status]`);
}
