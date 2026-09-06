/**
 * Consumer + prediction route tests — Phase 2
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL       = 'file:./test.db';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

const request = require('supertest');
const bcrypt  = require('bcrypt');
const app     = require('../src/app');
const { getPrismaClient } = require('@powerblind/db');
const prisma = getPrismaClient();

let accessToken;
const TEST_EMAIL = 'consumer-test@powerblind.test';

beforeAll(async () => {
  // Seed operator + one consumer + some readings
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const hash = await bcrypt.hash('TestPass123!', 12);
  await prisma.user.create({ data: { email: TEST_EMAIL, passwordHash: hash, role: 'OPERATOR' } });

  await prisma.consumer.upsert({
    where:  { id: 'T00001' },
    update: {},
    create: {
      id: 'T00001', consumerType: 'residential_small',
      groundTruthLabel: 'Theft', groundTruthSubtype: 'T1_PartialReduction',
      baseKwh: 12.5,
    },
  });

  // Seed 10 readings
  const readings = Array.from({ length: 10 }, (_, i) => ({
    consumerId:  'T00001',
    date:        new Date(`2023-01-${String(i + 1).padStart(2, '0')}`),
    kwh:         10 + i * 0.5,
    voltageV:    230 + i * 0.1,
    currentA:    2.1,
    powerFactor: 0.92,
    commFlag:    false,
    label:       'Theft',
    anomalySubtype: 'T1_PartialReduction',
  }));
  for (const r of readings) {
    await prisma.reading.upsert({
      where:  { consumerId_date: { consumerId: r.consumerId, date: r.date } },
      update: {},
      create: r,
    });
  }

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_EMAIL, password: 'TestPass123!' });
  accessToken = loginRes.body.accessToken;
});

afterAll(async () => {
  await prisma.reading.deleteMany({ where: { consumerId: 'T00001' } });
  await prisma.prediction.deleteMany({ where: { consumerId: 'T00001' } });
  await prisma.inspection.deleteMany({ where: { consumerId: 'T00001' } });
  await prisma.consumer.deleteMany({ where: { id: 'T00001' } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe('GET /api/consumers', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/consumers');
    expect(res.status).toBe(401);
  });

  it('returns paginated consumer list', async () => {
    const res = await request(app)
      .get('/api/consumers?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.consumers)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.page).toBe(1);
  });

  it('filters by label', async () => {
    const res = await request(app)
      .get('/api/consumers?label=Theft&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    res.body.consumers.forEach(c => expect(c.groundTruthLabel).toBe('Theft'));
  });

  it('filters by search (consumer ID)', async () => {
    const res = await request(app)
      .get('/api/consumers?search=T00001')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.consumers.some(c => c.id === 'T00001')).toBe(true);
  });
});

describe('GET /api/consumers/:id', () => {
  it('returns consumer detail', async () => {
    const res = await request(app)
      .get('/api/consumers/T00001')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('T00001');
    expect(res.body.groundTruthLabel).toBe('Theft');
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('returns 404 for unknown consumer', async () => {
    const res = await request(app)
      .get('/api/consumers/DOESNOTEXIST')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/consumers/:id/timeseries', () => {
  it('returns readings array', async () => {
    const res = await request(app)
      .get('/api/consumers/T00001/timeseries')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.readings)).toBe(true);
    expect(res.body.readings.length).toBeGreaterThan(0);
    // Dates are formatted as YYYY-MM-DD strings
    expect(typeof res.body.readings[0].date).toBe('string');
    expect(res.body.readings[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('GET /api/dashboard/summary', () => {
  it('returns counts, topRisk, trend', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.counts).toBeDefined();
    expect(Array.isArray(res.body.topRisk)).toBe(true);
    expect(Array.isArray(res.body.trend)).toBe(true);
    expect(res.body.trend.length).toBe(30);
  });
});

describe('GET /api/consumers/:id/predict', () => {
  it('returns prediction (ML service unavailable → fallback)', async () => {
    // ML service is not running in test env, so fallback path is exercised
    const res = await request(app)
      .get('/api/consumers/T00001/predict')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.predictedLabel).toBeDefined();
    expect(typeof res.body.confidence).toBe('number');
    expect(Array.isArray(res.body.topFeatures)).toBe(true);
    expect(res.body.recommendation).toBeDefined();
    // Prediction must have been persisted
    expect(res.body.id).toBeDefined();
  });
});
