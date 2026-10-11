const express = require('express');
const { getPrismaClient }  = require('@powerblind/db');
const { AppError }         = require('../middleware/errorHandler');
const { requireAuth }      = require('../middleware/auth');
const { predictLimiter }   = require('../middleware/rateLimiter');
const { validate, consumerListSchema } = require('../lib/validate');

const router = express.Router();
router.use(requireAuth);

// GET /api/consumers
router.get('/', validate(consumerListSchema, 'query'), async (req, res, next) => {
  const { page, limit, label, consumerType, search } = req.validatedQuery;
  const where = {
    ...(label        && { groundTruthLabel: label }),
    ...(consumerType && { consumerType }),
    ...(search       && { id: { contains: search.toUpperCase() } }),
  };
  try {
    const prisma = getPrismaClient();
    const [consumers, total] = await Promise.all([
      prisma.consumer.findMany({
        where, skip: (page-1)*limit, take: limit, orderBy: { id: 'asc' },
        include: {
          predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
          inspections: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.consumer.count({ where }),
    ]);
    res.json({
      consumers: consumers.map(c => ({
        id: c.id, consumerType: c.consumerType, baseKwh: c.baseKwh,
        groundTruthLabel: c.groundTruthLabel, groundTruthSubtype: c.groundTruthSubtype,
        anomalyStartDate: c.anomalyStartDate, anomalyEndDate: c.anomalyEndDate,
        latestConfidence: c.predictions[0]?.confidence ?? null,
        latestPredictedLabel: c.predictions[0]?.predictedLabel ?? null,
        inspectionStatus: c.inspections[0]?.status ?? null,
      })),
      total, page, limit,
    });
  } catch (err) { next(err); }
});

// GET /api/consumers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const prisma   = getPrismaClient();
    const consumer = await prisma.consumer.findUnique({
      where: { id: req.params.id },
      include: {
        predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
        inspections: {
          orderBy: { createdAt: 'desc' }, take: 5,
          include: { operator: { select: { email: true } } },
        },
        _count: { select: { readings: true } },
      },
    });
    if (!consumer) return next(new AppError(`Consumer ${req.params.id} not found.`, 404, 'NOT_FOUND'));

    const latestPrediction = consumer.predictions[0]
      ? { ...consumer.predictions[0], topFeatures: JSON.parse(consumer.predictions[0].topFeatures) }
      : null;

    res.json({ ...consumer, predictions: undefined, latestPrediction, readingCount: consumer._count.readings, _count: undefined });
  } catch (err) { next(err); }
});

// GET /api/consumers/:id/timeseries
router.get('/:id/timeseries', async (req, res, next) => {
  try {
    const prisma   = getPrismaClient();
    const consumer = await prisma.consumer.findUnique({ where: { id: req.params.id } });
    if (!consumer) return next(new AppError(`Consumer ${req.params.id} not found.`, 404, 'NOT_FOUND'));

    const readings = await prisma.reading.findMany({
      where: { consumerId: req.params.id }, orderBy: { date: 'asc' },
      select: { date:true, kwh:true, voltageV:true, currentA:true, powerFactor:true, commFlag:true, label:true, anomalySubtype:true },
    });

    const toDateStr = (d) => {
      if (!d) return '';
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d).slice(0, 10); }
    };

    res.json({
      consumerId: req.params.id,
      readings: readings.map(r => ({
        date:          toDateStr(r.date),
        kwh:           r.kwh,
        voltageV:      r.voltageV,
        currentA:      r.currentA,
        powerFactor:   r.powerFactor,
        commFlag:      r.commFlag,
        label:         r.label,
        anomalySubtype: r.anomalySubtype,
      })),
    });
  } catch (err) { next(err); }
});

// GET /api/consumers/:id/predictions — history
router.get('/:id/predictions', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const preds  = await prisma.prediction.findMany({
      where: { consumerId: req.params.id }, orderBy: { createdAt: 'desc' }, take: limit,
    });
    res.json({ predictions: preds.map(p => ({ ...p, topFeatures: JSON.parse(p.topFeatures) })) });
  } catch (err) { next(err); }
});

const { analyzeConsumerPhysics } = require('../lib/physicsEngine');

