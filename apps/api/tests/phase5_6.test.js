/**
 * Phase 5 & 6 tests — export RBAC, health checks, error handling
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

const OPERATOR_EMAIL = 'p56-op@powerblind.test';
const ADMIN_EMAIL    = 'p56-admin@powerblind.test';
let operatorToken, adminToken;

beforeAll(async () => {
  for (const [email, role] of [[OPERATOR_EMAIL,'OPERATOR'],[ADMIN_EMAIL,'ADMIN']]) {
    await prisma.user.deleteMany({ where: { email } });
    const hash = await bcrypt.hash('TestPass123!', 12);
    await prisma.user.create({ data: { email, passwordHash: hash, role } });
  }
  const opRes = await request(app).post('/api/auth/login').send({ email: OPERATOR_EMAIL, password: 'TestPass123!' });
  const adRes = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL,    password: 'TestPass123!' });
  operatorToken = opRes.body.accessToken;
  adminToken    = adRes.body.accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [OPERATOR_EMAIL, ADMIN_EMAIL] } } });
  await prisma.$disconnect();
});

describe('GET /api/health', () => {
  it('returns 200 with service, checks object', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('powerblind-api');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database.status).toBe('ok');
  });

  it('includes uptime field', async () => {
    const res = await request(app).get('/api/health');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('includes timestamp in ISO format', async () => {
    const res = await request(app).get('/api/health');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
  });
});

describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('includes X-Request-Id in responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('404 handling', () => {
  it('returns structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
  });
});

describe('RBAC — operator cannot access admin routes', () => {
  it('GET /api/users → 403 for operator', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/audit-log → 403 for operator', async () => {
    const res = await request(app).get('/api/audit-log').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/model/versions → 403 for operator', async () => {
    const res = await request(app).get('/api/model/versions').set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/users → 200 for admin', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe('Input validation (Zod)', () => {
  it('rejects login with invalid email format → 422', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: 'pass' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.fields)).toBe(true);
  });

  it('rejects consumers list with invalid limit → 422', async () => {
    const res = await request(app)
      .get('/api/consumers?limit=999')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(422);
  });

  it('rejects inspection with invalid status → 422', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ consumerId: 'C00001', status: 'INVALID_STATUS' });
    expect(res.status).toBe(422);
  });
});

describe('Export endpoints', () => {
  it('GET /api/export/consumers → 401 without token', async () => {
    const res = await request(app).get('/api/export/consumers');
    expect(res.status).toBe(401);
  });

  it('GET /api/export/consumers → CSV with correct headers (operator OK)', async () => {
    const res = await request(app)
      .get('/api/export/consumers')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });

  it('GET /api/export/predictions → 200 for operator', async () => {
    const res = await request(app)
      .get('/api/export/predictions')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Null byte / injection protection', () => {
  it('sanitizes null bytes from request body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test\x00@example.com', password: 'pass\x00word' });
    // Should be rejected (wrong credentials), not 500
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});

describe('Error response shape', () => {
  it('all errors have { error: { code, message } } shape', async () => {
    const endpoints = [
      { method: 'get',  path: '/api/consumers/FAKEID' },
      { method: 'get',  path: '/api/nonexistent' },
    ];
    for (const { method, path } of endpoints) {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${operatorToken}`);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    }
  });
});
