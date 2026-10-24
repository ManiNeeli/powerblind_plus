/**
 * PowerBlind+ — White-Box & Unit Testing Suite
 *
 * Methodologies Covered:
 * 1. Unit Testing: Isolated component tests for security, math, validation, and physics units
 * 2. White-Box Testing — Basis Path Testing: McCabe Cyclomatic Complexity & Independent Execution Paths
 * 3. White-Box Testing — Control Structure Testing:
 *    a) Condition Testing (Branch & Boolean Sub-clause Coverage)
 *    b) Loop Boundary Testing (0, 1, 2, m, n iterations)
 * 4. The Art of Debugging: Numerical stability, null-safety, division-by-zero, and extreme edge-case isolation
 */

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-64-chars-padded-0000000000000000000000';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-64-chars-padded-000000000000000000000';

// Globals (describe, it, expect) provided by Vitest

// Target Units Under Test
const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getExpiresIn,
} = require('../src/lib/jwt');

const {
  validatePassword,
  hashPassword,
  comparePassword,
} = require('../src/lib/password');

const {
  sanitize,
  sanitizeString,
} = require('../src/middleware/sanitize');

const {
  loginSchema,
  consumerListSchema,
  createInspectionSchema,
  updateInspectionSchema,
} = require('../src/lib/validate');

const {
  CONSUMER_ARCHETYPES,
  analyzeConsumerPhysics,
  buildCommFailureResult,
  calculateTheoreticalDailyKwh,
  calculateLinearSlope,
  calculateSoftmaxProbabilities,
} = require('../src/lib/physicsEngine');

// Global telemetry generator for basis path and control structure testing
const generateReadings = (count, kwhFn, opts = {}) => {
  const list = [];
  for (let i = 0; i < count; i++) {
    list.push({
      date: new Date(Date.now() - (count - i) * 86400000).toISOString(),
      kwh: kwhFn(i),
      voltageV: opts.voltageV ?? 230,
      currentA: opts.currentA ?? 1.2,
      powerFactor: opts.powerFactor ?? 0.95,
      commFlag: opts.commFlagFn ? opts.commFlagFn(i) : (opts.commFlag ?? false),
    });
  }
  return list;
};

