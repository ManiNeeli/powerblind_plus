/**
 * PowerBlind+ MongoDB Seeder
 * Populates MongoDB localhost (mongodb://127.0.0.1:27017/powerblind)
 * with Admin/Operator users, 5,000 consumers, smart meter readings, and model versions.
 * 
 * Viewable directly in MongoDB Compass at: mongodb://localhost:27017
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/powerblind';
const DB_NAME = process.env.MONGODB_DB_NAME || 'powerblind';
const DATA_DIR = path.resolve(__dirname, '../../../data');
const LABELS_CSV = path.join(DATA_DIR, 'powerblind_consumer_labels.csv');
const READINGS_CSV = path.join(DATA_DIR, 'powerblind_smartmeter_readings.csv');

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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

function parseBool(v) {
  return v === 'True' || v === 'true' || v === '1';
}

async function runSeed() {
  console.log('='.repeat(70));
  console.log(' POWERBLIND+ MONGODB POPULATION & COMPASS SETUP');
  console.log('='.repeat(70));
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  console.log(`Connected to database: ${DB_NAME}`);

  // 1. Create indexes
  console.log('[1] Creating collection indexes...');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('consumers').createIndex({ id: 1 }, { unique: true });
  await db.collection('consumers').createIndex({ groundTruthLabel: 1 });
  await db.collection('consumers').createIndex({ consumerType: 1 });
  await db.collection('readings').createIndex({ consumerId: 1, date: 1 }, { unique: true });
  await db.collection('readings').createIndex({ date: 1 });
  await db.collection('predictions').createIndex({ consumerId: 1, createdAt: -1 });
  await db.collection('predictions').createIndex({ predictedLabel: 1 });
  await db.collection('inspections').createIndex({ consumerId: 1 });
  await db.collection('inspections').createIndex({ status: 1 });
  await db.collection('audit_logs').createIndex({ createdAt: -1 });
  await db.collection('model_versions').createIndex({ version: 1 }, { unique: true });

  // 2. Seed Users
  console.log('[2] Seeding admin and operator accounts...');
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@powerblind.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';
  const adminHash = await bcrypt.hash(adminPass, 12);

  await db.collection('users').updateOne(
    { email: adminEmail },
    {
      $set: {
        id: 'usr_admin_001',
        email: adminEmail,
        passwordHash: adminHash,
        role: 'ADMIN',
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const opEmail = 'operator@powerblind.local';
  const opPass = 'Operator12345!';
  const opHash = await bcrypt.hash(opPass, 12);
  await db.collection('users').updateOne(
    { email: opEmail },
    {
      $set: {
        id: 'usr_operator_001',
        email: opEmail,
        passwordHash: opHash,
        role: 'OPERATOR',
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`    - Admin user: ${adminEmail} (Role: ADMIN)`);
  console.log(`    - Operator user: ${opEmail} (Role: OPERATOR)`);

  // 3. Seed Consumers
  console.log(`[3] Seeding consumers from ${path.basename(LABELS_CSV)}...`);
  const consumersCount = await db.collection('consumers').countDocuments();
  if (consumersCount >= 5000) {
    console.log(`    Consumers already seeded (${consumersCount} records found). Skipping.`);
  } else {
    const rlLabels = readline.createInterface({
      input: fs.createReadStream(LABELS_CSV),
      crlfDelay: Infinity,
    });

    const consumerDocs = [];
    let isFirst = true;

    for await (const line of rlLabels) {
      if (isFirst) { isFirst = false; continue; }
      if (!line.trim()) continue;
      const parts = line.split(',');
      const id = parts[0]?.trim();
      if (!id) continue;

      consumerDocs.push({
        id,
        consumerType: parts[1]?.trim() || 'residential_small',
        baseKwh: parseFloatOrNull(parts[2]),
        groundTruthLabel: parts[3]?.trim() || null,
        groundTruthSubtype: parts[4]?.trim() || null,
        anomalyStartDay: parseIntOrNull(parts[5]),
        anomalyEndDay: parseIntOrNull(parts[6]),
        anomalyStartDate: parseDateOrNull(parts[7]),
        anomalyEndDate: parseDateOrNull(parts[8]),
        createdAt: new Date(),
      });
    }

    if (consumerDocs.length > 0) {
      await db.collection('consumers').deleteMany({});
      const res = await db.collection('consumers').insertMany(consumerDocs, { ordered: false });
      console.log(`    Inserted ${res.insertedCount} consumer profiles into 'consumers' collection.`);
    }
  }

  // 4. Seed Model Versions
  console.log('[4] Seeding model version metrics...');
  const metricsPath = path.resolve(__dirname, '../../../services/ml/models/metrics_xgb-20260921-173356.json');
  let metricsJson = '{}';
  if (fs.existsSync(metricsPath)) {
    metricsJson = fs.readFileSync(metricsPath, 'utf8');
  }

  await db.collection('model_versions').updateOne(
    { version: 'xgb-20260921-173356' },
    {
      $set: {
        id: 'mdl_xgb_latest',
        version: 'xgb-20260921-173356',
        isActive: true,
        metricsJson,
        trainedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 5. Seed Smart Meter Readings (Sample batch or full)
  console.log(`[5] Checking smart meter readings in collection 'readings'...`);
  const readingsCount = await db.collection('readings').countDocuments();
  if (readingsCount >= 20000) {
    console.log(`    Readings collection already populated (${readingsCount} readings). Skipping.`);
  } else {
    console.log(`    Streaming readings from ${path.basename(READINGS_CSV)} into MongoDB...`);
    const rlReadings = readline.createInterface({
      input: fs.createReadStream(READINGS_CSV),
      crlfDelay: Infinity,
    });

    let batch = [];
    let isHeader = true;
    let totalInserted = 0;
    const TARGET_READINGS = 100000; // Seed 100,000 readings for instant local load

    for await (const line of rlReadings) {
      if (isHeader) { isHeader = false; continue; }
      if (!line.trim()) continue;
      const p = line.split(',');

      batch.push({
        consumerId: p[0]?.trim(),
        date: parseDateOrNull(p[1]),
        kwh: parseFloatOrNull(p[2]),
        voltageV: parseFloatOrNull(p[3]),
        currentA: parseFloatOrNull(p[4]),
        powerFactor: parseFloatOrNull(p[5]),
        commFlag: parseBool(p[6]),
        label: p[7]?.trim() || null,
        anomalySubtype: p[8]?.trim() || null,
      });

      if (batch.length >= 10000) {
        try {
          const r = await db.collection('readings').insertMany(batch, { ordered: false });
          totalInserted += r.insertedCount;
          process.stdout.write(`    Streamed ${totalInserted} readings into MongoDB...\r`);
        } catch (e) {
          totalInserted += (e.result?.nInserted || 0);
        }
        batch = [];
        if (totalInserted >= TARGET_READINGS) break;
      }
    }

    if (batch.length > 0) {
      try {
        const r = await db.collection('readings').insertMany(batch, { ordered: false });
        totalInserted += r.insertedCount;
      } catch (e) {
        totalInserted += (e.result?.nInserted || 0);
      }
    }
    console.log(`\n    Successfully populated ${totalInserted} readings in 'readings' collection.`);
  }

  // 6. Seed initial predictions and inspections for top anomalous consumers
  console.log('[6] Seeding initial predictions and inspections...');
  const anomalyConsumers = await db.collection('consumers').find(
    { groundTruthLabel: { $in: ['Theft', 'FaultyMeter', 'CommFailure'] } }
  ).limit(30).toArray();

  const predDocs = [];
  const inspDocs = [];
  for (let i = 0; i < anomalyConsumers.length; i++) {
    const c = anomalyConsumers[i];
    predDocs.push({
      id: 'pred_seed_' + (i + 1).toString().padStart(4, '0'),
      consumerId: c.id,
      predictedLabel: c.groundTruthLabel,
      predictedSubtype: c.groundTruthSubtype,
      confidence: +(0.88 + (i % 10) * 0.01).toFixed(3),
      topFeatures: JSON.stringify([
        { feature: 'baseline_deviation', importance: 0.34 },
        { feature: 'mean_power_factor', importance: 0.28 },
        { feature: 'kwh_trend_slope', importance: 0.22 }
      ]),
      recommendation: c.groundTruthLabel === 'Theft' ? 'Dispatch field inspection for bypass verification.' : 'Schedule meter calibration / diagnostic check.',
      modelVersion: 'xgb-20260921-173356',
      source: 'xgboost',
      createdAt: new Date(Date.now() - (i % 25) * 86400000),
    });

    if (i < 10) {
      inspDocs.push({
        id: 'insp_seed_' + (i + 1).toString().padStart(4, '0'),
        consumerId: c.id,
        operatorId: 'usr_operator_001',
        status: i % 3 === 0 ? 'CONFIRMED' : (i % 3 === 1 ? 'QUEUED' : 'FALSE_POSITIVE'),
        notes: `Initial triage inspection for ${c.id}: ${c.groundTruthLabel} anomaly signature verified.`,
        createdAt: new Date(Date.now() - (i % 7) * 86400000),
      });
    }
  }

  if (predDocs.length > 0) {
    await db.collection('predictions').deleteMany({ id: { $regex: '^pred_seed_' } });
    await db.collection('predictions').insertMany(predDocs, { ordered: false });
    console.log(`    Inserted ${predDocs.length} baseline predictions into 'predictions' collection.`);
  }

  if (inspDocs.length > 0) {
    await db.collection('inspections').deleteMany({ id: { $regex: '^insp_seed_' } });
    await db.collection('inspections').insertMany(inspDocs, { ordered: false });
    console.log(`    Inserted ${inspDocs.length} initial inspections into 'inspections' collection.`);
  }

  // 7. Seed initial audit log
  await db.collection('audit_logs').insertOne({
    id: 'aud_init_' + Date.now(),
    actorId: 'usr_admin_001',
    action: 'MONGODB_INITIALIZED',
    metadata: JSON.stringify({ database: DB_NAME, host: '127.0.0.1:27017' }),
    ip: '127.0.0.1',
    createdAt: new Date(),
  });

  console.log('\n' + '='.repeat(70));
  console.log(' MONGODB SETUP COMPLETE!');
  console.log(' Database Name: powerblind');
  console.log(' Connection URI: mongodb://127.0.0.1:27017/powerblind');
  console.log(' You can now open MongoDB Compass and connect to:');
  console.log('   mongodb://localhost:27017');
  console.log(' Collections available in Compass:');
  console.log('   - users');
  console.log('   - consumers (5,000 documents)');
  console.log('   - readings');
  console.log('   - predictions');
  console.log('   - inspections');
  console.log('   - audit_logs');
  console.log('   - model_versions');
  console.log('='.repeat(70));

  await client.close();
}

runSeed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
