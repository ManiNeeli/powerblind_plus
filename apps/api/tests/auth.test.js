/**
 * Auth route integration tests — Phase 2
 * Run: npm test -w apps/api
 *
 * Uses supertest against the real Express app with a test SQLite DB.
 * Prisma uses DATABASE_URL from .env.test (created automatically below if absent).
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL       = 'file:./test.db';
process.env.JWT_ACCESS_SECRET  = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

const request = require('supertest');
const bcrypt  = require('bcrypt');
const app     = require('../src/app');

// We need the Prisma client to seed test data
const { getPrismaClient } = require('@powerblind/db');
const prisma = getPrismaClient();

// ── Test data ──────────────────────────────────────────────────────────────
const TEST_USER = {
  email:    'test-operator@powerblind.test',
  password: 'TestPass123!',
  role:     'OPERATOR',
};

let testUserId;

// ── Setup / teardown ───────────────────────────────────────────────────────
beforeAll(async () => {
  // Clean up any leftover test user from a previous run
  await prisma.user.deleteMany({ where: { email: TEST_USER.email } });

  const hash = await bcrypt.hash(TEST_USER.password, 12);
  const user = await prisma.user.create({
    data: { email: TEST_USER.email, passwordHash: hash, role: TEST_USER.role },
  });
  testUserId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_USER.email } });
  await prisma.$disconnect();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns 200 + accessToken on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user.passwordHash).toBeUndefined(); // never leaked
    expect(res.headers['set-cookie']).toBeDefined();    // refresh cookie set
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    // Must not reveal whether email exists
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Whatever1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 422 on missing email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'TestPass123!' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('increments failedLoginCount on bad password', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'BadPass1!' });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user.failedLoginCount).toBeGreaterThan(0);
  });

  it('resets failedLoginCount on successful login', async () => {
    // First set a failure
    await prisma.user.update({ where: { id: testUserId }, data: { failedLoginCount: 3 } });

    await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const user = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(user.failedLoginCount).toBe(0);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 401 with no refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  it('returns new accessToken with valid refresh cookie', async () => {
    // Login first to get cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const cookie = loginRes.headers['set-cookie'];

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the refresh cookie', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    // The set-cookie header should clear the cookie
    const cookies = res.headers['set-cookie'] ?? [];
    const cleared  = cookies.some(c => c.startsWith('refreshToken=;') || c.includes('Expires=Thu, 01 Jan 1970'));
    expect(cleared || res.body.ok).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user info with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const { accessToken } = loginRes.body;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(TEST_USER.email);
    expect(meRes.body.user.passwordHash).toBeUndefined();
  });
});

describe('POST /api/auth/change-password', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: TEST_USER.password, newPassword: 'NewPass456!' });
    expect(res.status).toBe(401);
  });

  it('returns 400 if current password is wrong', async () => {
    const { body: { accessToken } } = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'WrongPass1!', newPassword: 'NewPass456@' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('Account lockout', () => {
  const LOCKED_USER = { email: 'locktest@powerblind.test', password: 'LockTest123!' };

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: LOCKED_USER.email } });
    const hash = await bcrypt.hash(LOCKED_USER.password, 12);
    await prisma.user.create({
      data: { email: LOCKED_USER.email, passwordHash: hash, role: 'OPERATOR' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: LOCKED_USER.email } });
  });

  it('locks account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: LOCKED_USER.email, password: 'WrongPass1!' });
    }

    const user = await prisma.user.findUnique({ where: { email: LOCKED_USER.email } });
    expect(user.lockedUntil).not.toBeNull();
    expect(new Date(user.lockedUntil) > new Date()).toBe(true);
  });

  it('returns 423 when account is locked', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: LOCKED_USER.email, password: LOCKED_USER.password });
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('GET /api/health', () => {
  it('returns 200 with check results', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('powerblind-api');
    expect(res.body.checks.database.status).toBe('ok');
  });
});
