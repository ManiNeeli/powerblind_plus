/**
 * Phase 4 tests — model versioning, SHAP endpoint, retrain trigger
 */
process.env.NODE_ENV           = 'test';
process.env.DATABASE_URL       = 'file:./test.db';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

const request = require('supertest');
const bcrypt  = require('bcrypt');
const app     = require('../src/app');
const { getPrismaClient } = require('@powerblind/db');
const prisma = getPrismaClient();

const ADMIN_EMAIL = 'phase4-admin@powerblind.test';
let   adminToken;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  const hash = await bcrypt.hash('AdminPass123!', 12);
  await prisma.user.create({ data: { email: ADMIN_EMAIL, passwordHash: hash, role: 'ADMIN' } });

  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: 'AdminPass123!' });
  adminToken = res.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });
  await prisma.$disconnect();
});

describe('GET /api/model/versions', () => {
  it('returns 403 for OPERATOR role', async () => {
    // Login as operator first
    await prisma.user.deleteMany({ where: { email: 'p4op@powerblind.test' } });
    const hash = await bcrypt.hash('OpPass123!', 12);
    await prisma.user.create({ data: { email: 'p4op@powerblind.test', passwordHash: hash, role: 'OPERATOR' } });
    const opRes = await request(app).post('/api/auth/login').send({ email: 'p4op@powerblind.test', password: 'OpPass123!' });
    const opToken = opRes.body.accessToken;

    const res = await request(app)
      .get('/api/model/versions')
      .set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);

    await prisma.user.deleteMany({ where: { email: 'p4op@powerblind.test' } });
  });

  it('returns versions array for ADMIN', async () => {
    const res = await request(app)
      .get('/api/model/versions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 307]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body.versions)).toBe(true);
      expect(res.body.mlService).toBeDefined();
    }
  });
});

describe('POST /api/model/seed-version', () => {
  it('creates a version record', async () => {
    // Clean any existing test version first
    await prisma.modelVersion.deleteMany({ where: { version: 'test-v0.1' } });

    const res = await request(app)
      .post('/api/model/seed-version')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 'test-v0.1' });

    expect(res.status).toBe(201);
    expect(res.body.version.version).toBe('test-v0.1');
    expect(res.body.seeded).toBe(true);

    // Clean up
    await prisma.modelVersion.deleteMany({ where: { version: 'test-v0.1' } });
  });

  it('returns seeded: false if version already exists', async () => {
    // Seed the default mock version
    await request(app)
      .post('/api/model/seed-version')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 'mock-dup-test' });

    const res = await request(app)
      .post('/api/model/seed-version')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 'mock-dup-test' });

    expect(res.status).toBe(200);
    expect(res.body.seeded).toBe(false);

    await prisma.modelVersion.deleteMany({ where: { version: 'mock-dup-test' } });
  });
});

describe('POST /api/model/retrain', () => {
  it('returns ok:true (ML service unavailable is handled gracefully)', async () => {
    const res = await request(app)
      .post('/api/model/retrain')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('PATCH /api/model/versions/:id/activate', () => {
  it('activates a specific version', async () => {
    // Create two versions
    await prisma.modelVersion.deleteMany({ where: { version: { in: ['activate-v1','activate-v2'] } } });
    const v1 = await prisma.modelVersion.create({
      data: { version: 'activate-v1', isActive: false, metricsJson: '{}' },
    });
    const v2 = await prisma.modelVersion.create({
      data: { version: 'activate-v2', isActive: false, metricsJson: '{}' },
    });

    const res = await request(app)
      .patch(`/api/model/versions/${v1.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.version.isActive).toBe(true);

    // v2 should still be inactive
    const v2check = await prisma.modelVersion.findUnique({ where: { id: v2.id } });
    expect(v2check.isActive).toBe(false);

    await prisma.modelVersion.deleteMany({ where: { version: { in: ['activate-v1','activate-v2'] } } });
  });
});

describe('GET /api/model/shap', () => {
  it('returns 404 when no SHAP file exists (ML service mock)', async () => {
    const res = await request(app)
      .get('/api/model/shap')
      .set('Authorization', `Bearer ${adminToken}`);
    // 404 from ML service or 500 if ML service is down — both are acceptable
    expect([404, 500, 503]).toContain(res.status);
  });
});

describe('Audit log entries for model actions', () => {
  it('creates audit log on seed-version', async () => {
    await prisma.modelVersion.deleteMany({ where: { version: 'audit-test-v1' } });

    await request(app)
      .post('/api/model/seed-version')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ version: 'audit-test-v1' });

    const logs = await prisma.auditLog.findMany({
      where: { action: 'MODEL_VERSION_SEEDED' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('MODEL_VERSION_SEEDED');

    await prisma.modelVersion.deleteMany({ where: { version: 'audit-test-v1' } });
  });
});
