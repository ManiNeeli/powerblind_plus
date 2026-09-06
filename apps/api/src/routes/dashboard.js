const express    = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { requireAuth }     = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/summary
router.get('/summary', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();

    const [labelGroups, topRisk, recentInspections, totalConsumers] = await Promise.all([
      prisma.consumer.groupBy({ by: ['groundTruthLabel'], _count: { id: true } }),
      prisma.consumer.findMany({
        where:   { groundTruthLabel: { in: ['Theft', 'FaultyMeter', 'CommFailure'] } },
        take:    20,
        orderBy: [{ groundTruthLabel: 'asc' }, { id: 'asc' }],
        include: {
          predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
          inspections: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.inspection.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.consumer.count(),
    ]);

    // Build counts
    const counts = { Normal: 0, Theft: 0, FaultyMeter: 0, CommFailure: 0 };
    for (const g of labelGroups) {
      if (g.groundTruthLabel) counts[g.groundTruthLabel] = g._count.id;
    }

    // 30-day trend — spread anomaly windows across days
    const trend = build30DayTrend(topRisk);

    // Inspection breakdown
    const [confirmedCount, falsePosCount, queuedCount] = await Promise.all([
      prisma.inspection.count({ where: { status: 'CONFIRMED' } }),
      prisma.inspection.count({ where: { status: 'FALSE_POSITIVE' } }),
      prisma.inspection.count({ where: { status: 'QUEUED' } }),
    ]);

    res.json({
      counts,
      totalConsumers,
      topRisk: topRisk.map(c => ({
        id:                 c.id,
        consumerType:       c.consumerType,
        groundTruthLabel:   c.groundTruthLabel,
        groundTruthSubtype: c.groundTruthSubtype,
        latestConfidence:   c.predictions[0]?.confidence ?? null,
        inspectionStatus:   c.inspections[0]?.status ?? null,
      })),
      trend,
      inspectionStats: {
        total:         confirmedCount + falsePosCount + queuedCount,
        confirmed:     confirmedCount,
        falsePositive: falsePosCount,
        queued:        queuedCount,
        lastWeek:      recentInspections,
      },
    });
  } catch (err) { next(err); }
});

function build30DayTrend(consumers) {
  const days = [];
  const now  = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days.map(dateStr => {
    const point = { date: dateStr, Theft: 0, FaultyMeter: 0, CommFailure: 0 };
    for (const c of consumers) {
      const start = c.anomalyStartDate?.toISOString().slice(0, 10);
      const end   = c.anomalyEndDate?.toISOString().slice(0, 10);
      if (start && end && dateStr >= start && dateStr <= end && c.groundTruthLabel !== 'Normal') {
        point[c.groundTruthLabel] = (point[c.groundTruthLabel] || 0) + 1;
      }
    }
    return point;
  });
}

module.exports = router;