// ============================================================================
// SECTION 1: CONVENTIONAL SOFTWARE TESTING — UNIT TESTING
// ============================================================================
describe('Unit Testing: Core Security & Utility Modules', () => {
  describe('JWT Utility Unit Tests', () => {
    it('signs and verifies valid access tokens with expected payload claims', () => {
      const payload = { sub: 'usr-101', role: 'ADMIN', email: 'admin@grid.test' };
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe('usr-101');
      expect(decoded.role).toBe('ADMIN');
      expect(decoded.email).toBe('admin@grid.test');
      expect(decoded.exp).toBeDefined();
    });

    it('signs and verifies valid refresh tokens', () => {
      const payload = { sub: 'usr-102', tokenVersion: 1 };
      const token = signRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.sub).toBe('usr-102');
      expect(decoded.tokenVersion).toBe(1);
    });

    it('rejects access token signed with wrong secret or tampered payload', () => {
      const payload = { sub: 'usr-103' };
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyAccessToken(tampered)).toThrow();
      expect(() => verifyRefreshToken(token)).toThrow(); // Access secret != Refresh secret
    });

    it('calculates remaining TTL correctly via getExpiresIn', () => {
      const token = signAccessToken({ sub: 'usr-104' });
      const ttl = getExpiresIn(token);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(900); // 15 minutes = 900s
    });

    it('safely handles malformed strings in getExpiresIn without throwing', () => {
      expect(getExpiresIn('not-a-valid-jwt')).toBe(900);
      expect(getExpiresIn(null)).toBe(900);
      expect(getExpiresIn(undefined)).toBe(900);
    });
  });

  describe('Password Security Policy Unit Tests', () => {
    it('validates compliant passwords that meet length, casing, digits, and special characters', () => {
      expect(validatePassword('StrongSecure#2026')).toBeNull();
      expect(validatePassword('P@ssw0rdEnterprise!')).toBeNull();
    });

    it('rejects passwords shorter than 10 characters', () => {
      const err = validatePassword('Short1!');
      expect(err).toContain('at least 10 characters');
    });

    it('rejects passwords missing uppercase letters', () => {
      const err = validatePassword('lowercase123!@#');
      expect(err).toContain('uppercase letter');
    });

    it('rejects passwords missing numeric digits', () => {
      const err = validatePassword('NoNumbersHere!@#');
      expect(err).toContain('at least one number');
    });

    it('rejects passwords missing special characters', () => {
      const err = validatePassword('NoSpecialChar1234');
      expect(err).toContain('special character');
    });

    it('rejects common dictionary passwords even if they have special characters', () => {
      const err = validatePassword('letmein1!');
      expect(err).toContain('too common');
    });

    it('hashes passwords with salt and verifies matching hashes', async () => {
      const plain = 'V3ry$ecureP@ssword!';
      const hash = await hashPassword(plain);
      expect(hash).toMatch(/^\$2[aby]?\$\d+\$/); // Valid bcrypt hash signature
      const match = await comparePassword(plain, hash);
      expect(match).toBe(true);
      const mismatch = await comparePassword('WrongPassword123!', hash);
      expect(mismatch).toBe(false);
    });
  });

  describe('Enterprise Input Sanitizer Unit Tests', () => {
    it('strips explicit script tags and embedded JavaScript execution vectors', () => {
      const dirty = 'Hello <script>alert("xss")</script> Grid';
      expect(sanitizeString(dirty)).toBe('Hello  Grid');
    });

    it('strips nested/obfuscated script tags iteratively', () => {
      const nested = 'Attack <scr<script>ipt>alert(1)</script> Vector';
      const clean = sanitizeString(nested);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert(1)');
    });

    it('strips dangerous HTML embedding elements: iframe, object, embed, style', () => {
      const dirty = '<iframe src="evil.com"></iframe><object data="bad.swf"></object>Clean text';
      expect(sanitizeString(dirty)).toBe('Clean text');
    });

    it('strips DOM event handlers (onerror, onload, onclick, onmouseover)', () => {
      const dirty = '<img src="valid.png" onerror="alert(document.cookie)" onload="hack()" />';
      const clean = sanitizeString(dirty);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('onload');
    });

    it('strips javascript: pseudo-protocols', () => {
      const dirty = '<a href="javascript:alert(1)">Click Me</a>';
      const clean = sanitizeString(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('strips null-byte injections and non-printable control characters', () => {
      const dirty = 'SafeUser\0Name\u0007Injected';
      expect(sanitizeString(dirty)).toBe('SafeUserNameInjected');
    });

    it('recursively neutralizes MongoDB NoSQL operator keys ($ and dot notation)', () => {
      const payload = {
        username: 'operator1',
        $where: 'sleep(5000)',
        nested: {
          $gt: '',
          'user.admin': true,
          safeField: 'active',
        },
        list: [{ $ne: null }, 'valid_element'],
      };
      const cleaned = sanitize(payload);
      expect(cleaned.username).toBe('operator1');
      expect(cleaned.$where).toBeUndefined();
      expect(cleaned.nested.$gt).toBeUndefined();
      expect(cleaned.nested['user.admin']).toBeUndefined();
      expect(cleaned.nested.safeField).toBe('active');
      expect(cleaned.list[0].$ne).toBeUndefined();
      expect(cleaned.list[1]).toBe('valid_element');
    });
  });

  describe('Pure Mathematical Physics Functions Unit Tests', () => {
    it('computes theoretical daily kWh from active power formula P = V * I * cos(phi)', () => {
      // 230V, 10A, 0.95 PF -> P = 230 * 10 * 0.95 = 2185W = 2.185 kW
      // E_daily = 2.185 * 24 = 52.44 kWh
      const theoretical = calculateTheoreticalDailyKwh(230, 10, 0.95);
      expect(theoretical).toBeCloseTo(52.44, 2);
    });

    it('returns 0 for non-finite voltage or current inputs in theoretical daily calculation', () => {
      expect(calculateTheoreticalDailyKwh(NaN, 10)).toBe(0);
      expect(calculateTheoreticalDailyKwh(230, Infinity)).toBe(0);
      expect(calculateTheoreticalDailyKwh(230, null)).toBe(0);
    });

    it('computes linear regression slope accurately via Ordinary Least Squares', () => {
      // Series y = 2x + 1 -> [1, 3, 5, 7, 9] -> slope = 2
      const slope = calculateLinearSlope([1, 3, 5, 7, 9]);
      expect(slope).toBeCloseTo(2.0, 4);

      // Decreasing slope y = -0.5x + 10 -> [10, 9.5, 9.0, 8.5] -> slope = -0.5
      const decSlope = calculateLinearSlope([10, 9.5, 9.0, 8.5]);
      expect(decSlope).toBeCloseTo(-0.5, 4);
    });

    it('returns slope = 0 for single-element or empty series', () => {
      expect(calculateLinearSlope([])).toBe(0);
      expect(calculateLinearSlope([42])).toBe(0);
    });

    it('normalizes multi-class scores to probabilities summing to 1.0', () => {
      const scores = { Theft: 9.5, FaultyMeter: 3.0, CommFailure: 1.0, Normal: 2.0 };
      const probs = calculateSoftmaxProbabilities(scores);
      expect(probs.Theft).toBeGreaterThan(0.9);
      const total = Object.values(probs).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.0, 2);
    });
  });
});

