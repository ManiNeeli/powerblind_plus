/**
 * Phase 3 integration tests — export, batch predict, prediction history
 */
process.env.NODE_ENV            = 'test';
process.env.DATABASE_URL        = 'file:./test.db';
process.env.JWT_ACCESS_SECRET   = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET  = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

const request = require('supertest');
const bcrypt  = require('bcrypt');
const app     = require('../src/app');
const { getPrismaClient } = require('@powerblind/db');
const prisma = getPrismaClient();

const TEST_EMAIL = 'phase3-test@powerblind.test';
let accessToken;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.reading.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.prediction.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.inspection.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.consumer.deleteMany({ where: { id: { in: ['P3C001','P3C002'] } } });

  const hash = await bcrypt.hash('TestPass123!', 12);
  await prisma.user.create({ data: { email: TEST_EMAIL, passwordHash: hash, role: 'OPERATOR' } });

  // Seed two test consumers
  for (const id of ['P3C001','P3C002']) {
    await prisma.consumer.upsert({
      where:  { id },
      update: {},
      create: { id, consumerType:'residential_small', groundTruthLabel:'Theft', groundTruthSubtype:'T1_PartialReduction', baseKwh:14.0 },
    });
    for (let i = 0; i < 5; i++) {
      await prisma.reading.upsert({
        where:  { consumerId_date: { consumerId: id, date: new Date(`2023-01-0${i+1}`) } },
        update: {},
        create: { consumerId: id, date: new Date(`2023-01-0${i+1}`), kwh: 8+i, voltageV:230, currentA:2.1, powerFactor:0.92, commFlag:false },
      });
    }
  }

  const res = await request(app).post('/api/auth/login').send({ email: TEST_EMAIL, password: 'TestPass123!' });
  accessToken = res.body.accessToken;
});

afterAll(async () => {
  await prisma.reading.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.prediction.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.inspection.deleteMany({ where: { consumerId: { in: ['P3C001','P3C002'] } } });
  await prisma.consumer.deleteMany({ where: { id: { in: ['P3C001','P3C002'] } } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.$disconnect();
});

describe('GET /api/consumers/:id/predictions', () => {
  it('returns empty array before any predictions', async () => {
    const res = await request(app)
      .get('/api/consumers/P3C001/predictions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.predictions)).toBe(true);
  });

  it('returns predictions after running predict', async () => {
    // Run a prediction first
    await request(app)
      .get('/api/consumers/P3C001/predict')
      .set('Authorization', `Bearer ${accessToken}`);

    const res = await request(app)
      .get('/api/consumers/P3C001/predictions')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.predictions.length).toBeGreaterThan(0);
    // topFeatures must be parsed (array, not string)
    expect(Array.isArray(res.body.predictions[0].topFeatures)).toBe(true);
  });
});

describe('POST /api/consumers/batch-predict', () => {
  it('returns 422 for empty array', async () => {
    const res = await request(app)
      .post('/api/consumers/batch-predict')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consumerIds: [] });
    expect(res.status).toBe(422);
  });

  it('runs predictions for multiple consumers', async () => {
    const res = await request(app)
      .post('/api/consumers/batch-predict')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consumerIds: ['P3C001','P3C002'] });
    expect(res.status).toBe(200);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBe(2);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/consumers/batch-predict')
      .send({ consumerIds: ['P3C001'] });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/export/consumers', () => {
  it('returns CSV content-type', async () => {
    const res = await request(app)
      .get('/api/export/consumers')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  it('CSV has correct headers', async () => {
    const res = await request(app)
      .get('/api/export/consumers')
      .set('Authorization', `Bearer ${accessToken}`);
    const firstLine = res.text.split('\r\n')[0];
    expect(firstLine).toContain('consumer_id');
    expect(firstLine).toContain('ground_truth_label');
    expect(firstLine).toContain('latest_confidence');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/export/consumers');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/export/predictions', () => {
  it('returns CSV with prediction data', async () => {
    const res = await request(app)
      .get('/api/export/predictions')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const firstLine = res.text.split('\r\n')[0];
    expect(firstLine).toContain('prediction_id');
    expect(firstLine).toContain('predicted_label');
    expect(firstLine).toContain('confidence');
  });
});

describe('GET /api/export/inspections', () => {
  it('returns CSV', async () => {
    const res = await request(app)
      .get('/api/export/inspections')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const firstLine = res.text.split('\r\n')[0];
    expect(firstLine).toContain('inspection_id');
    expect(firstLine).toContain('status');
  });
});

describe('POST /api/inspections (Phase 3 - full workflow)', () => {
  it('rejects inspection for nonexistent consumer', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consumerId: 'DOESNOTEXIST', status: 'CONFIRMED' });
    expect(res.status).toBe(404);
  });

  it('creates inspection and can retrieve it', async () => {
    const createRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consumerId: 'P3C001', status: 'QUEUED', notes: 'Phase 3 test inspection' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.inspection.id;

    const getRes = await request(app)
      .get(`/api/inspections/${id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.inspection.status).toBe('QUEUED');
    expect(getRes.body.inspection.notes).toBe('Phase 3 test inspection');
  });

  it('can update inspection status', async () => {
    const createRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ consumerId: 'P3C002', status: 'QUEUED' });
    const id = createRes.body.inspection.id;

    const patchRes = await request(app)
      .patch(`/api/inspections/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'CONFIRMED', notes: 'Updated to confirmed' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.inspection.status).toBe('CONFIRMED');
  });
});
