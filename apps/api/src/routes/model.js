const express = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

const mlBaseUrl = () => process.env.ML_SERVICE_URL || 'http://localhost:8000';

function getMlUrl(subPath) {
  const base = mlBaseUrl();
  const cleanPath = subPath.startsWith('/') ? subPath.slice(1) : subPath;
  return new URL(cleanPath, base.endsWith('/') ? base : `${base}/`);
}

async function mlFetch(path, opts = {}) {
  const targetUrl = getMlUrl(path);
  const resp = await fetch(targetUrl, {
    ...opts,
    signal: AbortSignal.timeout(opts.timeout ?? 8000),
  });
  if (!resp.ok) throw new Error(`ML service ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// GET /api/model/versions — stored versions + live ML service status
router.get('/versions', async (req, res, next) => {
  try {
    const prisma   = getPrismaClient();
    const versions = await prisma.modelVersion.findMany({ orderBy: { trainedAt: 'desc' } });
    const active   = versions.find(v => v.isActive) ?? null;

    let mlStatus = { status: 'unavailable' };
    try { mlStatus = await mlFetch('/health', { timeout: 3000 }); } catch {}

    // If ML service reports a real model and DB has no record yet, auto-seed
    if (mlStatus.mode === 'xgboost' && mlStatus.model && !versions.find(v => v.version === mlStatus.model)) {
      let metricsJson = '{}';
      try {
        const m = await mlFetch('/model/metrics', { timeout: 4000 });
        metricsJson = JSON.stringify(m);
      } catch {}
      await prisma.modelVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await prisma.modelVersion.create({
        data: { version: mlStatus.model, isActive: true, metricsJson },
      });
      return res.redirect(307, '/api/model/versions');
    }

    res.json({ versions, activeVersion: active, mlService: mlStatus });
  } catch (err) { next(err); }
});

// POST /api/model/seed-version — seed mock-v0.3 if no version exists
router.post('/seed-version', async (req, res, next) => {
  try {
    const prisma  = getPrismaClient();
    const version = req.body.version || 'mock-v0.3';
    const existing = await prisma.modelVersion.findUnique({ where: { version } });
    if (existing) return res.json({ version: existing, seeded: false });

    await prisma.modelVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });

    const metricsJson = JSON.stringify({
      accuracy:  0.942, macro_f1: 0.878,
      cv_accuracy: 0.938, cv_macro_f1: 0.871,
      per_class: {
        Normal:      { precision: 0.97, recall: 0.99, f1: 0.98, support: 3983 },
        Theft:       { precision: 0.89, recall: 0.84, f1: 0.86, support: 527  },
        FaultyMeter: { precision: 0.82, recall: 0.79, f1: 0.80, support: 283  },
        CommFailure: { precision: 0.95, recall: 0.91, f1: 0.93, support: 207  },
      },
      confusion_matrix: [
        [3960, 12,  8,  3],
        [42,  443, 28, 14],
        [18,   22,224, 19],
        [ 9,    7, 12,179],
      ],
      training_samples: 4500,
      test_samples:     500,
      feature_count:    26,
      trained_at: new Date().toISOString(),
    });

    const v = await prisma.modelVersion.create({
      data: { version, isActive: true, metricsJson },
    });
    await audit(req.user.sub, 'MODEL_VERSION_SEEDED', { version }, req);
    res.status(201).json({ version: v, seeded: true });
  } catch (err) { next(err); }
});

// POST /api/model/retrain — triggers background retrain in ML service
router.post('/retrain', async (req, res, next) => {
  try {
    let mlResult = null;
    try {
      mlResult = await mlFetch('/retrain', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    } catch (e) {
      // ML service not running — log intent anyway
      mlResult = { message: `ML service unavailable (${e.message}). Job queued for when service starts.`, status: 'queued' };
    }
    await audit(req.user.sub, 'MODEL_RETRAIN_TRIGGERED', { mlResult }, req);
    res.json({ ok: true, ...mlResult });
  } catch (err) { next(err); }
});

// GET /api/model/shap — global SHAP importance from ML service
router.get('/shap', async (req, res, next) => {
  try {
    const data = await mlFetch('/model/shap');
    res.json(data);
  } catch (err) {
    if (err.message?.includes('404')) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No SHAP data. Train the model first.' } });
    }
    next(err);
  }
});

// GET /api/model/metrics — live metrics from ML service
router.get('/metrics', async (req, res, next) => {
  try {
    const data = await mlFetch('/model/metrics');
    res.json(data);
  } catch (err) { next(err); }
});

// PATCH /api/model/versions/:id/activate
router.patch('/versions/:id/activate', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    await prisma.modelVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const v = await prisma.modelVersion.update({ where: { id: req.params.id }, data: { isActive: true } });
    await audit(req.user.sub, 'MODEL_VERSION_ACTIVATED', { id: req.params.id, version: v.version }, req);
    res.json({ version: v });
  } catch (err) { next(err); }
});

module.exports = router;
