const express = require('express');
const router = express.Router();
const { getPrismaClient } = require('@powerblind/db');

/**
 * GET /api/health
 * Public endpoint — used by load balancers, uptime monitors, and the
 * Admin Model Health panel to confirm the API is alive.
 *
 * Returns a structured JSON payload so callers can distinguish between
 * "service is up but DB is degraded" and "service is fully healthy".
 */
router.get('/', async (req, res) => {
  const status = {
    service: 'powerblind-api',
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks: {},
  };

  // Database connectivity check
  try {
    const prisma = getPrismaClient();
    if (prisma.$queryRaw) {
      await prisma.$queryRaw`SELECT 1`;
    }
    status.checks.database = { status: 'ok', engine: prisma.isMongo ? 'mongodb' : 'prisma' };
  } catch (err) {
    // Sanitize: never leak internal DB error strings or credentials
    status.checks.database = { status: 'error', message: 'Database service unreachable' };
  }

  // ML service connectivity check (bound via Vercel services: ML_SERVICE_URL)
  const mlBase = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  const mlHealthUrl = new URL('health', mlBase.endsWith('/') ? mlBase : `${mlBase}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const mlRes = await fetch(mlHealthUrl, { signal: controller.signal });
    status.checks.mlService = {
      status: mlRes.ok ? 'ok' : 'degraded',
      url: mlBase,
    };
  } catch {
    // ML service not required for API to function (falls back to mock predictor)
    status.checks.mlService = {
      status: 'unavailable',
      url: mlBase,
      note: 'Mock predictor will be used',
    };
  } finally {
    clearTimeout(timeout);
  }

  const isHealthy = status.checks.database.status === 'ok';
  res.status(isHealthy ? 200 : 503).json(status);
});

module.exports = router;