// ============================================================================
// SECTION 2: WHITE-BOX TESTING — BASIS PATH TESTING
// ============================================================================
/**
 * McCabe's Cyclomatic Complexity Analysis for `analyzeConsumerPhysics`:
 * V(G) = P + 1 where P is the number of predicate/decision nodes.
 *
 * Major independent decision predicates in physicsEngine:
 * 1.  validCount === 0 (Missing telemetry early return)
 * 2.  missingRatio >= 0.03 || commFlagRatio >= 0.015 || commFlagCount >= 3
 *     2a. missingRatio >= 0.03 -> C1_MissingData
 *     2b. maxDuplicateCommStreak >= 3 -> C2_DuplicateTransmission
 *     2c. Else -> C3_ClockSkew
 * 3.  maxStuckStreak >= 6 -> F1_StuckAt
 * 4.  Math.abs(slope) > 0.014 && (Math.abs(baselineDelta) > 0.15 || ...) -> F2_Drift
 * 5.  spikeCount >= 3 && maxZeroStreak < 5 -> F3_NoiseSpike
 * 6.  baselineDeviationPct in [-42, -15] && windowCv >= 0.08 -> F4_UnderRegister
 * 7.  meanV > 210
 *     7a. maxZeroStreak >= 12 || minWindow30Avg <= 0.3 -> T2_ZeroConsumption
 *     7b. maxWindowDropPct <= -45 && windowCv < 0.09 -> T4_ByPassMeter
 *     7c. maxWindowDropPct <= -40 && (windowCv > 0.30 || kwhCv > 0.32) -> T3_RandomReduction
 *     7d. maxWindowDropPct <= -40 (else) -> T1_PartialReduction
 *     7e. baselineDeviationPct <= -28 -> T1_PartialReduction
 * 8.  Math.abs(baselineDeviationPct) < 22 && Math.abs(maxWindowDropPct) < 32 && missingRatio < 0.03 -> Normal
 *
 * Independent execution basis paths = 13 Paths.
 */
