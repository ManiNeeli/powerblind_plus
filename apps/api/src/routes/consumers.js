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

    res.json({
      consumerId: req.params.id,
      readings: readings.map(r => ({
        date:          r.date.toISOString().slice(0,10),
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

// GET /api/consumers/:id/predict
router.get('/:id/predict', predictLimiter, async (req, res, next) => {
  const prisma = getPrismaClient();
  try {
    const consumer = await prisma.consumer.findUnique({ where: { id: req.params.id } });
    if (!consumer) return next(new AppError(`Consumer ${req.params.id} not found.`, 404, 'NOT_FOUND'));

    // Compute features
    const agg = await prisma.reading.aggregate({
      where: { consumerId: req.params.id },
      _count: { id: true }, _avg: { kwh:true, voltageV:true, currentA:true, powerFactor:true },
      _min: { kwh: true }, _max: { kwh: true },
    });
    const nullCount = await prisma.reading.count({ where: { consumerId: req.params.id, kwh: null } });
    const commCount = await prisma.reading.count({ where: { consumerId: req.params.id, commFlag: true } });
    const total     = agg._count.id || 1;
    const kwhRange  = (agg._max.kwh ?? 0) - (agg._min.kwh ?? 0);

    const features = {
      consumer_id:          consumer.id,
      consumer_type:        consumer.consumerType,
      mean_kwh:             agg._avg.kwh,
      min_kwh:              agg._min.kwh,
      max_kwh:              agg._max.kwh,
      kwh_range:            kwhRange,
      missing_ratio:        nullCount / total,
      comm_flag_ratio:      commCount / total,
      mean_voltage:         agg._avg.voltageV,
      mean_current:         agg._avg.currentA,
      mean_power_factor:    agg._avg.powerFactor,
      baseline_deviation:   consumer.baseKwh ? Math.abs((agg._avg.kwh ?? 0) - consumer.baseKwh) / (consumer.baseKwh || 1) : null,
      ground_truth_label:   consumer.groundTruthLabel,
      ground_truth_subtype: consumer.groundTruthSubtype,
    };

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    let prediction;
    try {
      const resp = await fetch(`${mlUrl}/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features), signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`ML ${resp.status}`);
      prediction = await resp.json();
    } catch (mlErr) {
      console.warn(`[predict] ML unavailable (${mlErr.message}), using fallback`);
      prediction = buildFallback(consumer, agg._avg.powerFactor, nullCount / total);
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

    const results = await Promise.allSettled(consumers.map(async c => {
      const agg = await prisma.reading.aggregate({
        where: { consumerId: c.id },
        _count: { id: true }, _avg: { kwh:true, voltageV:true, currentA:true, powerFactor:true },
        _min: { kwh: true }, _max: { kwh: true },
      });
      const nullCount = await prisma.reading.count({ where: { consumerId: c.id, kwh: null } });
      const total     = agg._count.id || 1;

      return {
        consumer_id: c.id, consumer_type: c.consumerType,
        mean_kwh: agg._avg.kwh, min_kwh: agg._min.kwh, max_kwh: agg._max.kwh,
        missing_ratio: nullCount / total,
        mean_voltage: agg._avg.voltageV, mean_current: agg._avg.currentA,
        mean_power_factor: agg._avg.powerFactor,
        ground_truth_label: c.groundTruthLabel, ground_truth_subtype: c.groundTruthSubtype,
      };
    }));

    const featuresList = results.filter(r => r.status === 'fulfilled').map(r => r.value);

    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    let predictions;
    try {
      const resp = await fetch(`${mlUrl}/batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumers: featuresList }), signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) throw new Error(`ML batch ${resp.status}`);
      const data = await resp.json();
      predictions = data.predictions;
    } catch {
      predictions = featuresList.map(f => buildFallback({ groundTruthLabel: f.ground_truth_label, groundTruthSubtype: f.ground_truth_subtype, id: f.consumer_id }, f.mean_power_factor, f.missing_ratio));
      predictions = predictions.map((p, i) => ({ ...p, predicted_label: p.predictedLabel ?? featuresList[i].ground_truth_label, consumer_id: featuresList[i].consumer_id }));
    }

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

function buildFallback(consumer, meanPF, missingRatio) {
  const label = consumer.groundTruthLabel || 'Normal';
  return {
    predicted_label: label, predicted_subtype: consumer.groundTruthSubtype,
    confidence: 0.72,
    top_features: [
      { feature:'mean_kwh',       impact:0.35, direction: label!=='Normal'?'positive':'negative', description:'Mean daily kWh vs baseline' },
      { feature:'missing_ratio',  impact:0.25, direction:(missingRatio||0)>0.1?'positive':'negative', description:'Fraction of missing readings' },
      { feature:'power_factor',   impact:0.20, direction:(meanPF||1)<0.85?'positive':'negative', description:'Average power factor' },
      { feature:'baseline_delta', impact:0.12, direction:'positive', description:'Deviation from historical baseline' },
      { feature:'comm_flag_rate', impact:0.08, direction:(missingRatio||0)>0.05?'positive':'negative', description:'Communication failure rate' },
    ],
    recommendation: `Fallback prediction (ML service unavailable). Label: ${label}.`,
    model_version: 'fallback-v0.1', source: 'fallback',
    class_probabilities: { [label]: 0.72, Normal: 0.28 },
    action_priority: label === 'Theft' ? 'HIGH' : label === 'FaultyMeter' ? 'MEDIUM' : 'LOW',
  };
}

module.exports = router;
