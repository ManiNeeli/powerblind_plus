/**
 * PowerBlind+ — Black-Box & State-Transition Testing Suite
 *
 * Methodologies Covered:
 * 1. Black-Box Testing — Equivalence Partitioning (Valid & Invalid partitions)
 * 2. Black-Box Testing — Boundary Value Analysis (BVA: min-1, min, nominal, max, max+1)
 * 3. Black-Box Testing — State Transition Testing (Finite State Machines: Inspection, Lockout, Model Activation)
 * 4. Black-Box Testing — Graph-Based Testing (Data Flow & Object Relationship Graphs: User -> Consumer -> Reading -> Prediction -> Inspection -> AuditLog)
 * 5. Validation Testing & Integration Testing: Business requirement validation and multi-service integrity
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { getPrismaClient } = require('@powerblind/db');
const prisma = getPrismaClient();

// ── Test Personas & Seeds ──────────────────────────────────────────────────
const TEST_ADMIN = {
  email: 'qa-admin@powerblind.test',
  password: 'AdminPassword123!',
  role: 'ADMIN',
};

const TEST_OPERATOR = {
  email: 'qa-operator@powerblind.test',
  password: 'OperatorPass123!',
  role: 'OPERATOR',
};

const TEST_CONSUMER_ID = 'C_BLACKBOX_01';

let adminToken;
let operatorToken;
let adminUserId;
let operatorUserId;

beforeAll(async () => {
  // Purge any stale test records from previous runs
  await prisma.auditLog.deleteMany({
    where: { action: { in: ['INSPECTION_LOGGED', 'INSPECTION_UPDATED', 'MODEL_VERSION_SEEDED', 'MODEL_VERSION_ACTIVATED'] } },
  });
  await prisma.inspection.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.prediction.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.reading.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.consumer.deleteMany({ where: { id: TEST_CONSUMER_ID } });
  await prisma.user.deleteMany({ where: { email: { in: [TEST_ADMIN.email, TEST_OPERATOR.email] } } });

  // 1. Seed Admin User
  const adminHash = await bcrypt.hash(TEST_ADMIN.password, 10);
  const adminUser = await prisma.user.create({
    data: { email: TEST_ADMIN.email, passwordHash: adminHash, role: TEST_ADMIN.role },
  });
  adminUserId = adminUser.id;

  // 2. Seed Operator User
  const opHash = await bcrypt.hash(TEST_OPERATOR.password, 10);
  const opUser = await prisma.user.create({
    data: { email: TEST_OPERATOR.email, passwordHash: opHash, role: TEST_OPERATOR.role },
  });
  operatorUserId = opUser.id;

  // 3. Seed Consumer
  await prisma.consumer.create({
    data: {
      id: TEST_CONSUMER_ID,
      consumerType: 'residential_small',
      baseKwh: 6.5,
      groundTruthLabel: 'Theft',
      groundTruthSubtype: 'T2_ZeroConsumption',
    },
  });

  // 4. Seed Readings for Consumer
  const now = new Date();
  const readings = [];
  for (let i = 0; i < 30; i++) {
    readings.push({
      consumerId: TEST_CONSUMER_ID,
      date: new Date(now.getTime() - (30 - i) * 86400000),
      kwh: i < 15 ? 6.5 : 0.05, // 15 days normal, 15 days zero bypass
      voltageV: 230,
      currentA: 1.2,
      powerFactor: 0.94,
      commFlag: false,
    });
  }
  await prisma.reading.createMany({ data: readings });

  // Obtain JWT tokens via login endpoint
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
  adminToken = adminLogin.body.accessToken;

  const opLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: TEST_OPERATOR.email, password: TEST_OPERATOR.password });
  operatorToken = opLogin.body.accessToken;
});

afterAll(async () => {
  await prisma.inspection.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.prediction.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.reading.deleteMany({ where: { consumerId: TEST_CONSUMER_ID } });
  await prisma.consumer.deleteMany({ where: { id: TEST_CONSUMER_ID } });
  await prisma.user.deleteMany({ where: { email: { in: [TEST_ADMIN.email, TEST_OPERATOR.email] } } });
  await prisma.$disconnect();
});

// ============================================================================
// SECTION 1: BLACK-BOX TESTING — EQUIVALENCE PARTITIONING
// ============================================================================
describe('Black-Box Testing: Equivalence Partitioning', () => {
  describe('Partition A: Batch Prediction (consumerIds Array)', () => {
    // Valid Partition: Array with length in [1, 50]
    it('Valid Partition: Accepts array of valid consumer IDs (length = 1)', async () => {
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: [TEST_CONSUMER_ID] });

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.results).toBeGreaterThanOrEqual(1);
    });

    // Invalid Partition 1: Empty array (length = 0)
    it('Invalid Partition 1: Rejects empty array [] -> 422 Validation Error', async () => {
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: [] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    // Invalid Partition 2: Exceeding max allowable batch capacity (>50 items)
    it('Invalid Partition 2: Rejects array with 52 items -> 422 Validation Error', async () => {
      const largeList = Array.from({ length: 52 }, (_, i) => `C_OVERFLOW_${i}`);
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: largeList });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    // Invalid Partition 3: Non-array inputs (string, object, null)
    it('Invalid Partition 3: Rejects non-array types (string, object, null) -> 422 Validation Error', async () => {
      const resString = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: 'C_NOT_AN_ARRAY' });
      expect(resString.status).toBe(422);

      const resObj = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: { id: TEST_CONSUMER_ID } });
      expect(resObj.status).toBe(422);

      const resNull = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: null });
      expect(resNull.status).toBe(422);
    });
  });

  describe('Partition B: Pagination Limit', () => {
    // Valid Partition: Integer in [1, 100]
    it('Valid Partition: Accepts limit = 25 within valid range', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=25')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(25);
    });

    // Invalid Partition 1: Limit <= 0
    it('Invalid Partition 1: Rejects negative limit -> 422', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=-5')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(422);
    });

    // Invalid Partition 2: Limit > 100
    it('Invalid Partition 2: Rejects limit = 150 -> 422', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=150')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(422);
    });

    // Invalid Partition 3: Non-numeric limit
    it('Invalid Partition 3: Rejects non-numeric limit="abc" -> 422', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=abc')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(422);
    });
  });

  describe('Partition C: Inspection Status Enumeration', () => {
    it('Valid Partition: Accepts valid statuses [QUEUED, CONFIRMED, FALSE_POSITIVE]', async () => {
      for (const st of ['QUEUED', 'CONFIRMED', 'FALSE_POSITIVE']) {
        const res = await request(app)
          .post('/api/inspections')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({ consumerId: TEST_CONSUMER_ID, status: st, notes: `Valid partition test for ${st}` });

        expect(res.status).toBe(201);
        expect(res.body.inspection.status).toBe(st);
      }
    });

    it('Invalid Partition: Rejects non-enum statuses -> 422 Validation Error', async () => {
      const invalidStatuses = ['PENDING', 'CANCELLED', 'IN_PROGRESS', 'UNKNOWN_STATUS', 999];
      for (const st of invalidStatuses) {
        const res = await request(app)
          .post('/api/inspections')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({ consumerId: TEST_CONSUMER_ID, status: st });

        expect(res.status).toBe(422);
      }
    });
  });

  describe('Partition D: Authentication Inputs', () => {
    it('Invalid Partition: Rejects malformed email structures without "@" or domain -> 422', async () => {
      const badEmails = ['plainaddress', '@missingusername.com', 'username@.com', 'user@domain..com'];
      for (const email of badEmails) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'AnyPassword123!' });

        expect(res.status).toBe(422);
      }
    });
  });
});

// ============================================================================
// SECTION 2: BLACK-BOX TESTING — BOUNDARY VALUE ANALYSIS (BVA)
// ============================================================================
describe('Black-Box Testing: Boundary Value Analysis (BVA)', () => {
  describe('Pagination Limit Boundaries: [1 ... 100]', () => {
    it('BVA Min - 1: limit = 0 -> 422 (Just below minimum)', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=0')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(422);
    });

    it('BVA Min Boundary: limit = 1 -> 200 (Exact minimum boundary)', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=1')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(1);
    });

    it('BVA Max Boundary: limit = 100 -> 200 (Exact maximum boundary)', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=100')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(100);
    });

    it('BVA Max + 1: limit = 101 -> 422 (Just above maximum boundary)', async () => {
      const res = await request(app)
        .get('/api/consumers?limit=101')
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(422);
    });
  });

  describe('Batch Predict Length Boundaries: [1 ... 50]', () => {
    it('BVA Min - 1: length = 0 items -> 422 (Just below minimum)', async () => {
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: [] });
      expect(res.status).toBe(422);
    });

    it('BVA Min Boundary: length = 1 item -> 200 (Exact minimum boundary)', async () => {
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: [TEST_CONSUMER_ID] });
      expect(res.status).toBe(200);
    });

    it('BVA Max Boundary: length = 50 items -> 200 (Exact maximum boundary)', async () => {
      const batch50 = Array.from({ length: 50 }, (_, i) => (i === 0 ? TEST_CONSUMER_ID : `C_DUMMY_${i}`));
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: batch50 });
      expect(res.status).toBe(200);
    });

    it('BVA Max + 1: length = 51 items -> 422 (Just above maximum boundary)', async () => {
      const batch51 = Array.from({ length: 51 }, (_, i) => `C_DUMMY_${i}`);
      const res = await request(app)
        .post('/api/consumers/batch-predict')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ consumerIds: batch51 });
      expect(res.status).toBe(422);
    });
  });

  describe('Search String Length Boundaries: Max 20 chars', () => {
    it('BVA Max Boundary: search string with exact 20 characters -> 200', async () => {
      const res = await request(app)
        .get(`/api/consumers?search=${'A'.repeat(20)}`)
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(200);
    });

    it('BVA Max + 1: search string with 21 characters -> 422', async () => {
      const res = await request(app)
        .get(`/api/consumers?search=${'A'.repeat(21)}`)
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(res.status).toBe(422);
    });
  });
});

// ============================================================================
// SECTION 3: BLACK-BOX TESTING — STATE TRANSITION TESTING (FSM)
// ============================================================================
describe('Black-Box Testing: State Transition Testing (Finite State Machines)', () => {
  describe('FSM 1: Inspection Workflow Lifecycle State Machine', () => {
    /**
     * State Machine:
     * (Init) -> [QUEUED] --(Update status)--> [CONFIRMED]
     *                    --(Update status)--> [FALSE_POSITIVE]
     */
    let createdInspectionId;

    it('Transition 1 (Creation): Enters Initial State [QUEUED]', async () => {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          consumerId: TEST_CONSUMER_ID,
          status: 'QUEUED',
          notes: 'FSM Test: Initial Inspection Queued',
        });

      expect(res.status).toBe(201);
      expect(res.body.inspection.status).toBe('QUEUED');
      createdInspectionId = res.body.inspection.id;
    });

    it('Transition 2: [QUEUED] -> [CONFIRMED] upon physical field inspection finding theft shunt', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${createdInspectionId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'CONFIRMED',
          notes: 'FSM Test: Field team confirmed meter bypass shunt. Case verified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.inspection.status).toBe('CONFIRMED');
      expect(res.body.inspection.notes).toContain('bypass shunt');
    });

    it('Transition 3: [CONFIRMED] -> [FALSE_POSITIVE] on corrective audit review', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${createdInspectionId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: 'FALSE_POSITIVE',
          notes: 'FSM Test: Re-examined: solar inverter reverse injection, not theft.',
        });

      expect(res.status).toBe(200);
      expect(res.body.inspection.status).toBe('FALSE_POSITIVE');
    });

    it('Invalid Transition: Rejects illegal state transition string -> 422 (State remains unchanged)', async () => {
      const res = await request(app)
        .patch(`/api/inspections/${createdInspectionId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status: 'ILLEGAL_STATE_TRANSITION' });

      expect(res.status).toBe(422);

      // Verify state was preserved
      const checkRes = await request(app)
        .get(`/api/inspections/${createdInspectionId}`)
        .set('Authorization', `Bearer ${operatorToken}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.inspection.status).toBe('FALSE_POSITIVE');
    });
  });

  describe('FSM 2: Account Security Lockout State Machine', () => {
    /**
     * State Machine:
     * S0: ACTIVE (failed = 0)
     * S1: WARNING (failed = 1..4) -> 401
     * S2: LOCKED (failed >= 5) -> 423 (Locked)
     * S3: RESET -> password changed / success -> S0 (failed = 0)
     */
    const LOCKOUT_USER = {
      email: 'fsm-lockout@powerblind.test',
      password: 'CorrectPassword123!',
      role: 'OPERATOR',
    };

    beforeAll(async () => {
      await prisma.user.deleteMany({ where: { email: LOCKOUT_USER.email } });
      const hash = await bcrypt.hash(LOCKOUT_USER.password, 10);
      await prisma.user.create({
        data: { email: LOCKOUT_USER.email, passwordHash: hash, role: LOCKOUT_USER.role },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: LOCKOUT_USER.email } });
    });

    it('S0 -> S1: Failed logins 1 to 4 return 401 and increment counter', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: LOCKOUT_USER.email, password: 'WrongPassword' });

        expect(res.status).toBe(401);
      }

      const user = await prisma.user.findUnique({ where: { email: LOCKOUT_USER.email } });
      expect(user.failedLoginCount).toBe(4);
      expect(user.lockedUntil).toBeNull();
    });

    it('S1 -> S2: 5th failed attempt triggers Lockout transition -> returns 423 Locked on subsequent attempt', async () => {
      // 5th failed attempt returns 401 and sets lockedUntil
      const res5 = await request(app)
        .post('/api/auth/login')
        .send({ email: LOCKOUT_USER.email, password: 'WrongPassword' });

      expect(res5.status).toBe(401);

      const user = await prisma.user.findUnique({ where: { email: LOCKOUT_USER.email } });
      expect(user.failedLoginCount).toBe(5);
      expect(user.lockedUntil).not.toBeNull();
      expect(new Date(user.lockedUntil).getTime()).toBeGreaterThan(Date.now());

      // Subsequent attempt returns 423 Locked
      const resLocked = await request(app)
        .post('/api/auth/login')
        .send({ email: LOCKOUT_USER.email, password: 'WrongPassword' });

      expect(resLocked.status).toBe(423);
      expect(resLocked.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('S2 Guard Condition: Even with CORRECT password, locked account returns 423 Locked', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOCKOUT_USER.email, password: LOCKOUT_USER.password });

      expect(res.status).toBe(423);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('S2 -> S0: Admin/System unlocks account -> transitions back to ACTIVE', async () => {
      // Unlock account by clearing lockout fields
      await prisma.user.update({
        where: { email: LOCKOUT_USER.email },
        data: { failedLoginCount: 0, lockedUntil: null },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: LOCKOUT_USER.email, password: LOCKOUT_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });
  });

  describe('FSM 3: ML Model Deployment & Version Activation State Machine', () => {
    /**
     * State Machine:
     * Model V1 is Active -> Seed Model V2 -> V2 becomes Active, V1 becomes Inactive
     * -> Reactivate V1 -> V1 becomes Active, V2 becomes Inactive
     */
    const V1_NAME = 'xgboost-physics-v1.0';
    const V2_NAME = 'xgboost-physics-v2.0';
    let v1Id;
    let v2Id;

    beforeAll(async () => {
      await prisma.modelVersion.deleteMany({ where: { version: { in: [V1_NAME, V2_NAME] } } });

      const v1 = await prisma.modelVersion.create({
        data: { version: V1_NAME, isActive: true, metricsJson: '{}' },
      });
      v1Id = v1.id;

      const v2 = await prisma.modelVersion.create({
        data: { version: V2_NAME, isActive: false, metricsJson: '{}' },
      });
      v2Id = v2.id;
    });

    afterAll(async () => {
      await prisma.modelVersion.deleteMany({ where: { version: { in: [V1_NAME, V2_NAME] } } });
    });

    it('Transition: Activating V2 deactivates V1 atomically', async () => {
      const res = await request(app)
        .patch(`/api/model/versions/${v2Id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.version.isActive).toBe(true);

      // Verify V1 is now inactive in DB
      const v1Db = await prisma.modelVersion.findUnique({ where: { id: v1Id } });
      const v2Db = await prisma.modelVersion.findUnique({ where: { id: v2Id } });
      expect(v1Db.isActive).toBe(false);
      expect(v2Db.isActive).toBe(true);
    });

    it('Transition: Reactivating V1 restores V1 as the sole active model', async () => {
      const res = await request(app)
        .patch(`/api/model/versions/${v1Id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.version.isActive).toBe(true);

      const v1Db = await prisma.modelVersion.findUnique({ where: { id: v1Id } });
      const v2Db = await prisma.modelVersion.findUnique({ where: { id: v2Id } });
      expect(v1Db.isActive).toBe(true);
      expect(v2Db.isActive).toBe(false);
    });
  });
});

// ============================================================================
// SECTION 4: BLACK-BOX TESTING — GRAPH-BASED TESTING
// ============================================================================
describe('Black-Box Testing: Graph-Based Object Relationship & Transaction Flow', () => {
  /**
   * Entity Graph Under Test:
   * Node A (User: Operator)
   *   |
   *   v (inspects / queries)
   * Node B (Consumer)
   *   |
   *   v (has many daily readings)
   * Node C (Readings)
   *   |
   *   v (evaluated by Physics & ML)
   * Node D (Prediction)
   *   |
   *   v (prompts field audit ticket)
   * Node E (Inspection)
   *   |
   *   v (generates compliance audit)
   * Node F (AuditLog)
   */

  it('Graph Traversal Path: User -> Consumer -> Reading -> Prediction -> Inspection -> AuditLog', async () => {
    // 1. Operator queries Consumer detail (A -> B)
    const consumerRes = await request(app)
      .get(`/api/consumers/${TEST_CONSUMER_ID}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(consumerRes.status).toBe(200);
    expect(consumerRes.body.id).toBe(TEST_CONSUMER_ID);

    // 2. Operator retrieves daily readings time-series (B -> C)
    const tsRes = await request(app)
      .get(`/api/consumers/${TEST_CONSUMER_ID}/timeseries`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(tsRes.status).toBe(200);
    expect(tsRes.body.readings.length).toBeGreaterThan(0);

    // 3. Execution of Physics Anomaly Evaluation (C -> D)
    const predictRes = await request(app)
      .get(`/api/consumers/${TEST_CONSUMER_ID}/predict`)
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(predictRes.status).toBe(200);
    expect(predictRes.body.predictedLabel).toBe('Theft');
    expect(predictRes.body.consumerId).toBe(TEST_CONSUMER_ID);

    // 4. Creation of Field Inspection linked to Prediction findings (D -> E)
    const inspectRes = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        consumerId: TEST_CONSUMER_ID,
        status: 'CONFIRMED',
        notes: 'Graph-Based Test: Dispatched field technician based on high-confidence Theft prediction',
      });
    expect(inspectRes.status).toBe(201);
    const inspectionId = inspectRes.body.inspection.id;

    // 5. AuditLog verification of transaction compliance (E -> F)
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'INSPECTION_LOGGED',
        actorId: operatorUserId,
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    expect(logs.length).toBeGreaterThan(0);
    const recentAudit = logs[0];
    const meta = JSON.parse(recentAudit.metadata);
    expect(meta.consumerId).toBe(TEST_CONSUMER_ID);
    expect(meta.status).toBe('CONFIRMED');

    // 6. Upstream Traceability Verification:
    // From AuditLog -> Inspection -> Consumer -> Readings
    const tracedInspection = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      include: { consumer: true, operator: true },
    });

    expect(tracedInspection.consumer.id).toBe(TEST_CONSUMER_ID);
    expect(tracedInspection.operator.id).toBe(operatorUserId);

    // Verify upstream data graph nodes linked to this consumer
    const [linkedPredictions, linkedReadings] = await Promise.all([
      prisma.prediction.findMany({ where: { consumerId: tracedInspection.consumer.id } }),
      prisma.reading.findMany({ where: { consumerId: tracedInspection.consumer.id } }),
    ]);

    expect(linkedPredictions.length).toBeGreaterThan(0);
    expect(linkedReadings.length).toBeGreaterThan(0);
  });
});