describe('White-Box Testing: McCabe Basis Path Execution', () => {
  const dummyConsumer = {
    id: 'C_WHITEBOX_01',
    consumerType: 'residential_small',
    baseKwh: 6.5,
  };

  // PATH 1: Complete Missing Telemetry (validCount === 0) -> C1_MissingData
  it('Basis Path 1: Insufficient / 0 valid readings triggers C1_MissingData early exit', () => {
    const readings = [{ kwh: null }, { kwh: NaN }, { kwh: null }];
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('CommFailure');
    expect(result.predicted_subtype).toBe('C1_MissingData');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.physics_proof.kclCircuitState).toBe('TELECOM_PACKET_DROP');
  });

  // PATH 2: Verified Balanced Circuit -> Normal
  it('Basis Path 2: Nominal balanced circuit telemetry triggers Normal classification', () => {
    // Stable daily 6.5 kWh matching archetype base 6.5 kWh with slight natural variation
    const readings = generateReadings(35, i => 6.4 + (i % 3) * 0.1, { voltageV: 230 });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('Normal');
    expect(result.physics_proof.kclCircuitState).toBe('VERIFIED_BALANCED');
    expect(result.action_priority).toBe('LOW');
  });

  // PATH 3: Zero-Consumption Bypass Streak with active voltage -> T2_ZeroConsumption
  it('Basis Path 3: Zero-consumption streak (>12 days) under energized voltage triggers T2_ZeroConsumption', () => {
    // 20 days normal, followed by 15 days of 0.0 kWh while line voltage = 230V
    const readings = generateReadings(35, i => (i < 20 ? 6.5 : 0.0), { voltageV: 230 });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('Theft');
    expect(result.predicted_subtype).toBe('T2_ZeroConsumption');
    expect(result.action_priority).toBe('HIGH');
    expect(result.physics_proof.kclCircuitState).toBe('VIOLATION_SHUNT_FLOW');
  });

  // PATH 4: Sudden Flatline Bypass Drop -> T4_ByPassMeter
  it('Basis Path 4: Sudden flatline drop (>45% drop with low variance) triggers T4_ByPassMeter', () => {
    // 35 days of identical flatline low consumption: drop ~55%, windowCv < 0.05
    const readings = generateReadings(35, () => 2.8, { voltageV: 228 });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('Theft');
    expect(result.predicted_subtype).toBe('T4_ByPassMeter');
    expect(result.action_priority).toBe('HIGH');
  });

  // PATH 5: Dynamic Tampering / High Variance Reduction -> T3_RandomReduction
  it('Basis Path 5: High variance reduction (drop >40% and CV > 0.30) triggers T3_RandomReduction', () => {
    // Drop base by ~50% with wild alternating fluctuations (e.g., alternating 1.0 and 5.0)
    const readings = generateReadings(35, i => (i % 2 === 0 ? 1.0 : 4.5), { voltageV: 230 });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('Theft');
    expect(result.predicted_subtype).toBe('T3_RandomReduction');
  });

  // PATH 6: Steady Baseline Reduction -> T1_PartialReduction
  it('Basis Path 6: Sustained partial reduction triggers T1_PartialReduction', () => {
    // Consistent ~35% drop below baseline (4.2 kWh vs 6.5 base), moderate variance
    const readings = generateReadings(35, i => 4.2 + (i % 3) * 0.1, { voltageV: 230 });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('Theft');
    expect(result.predicted_subtype).toBe('T1_PartialReduction');
  });

  // PATH 7: Mechanical/Digital Register Stuck At Constant -> F1_StuckAt
  it('Basis Path 7: Register frozen (>6 days identical float) without comm flags triggers F1_StuckAt', () => {
    // 8 days of identical non-zero consumption without comm flags
    const readings = generateReadings(15, i => (i >= 5 ? 5.432 : 6.0), { commFlag: false });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('FaultyMeter');
    expect(result.predicted_subtype).toBe('F1_StuckAt');
    expect(result.action_priority).toBe('MEDIUM');
    expect(result.physics_proof.kclCircuitState).toBe('REGISTER_DEGRADATION');
  });

  // PATH 8: Calibration Decay Drift -> F2_Drift
  it('Basis Path 8: Linear calibration slope decay (|slope| > 0.014) triggers F2_Drift', () => {
    // Linear downward decay: 6.5 down to 3.5 across 60 days (slope ~ -0.05)
    const readings = generateReadings(60, i => 6.5 - i * 0.05);
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('FaultyMeter');
    expect(result.predicted_subtype).toBe('F2_Drift');
  });

  // PATH 9: CT Sensor Noise / Voltage Spikes -> F3_NoiseSpike
  it('Basis Path 9: Multiple transient spikes (>2.8x mean and >12 kWh) triggers F3_NoiseSpike', () => {
    // Baseline ~5 kWh with fluctuating signal and 4 major anomalous spikes to 28 kWh
    const readings = generateReadings(30, i => ([5, 12, 18, 25].includes(i) ? 28.0 : 4.8 + (i % 3) * 0.2));
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('FaultyMeter');
    expect(result.predicted_subtype).toBe('F3_NoiseSpike');
  });

  // PATH 10: Systematic Under-Registration -> F4_UnderRegister
  it('Basis Path 10: Calibration under-registration (drop -15% to -42% with active variance) triggers F4_UnderRegister', () => {
    // Consumer archetype: 6.5 kWh. Consumption around 4.95 kWh (-23.8% drop), non-zero streak = 0, cv >= 0.08
    const readings = generateReadings(35, i => 4.2 + (i % 4) * 0.5, { voltageV: 205 }); // voltage <= 210 to isolate from theft rule
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('FaultyMeter');
    expect(result.predicted_subtype).toBe('F4_UnderRegister');
  });

  // PATH 11: Telemetry Packet Drop Ratio -> C1_MissingData
  it('Basis Path 11: Missing reading ratio >= 3% triggers C1_MissingData', () => {
    // 35 readings with 3 null entries -> 3/35 = 8.5% missing on varying background
    const readings = generateReadings(35, i => ([3, 10, 20].includes(i) ? null : 6.4 + (i % 4) * 0.1));
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('CommFailure');
    expect(result.predicted_subtype).toBe('C1_MissingData');
    expect(result.physics_proof.kclCircuitState).toBe('TELECOM_PACKET_DROP');
  });

  // PATH 12: Duplicate Stale Transmission Streak -> C2_DuplicateTransmission
  it('Basis Path 12: Consecutive identical telemetry with gateway comm flags triggers C2_DuplicateTransmission', () => {
    // 5 consecutive days of identical value with commFlag = true, background varying
    const readings = generateReadings(20, i => (i >= 5 && i <= 9 ? 5.5 : 6.0 + (i % 3) * 0.2), {
      commFlagFn: i => (i >= 5 && i <= 9),
    });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('CommFailure');
    expect(result.predicted_subtype).toBe('C2_DuplicateTransmission');
  });

  // PATH 13: Gateway Flags / Clock Skew -> C3_ClockSkew
  it('Basis Path 13: Gateway communication error flags without duplicate streak trigger C3_ClockSkew', () => {
    // Isolated comm flags on varying values
    const readings = generateReadings(20, i => 6.0 + i * 0.1, {
      commFlagFn: i => [2, 7, 14].includes(i),
    });
    const result = analyzeConsumerPhysics(dummyConsumer, readings);
    expect(result.predicted_label).toBe('CommFailure');
    expect(result.predicted_subtype).toBe('C3_ClockSkew');
  });
});

