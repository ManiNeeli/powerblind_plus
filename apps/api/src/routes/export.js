const express = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { requireAuth }     = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toCSV(rows, headers) {
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(h => escape(row[h])).join(','));
  return lines.join('\r\n');
}

// GET /api/export/consumers
router.get('/consumers', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const label  = req.query.label;
    const consumers = await prisma.consumer.findMany({
      where:   label ? { groundTruthLabel: label } : {},
      orderBy: { id: 'asc' },
      include: { predictions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const rows = consumers.map(c => ({
      consumer_id:          c.id,
      consumer_type:        c.consumerType,
      base_kwh:             c.baseKwh ?? '',
      ground_truth_label:   c.groundTruthLabel ?? '',
      ground_truth_subtype: c.groundTruthSubtype ?? '',
      anomaly_start_date:   c.anomalyStartDate?.toISOString().slice(0,10) ?? '',
      anomaly_end_date:     c.anomalyEndDate?.toISOString().slice(0,10) ?? '',
      anomaly_start_day:    c.anomalyStartDay ?? '',
      anomaly_end_day:      c.anomalyEndDay   ?? '',
      latest_prediction:    c.predictions[0]?.predictedLabel   ?? '',
      latest_confidence:    c.predictions[0]?.confidence       ?? '',
      latest_model:         c.predictions[0]?.modelVersion     ?? '',
    }));

    const headers = [
      'consumer_id','consumer_type','base_kwh',
      'ground_truth_label','ground_truth_subtype',
      'anomaly_start_date','anomaly_end_date',
      'anomaly_start_day','anomaly_end_day',
      'latest_prediction','latest_confidence','latest_model',
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="powerblind-consumers-${Date.now()}.csv"`);
    res.send(toCSV(rows, headers));
  } catch (err) { next(err); }
});

// GET /api/export/predictions
router.get('/predictions', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const preds  = await prisma.prediction.findMany({
      orderBy: { createdAt: 'desc' },
      take:    5000,
      include: { consumer: { select: { consumerType: true, groundTruthLabel: true } } },
    });

    const rows = preds.map(p => ({
      prediction_id:     p.id,
      consumer_id:       p.consumerId,
      consumer_type:     p.consumer?.consumerType ?? '',
      ground_truth:      p.consumer?.groundTruthLabel ?? '',
      predicted_label:   p.predictedLabel,
      predicted_subtype: p.predictedSubtype ?? '',
      confidence:        p.confidence,
      model_version:     p.modelVersion,
      source:            p.source,
      created_at:        p.createdAt.toISOString(),
    }));

    const headers = [
      'prediction_id','consumer_id','consumer_type','ground_truth',
      'predicted_label','predicted_subtype','confidence',
      'model_version','source','created_at',
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="powerblind-predictions-${Date.now()}.csv"`);
    res.send(toCSV(rows, headers));
  } catch (err) { next(err); }
});

// GET /api/export/inspections
router.get('/inspections', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const rows_  = await prisma.inspection.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        consumer: { select: { groundTruthLabel: true, groundTruthSubtype: true, consumerType: true } },
        operator: { select: { email: true } },
      },
    });

    const rows = rows_.map(i => ({
      inspection_id:      i.id,
      consumer_id:        i.consumerId,
      consumer_type:      i.consumer?.consumerType ?? '',
      ground_truth_label: i.consumer?.groundTruthLabel ?? '',
      ground_truth_subtype: i.consumer?.groundTruthSubtype ?? '',
      status:             i.status,
      notes:              i.notes ?? '',
      operator_email:     i.operator?.email ?? '',
      created_at:         i.createdAt.toISOString(),
    }));

    const headers = [
      'inspection_id','consumer_id','consumer_type',
      'ground_truth_label','ground_truth_subtype',
      'status','notes','operator_email','created_at',
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="powerblind-inspections-${Date.now()}.csv"`);
    res.send(toCSV(rows, headers));
  } catch (err) { next(err); }
});

module.exports = router;
