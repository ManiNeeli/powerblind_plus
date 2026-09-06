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
    await prisma.$queryRaw`SELECT 1`;
    status.checks.database = { status: 'ok' };
  } catch (err) {
    status.checks.database = { status: 'error', message: err.message };
  }

  // ML service connectivity check (non-blocking — just pings the ML health endpoint)
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const mlRes = await fetch(`${mlUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    status.checks.mlService = {
      status: mlRes.ok ? 'ok' : 'degraded',
      url: mlUrl,
    };
  } catch {
    // ML service not required for API to function (falls back to mock predictor)
    status.checks.mlService = {
      status: 'unavailable',
      url: mlUrl,
      note: 'Mock predictor will be used',
    };
  }

  const isHealthy = status.checks.database.status === 'ok';
  res.status(isHealthy ? 200 : 503).json(status);
});

module.exports = router;