// ============================================================================
// SECTION 3: WHITE-BOX TESTING — CONTROL STRUCTURE TESTING
// ============================================================================
describe('White-Box Testing: Control Structure (Conditions & Loops)', () => {
  const baseConsumer = { id: 'C_CTRL_01', consumerType: 'residential_small', baseKwh: 6.5 };

  describe('Condition Testing (Compound Boolean Branch Coverage)', () => {
    it('evaluates duplicate streak condition: isIdentical && (r.commFlag || prev.commFlag)', () => {
      // Branch 1: isIdentical = true, commFlag = true -> duplicate streak increments
      const r1 = [
        { kwh: 5.0, commFlag: false },
        { kwh: 5.0, commFlag: true },
        { kwh: 5.0, commFlag: true },
        { kwh: 5.0, commFlag: true },
      ];
      const res1 = analyzeConsumerPhysics(baseConsumer, r1);
      expect(res1.predicted_label).toBe('CommFailure');

      // Branch 2: isIdentical = false, commFlag = true -> duplicate streak reset
      const r2 = [
        { kwh: 5.0, commFlag: true },
        { kwh: 6.0, commFlag: true },
        { kwh: 7.0, commFlag: true },
      ];
      const res2 = analyzeConsumerPhysics(baseConsumer, r2);
      expect(res2.predicted_subtype).not.toBe('C2_DuplicateTransmission');
    });

    it('evaluates hardware stuck condition: isIdentical && kwh > 0.5 && !r.commFlag && !prev.commFlag', () => {
      // Sub-clause check: if kwh <= 0.5 (near zero), it is classified as zero bypass, not stuck register
      const zeroReadings = Array.from({ length: 15 }, () => ({ kwh: 0.1, voltageV: 230, commFlag: false }));
      const resZero = analyzeConsumerPhysics(baseConsumer, zeroReadings);
      expect(resZero.predicted_subtype).toBe('T2_ZeroConsumption'); // Not F1_StuckAt

      // Sub-clause check: if commFlag is true, it does not increment currentStuckStreak
      const commStuckReadings = Array.from({ length: 15 }, () => ({ kwh: 5.0, commFlag: true }));
      const resComm = analyzeConsumerPhysics(baseConsumer, commStuckReadings);
      expect(resComm.predicted_label).toBe('CommFailure'); // Handled by telecom path
    });

    it('evaluates noise spike condition: spikeCount >= 3 && maxZeroStreak < 5', () => {
      // With maxZeroStreak < 5 and 3 major spikes on fluctuating background -> F3_NoiseSpike triggers
      const spikesWithoutZero = generateReadings(25, i => ([4, 11, 19].includes(i) ? 26.0 : 5.0 + (i % 3) * 0.2));
      const res = analyzeConsumerPhysics(baseConsumer, spikesWithoutZero);
      expect(res.predicted_label).toBe('FaultyMeter');
      expect(res.predicted_subtype).toBe('F3_NoiseSpike');
    });
  });

  describe('Loop Boundary Testing (0, 1, 2, m, n Iterations)', () => {
    it('Loop Boundary 0: Empty readings array [] handles safely without throwing', () => {
      const res = analyzeConsumerPhysics(baseConsumer, []);
      expect(res.predicted_label).toBe('CommFailure');
      expect(res.confidence).toBeDefined();
    });

    it('Loop Boundary 1: Single reading array [r1] processes safely', () => {
      const res = analyzeConsumerPhysics(baseConsumer, [{ kwh: 6.5, voltageV: 230, powerFactor: 0.95 }]);
      expect(res.predicted_label).toBe('Normal');
      expect(res.physics_proof.meanKwh).toBe(6.5);
      expect(res.physics_proof.kwhTrendSlope).toBe(0);
    });

    it('Loop Boundary 2: Minimal pair [r1, r2] validates streak and slope comparisons', () => {
      const res = analyzeConsumerPhysics(baseConsumer, [
        { kwh: 6.5, voltageV: 230, powerFactor: 0.95 },
        { kwh: 6.5, voltageV: 230, powerFactor: 0.95 },
      ]);
      expect(res.predicted_label).toBe('Normal');
      expect(res.physics_proof.stuckStreakDays).toBe(2);
    });

    it('Loop Boundary m: Typical 30-day window iterations', () => {
      const readings = Array.from({ length: 30 }, (_, i) => ({
        kwh: 6.0 + (i % 5) * 0.2,
        voltageV: 230,
        powerFactor: 0.94,
      }));
      const res = analyzeConsumerPhysics(baseConsumer, readings);
      expect(res.predicted_label).toBe('Normal');
      expect(res.physics_proof.windowMinKwh).toBeGreaterThan(0);
    });

    it('Loop Boundary n: Full 365-day annual telemetry series executes efficiently', () => {
      const startTime = performance.now();
      const readings = Array.from({ length: 365 }, (_, i) => ({
        kwh: 6.5 + Math.sin(i / 10) * 0.5,
        voltageV: 230,
        currentA: 1.2,
        powerFactor: 0.93,
        commFlag: false,
      }));
      const res = analyzeConsumerPhysics(baseConsumer, readings);
      const elapsed = performance.now() - startTime;

      expect(res.predicted_label).toBe('Normal');
      expect(elapsed).toBeLessThan(50); // High-performance execution < 50ms for 365 days
    });
  });
});