// GET /api/consumers/:id/predict
router.get('/:id/predict', predictLimiter, async (req, res, next) => {
  const prisma = getPrismaClient();
  try {
    const consumer = await prisma.consumer.findUnique({ where: { id: req.params.id } });
    if (!consumer) return next(new AppError(`Consumer ${req.params.id} not found.`, 404, 'NOT_FOUND'));

    // Fetch consumer readings for physical evaluation
    const readings = await prisma.reading.findMany({
      where: { consumerId: req.params.id },
      orderBy: { date: 'asc' },
    });

    // Compute physics-grounded prediction & circuit proof
    const physicsPrediction = analyzeConsumerPhysics(consumer, readings);

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    let prediction = physicsPrediction;

    try {
      const resp = await fetch(`${mlUrl}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_id:          consumer.id,
          consumer_type:        consumer.consumerType,
          mean_kwh:             physicsPrediction.physics_proof.meanKwh,
          std_kwh:              physicsPrediction.physics_proof.stdKwh,
          min_kwh:              physicsPrediction.physics_proof.windowMinKwh,
          max_kwh:              physicsPrediction.physics_proof.maxKwh,
          kwh_range:            physicsPrediction.physics_proof.kwhRange,
          kwh_iqr:              physicsPrediction.physics_proof.kwhIqr,
          kwh_trend_slope:      physicsPrediction.physics_proof.kwhTrendSlope,
          mean_voltage:         physicsPrediction.physics_proof.meanVoltage,
          std_voltage:          physicsPrediction.physics_proof.stdVoltage,
          mean_current:         physicsPrediction.physics_proof.meanCurrent,
          mean_power_factor:    physicsPrediction.physics_proof.meanPowerFactor,
          std_pf:               physicsPrediction.physics_proof.stdPf,
          pf_below_09_ratio:    physicsPrediction.physics_proof.pfBelow09Ratio,
          missing_ratio:        physicsPrediction.physics_proof.missingRatio,
          comm_flag_ratio:      physicsPrediction.physics_proof.commFlagRatio,
          max_missing_streak:   physicsPrediction.physics_proof.maxMissingStreak,
          peak_to_avg_ratio:    physicsPrediction.physics_proof.peakToAvgRatio,
          baseline_deviation:   physicsPrediction.physics_proof.baselineDeviationPct / 100,
          ground_truth_label:   consumer.groundTruthLabel,
          ground_truth_subtype: consumer.groundTruthSubtype,
        }), signal: AbortSignal.timeout(3_000),
      });
      if (resp.ok) {
        const mlData = await resp.json();
        const proof = physicsPrediction.physics_proof;
        const isPhysicallyNormal = (
          proof &&
          proof.kclCircuitState === 'VERIFIED_BALANCED' &&
          Math.abs(proof.baselineDeviationPct) < 18 &&
          proof.zeroStreakDays < 3 &&
          proof.stuckStreakDays < 4 &&
          proof.missingRatio < 0.02
        );

        // If physics proves balanced circuit, enforce Normal. If physics confirms definite circuit
        // anomaly (e.g. stuck register, packet drop, zero shunt), prioritize physical proof.
        // Otherwise use ML predicted label.
        const verifiedLabel = isPhysicallyNormal
          ? 'Normal'
          : ((physicsPrediction.predicted_label !== 'Normal' && proof && proof.kclCircuitState !== 'NORMAL_IMPEDANCE')
              ? physicsPrediction.predicted_label
              : (mlData.predicted_label || physicsPrediction.predicted_label));

        prediction = {
          ...physicsPrediction,
          ...mlData,
          predicted_label:      verifiedLabel,
          predicted_subtype:    physicsPrediction.predicted_subtype || mlData.predicted_subtype,
          confidence:           Math.max(mlData.confidence || 0, physicsPrediction.confidence),
          class_probabilities:  mlData.class_probabilities || physicsPrediction.class_probabilities,
          recommendation:       physicsPrediction.recommendation || mlData.recommendation,
          physics_proof:        physicsPrediction.physics_proof,
        };
      }
    } catch {
      // ML service not reachable — seamlessly rely on the verified Physics Engine
      prediction = physicsPrediction;
    }

    const saved = await prisma.prediction.create({
      data: {
        consumerId:       consumer.id,
        predictedLabel:   prediction.predicted_label,
        predictedSubtype: prediction.predicted_subtype ?? null,
        confidence:       prediction.confidence,
        topFeatures:      JSON.stringify(prediction.top_features ?? []),
        recommendation:   prediction.recommendation,
        modelVersion:     prediction.model_version,
        source:           prediction.source,
      },
    });

    res.json({
      ...saved,
      topFeatures:         JSON.parse(saved.topFeatures),
      classProbabilities:  prediction.class_probabilities ?? null,
      actionPriority:      prediction.action_priority     ?? null,
      physicsProof:        prediction.physics_proof       ?? null,
    });
  } catch (err) { next(err); }
});

// POST /api/consumers/batch-predict
router.post('/batch-predict', predictLimiter, async (req, res, next) => {
  const { consumerIds } = req.body;
  if (!Array.isArray(consumerIds) || consumerIds.length === 0 || consumerIds.length > 50) {
    return next(new AppError('consumerIds must be an array of 1–50 IDs.', 422, 'VALIDATION_ERROR'));
  }
  try {
    const prisma    = getPrismaClient();
    const consumers = await prisma.consumer.findMany({ where: { id: { in: consumerIds } } });

    const predictions = await Promise.all(consumers.map(async c => {
      const readings = await prisma.reading.findMany({
        where: { consumerId: c.id },
        orderBy: { date: 'asc' },
      });
      return analyzeConsumerPhysics(c, readings);
    }));

    // Persist all predictions
    const saved = await Promise.all(predictions.map(p =>
      prisma.prediction.create({
        data: {
          consumerId:       p.consumer_id,
          predictedLabel:   p.predicted_label,
          predictedSubtype: p.predicted_subtype ?? null,
          confidence:       p.confidence,
          topFeatures:      JSON.stringify(p.top_features ?? []),
          recommendation:   p.recommendation,
          modelVersion:     p.model_version,
          source:           p.source,
        },
      }).catch(() => null)
    ));

    res.json({ results: saved.filter(Boolean).length, total: consumerIds.length });
  } catch (err) { next(err); }
});

module.exports = router;

