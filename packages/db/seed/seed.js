/**
 * PowerBlind+ seed script.
 *
 * Loads:
 *   - data/powerblind_consumer_labels.csv  -> Consumer rows (ground truth)
 *   - data/powerblind_smartmeter_readings.csv -> Reading rows (~1.8M, streamed + batched)
 *   - creates a default Admin user (credentials printed to console, see .env.example)
 *
 * Run: npm run seed -w packages/db   (or `node seed/seed.js` from packages/db)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt');
const { getPrismaClient } = require('../index');

const prisma = getPrismaClient();

const DATA_DIR = path.resolve(__dirname, '../../../data');
const LABELS_CSV = path.join(DATA_DIR, 'powerblind_consumer_labels.csv');
const READINGS_CSV = path.join(DATA_DIR, 'powerblind_smartmeter_readings.csv');

const READING_BATCH_SIZE = 5000;

// --- tiny CSV line splitter -------------------------------------------------
// Dataset has no quoted/escaped commas in any field, so a plain split is safe
// and far faster than pulling in a full CSV parsing dependency for 1.8M rows.
function splitCsvLine(line) {
  return line.split(',');
}

function parseFloatOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function parseIntOrNull(v) {
  if (v === undefined || v === null || v === '' || v === 'nan' || v === 'NaN') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : Math.round(n);
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBool(v) {
  return v === 'True' || v === 'true' || v === '1';
}

async function seedAdminUser() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@powerblind.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`[seed] Admin user already exists (${adminEmail}), skipping creation.`);
    return;
  }

  // Generate a random dev password if not supplied via env, so we never hardcode one.
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ||
    'Pb+' + Math.random().toString(36).slice(2, 10) + '!9';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('\n========================================================');
  console.log('  PowerBlind+ default admin account created (DEV ONLY)');
  console.log('  email:    ', adminEmail);
  console.log('  password: ', adminPassword);
  console.log('  -> Change this password after first login.');
  console.log('  -> In production, this seed step must be disabled/');
  console.log('     replaced with a real account-provisioning flow.');
  console.log('========================================================\n');
}

async function seedConsumers() {
  console.log('[seed] Loading consumers from', LABELS_CSV);

  if (!fs.existsSync(LABELS_CSV)) {
    throw new Error(`Missing ${LABELS_CSV}. Place the dataset CSVs in /data first.`);
  }

  const fileStream = fs.createReadStream(LABELS_CSV);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  const consumers = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = splitCsvLine(line);
      continue;
    }
    const cols = splitCsvLine(line);
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i]]));

    consumers.push({
      id: row.consumer_id,
      consumerType: row.consumer_type,
      baseKwh: parseFloatOrNull(row.base_kwh),
      groundTruthLabel: row.label || null,
      groundTruthSubtype: row.anomaly_subtype && row.anomaly_subtype !== 'None' ? row.anomaly_subtype : null,
      anomalyStartDay: parseIntOrNull(row.anomaly_start_day),
      anomalyEndDay: parseIntOrNull(row.anomaly_end_day),
      anomalyStartDate: parseDateOrNull(row.anomaly_start_date),
      anomalyEndDate: parseDateOrNull(row.anomaly_end_date),
    });
  }

  console.log(`[seed] Parsed ${consumers.length} consumers, inserting...`);

  // createMany in chunks (SQLite has a bound-parameter limit per statement)
  const CHUNK = 500;
  for (let i = 0; i < consumers.length; i += CHUNK) {
    const chunk = consumers.slice(i, i + CHUNK);
    await prisma.consumer.createMany({ data: chunk });
  }

  console.log('[seed] Consumers inserted.');
  return consumers.length;
}

async function seedReadings() {
  console.log('[seed] Loading readings from', READINGS_CSV, '(this is the big one, ~1.8M rows)...');

  if (!fs.existsSync(READINGS_CSV)) {
    throw new Error(`Missing ${READINGS_CSV}. Place the dataset CSVs in /data first.`);
  }

  const fileStream = fs.createReadStream(READINGS_CSV);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  let batch = [];
  let total = 0;
  const startedAt = Date.now();

  const flush = async () => {
    if (batch.length === 0) return;
    await prisma.reading.createMany({ data: batch });
    total += batch.length;
    batch = [];
    if (total % 100000 === 0 || total < READING_BATCH_SIZE) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`[seed]   ...${total.toLocaleString()} readings inserted (${elapsedSec}s elapsed)`);
    }
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = splitCsvLine(line);
      continue;
    }
    const cols = splitCsvLine(line);
    const row = Object.fromEntries(header.map((h, i) => [h, cols[i]]));

    batch.push({
      consumerId: row.consumer_id,
      date: parseDateOrNull(row.date),
      kwh: parseFloatOrNull(row.kwh),
      voltageV: parseFloatOrNull(row.voltage_v),
      currentA: parseFloatOrNull(row.current_a),
      powerFactor: parseFloatOrNull(row.power_factor),
      commFlag: parseBool(row.comm_flag),
      label: row.label || null,
      anomalySubtype: row.anomaly_subtype && row.anomaly_subtype !== 'None' ? row.anomaly_subtype : null,
    });

    if (batch.length >= READING_BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  console.log(`[seed] Readings inserted: ${total.toLocaleString()} total.`);
  return total;
}

async function main() {
  console.log('=== PowerBlind+ database seed ===\n');

  const consumerCount = await prisma.consumer.count();
  if (consumerCount > 0) {
    console.log(`[seed] Database already has ${consumerCount} consumers.`);
    console.log('[seed] Run `npm run db:reset` first if you want a clean reload.');
  } else {
    await seedConsumers();
    await seedReadings();
  }

  await seedAdminUser();

  console.log('[seed] Done.');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[seed] FAILED:', err);
  await prisma.$disconnect();
  process.exit(1);
});