// ============================================================================
// SECTION 4: THE ART OF DEBUGGING — RESILIENCE & ERROR ISOLATION
// ============================================================================
describe('The Art of Debugging: Resilience, Edge Cases, & Null Safety', () => {
  it('handles null and undefined consumer records gracefully', () => {
    const resNull = analyzeConsumerPhysics(null, [{ kwh: 5.0 }]);
    expect(resNull.consumer_id).toBe('UNKNOWN');
    expect(resNull.predicted_label).toBeDefined();

    const resUndef = analyzeConsumerPhysics(undefined, [{ kwh: 5.0 }]);
    expect(resUndef.consumer_id).toBe('UNKNOWN');
  });

  it('handles non-array readings gracefully (null, numbers, strings)', () => {
    const resNull = analyzeConsumerPhysics({ id: 'C_DEF_01' }, null);
    expect(resNull.predicted_label).toBe('CommFailure');

    const resObj = analyzeConsumerPhysics({ id: 'C_DEF_01' }, { invalid: 'object' });
    expect(resObj.predicted_label).toBe('CommFailure');
  });

  it('defends against division by zero in variance and coefficient of variation', () => {
    // Constant 0 kWh readings -> meanKwh = 0. kwhCv divisor must not yield NaN or Infinity
    const zeroReadings = [{ kwh: 0 }, { kwh: 0 }, { kwh: 0 }];
    const res = analyzeConsumerPhysics({ id: 'C_DIV0', baseKwh: 6.5 }, zeroReadings);
    expect(Number.isFinite(res.physics_proof.kwhCv)).toBe(true);
    expect(isNaN(res.physics_proof.kwhCv)).toBe(false);
  });

  it('filters out non-numeric values and Infinity from readings without NaN corruption', () => {
    const dirtyReadings = [
      { kwh: 'invalid_string' },
      { kwh: Infinity },
      { kwh: -Infinity },
      { kwh: 6.5 },
      { kwh: null },
      { kwh: undefined },
    ];
    const res = analyzeConsumerPhysics({ id: 'C_DIRTY', baseKwh: 6.5 }, dirtyReadings);
    expect(res.physics_proof.meanKwh).toBe(6.5);
    expect(Number.isFinite(res.confidence)).toBe(true);
  });

  it('numerically stable softmax handles extremely large score differentials without Infinity/NaN', () => {
    const extremeScores = {
      Theft: 1000,
      FaultyMeter: 100,
      CommFailure: 10,
      Normal: 0,
    };
    const probs = calculateSoftmaxProbabilities(extremeScores);
    expect(probs.Theft).toBe(1.0);
    expect(probs.FaultyMeter).toBe(0.0);
    expect(isNaN(probs.Theft)).toBe(false);
  });
});
