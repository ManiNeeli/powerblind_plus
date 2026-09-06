const express = require('express');
const { getPrismaClient }  = require('@powerblind/db');
const { requireAuth }      = require('../middleware/auth');
const { validate, createInspectionSchema, updateInspectionSchema } = require('../lib/validate');
const { audit } = require('../lib/audit');

const router = express.Router();
router.use(requireAuth);

// GET /api/inspections
router.get('/', async (req, res, next) => {
  try {
    const prisma  = getPrismaClient();
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(50, parseInt(req.query.limit) || 25);
    const status  = req.query.status;
    const where   = status ? { status } : {};

    const [inspections, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          consumer: { select: { id: true, consumerType: true, groundTruthLabel: true, groundTruthSubtype: true } },
          operator: { select: { id: true, email: true } },
        },
      }),
      prisma.inspection.count({ where }),
    ]);

    res.json({ inspections, total, page, limit });
  } catch (err) { next(err); }
});

// POST /api/inspections
router.post('/', validate(createInspectionSchema), async (req, res, next) => {
  const { consumerId, status, notes } = req.body;
  try {
    const prisma = getPrismaClient();

    // Verify consumer exists before creating inspection
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) {
      const { AppError } = require('../middleware/errorHandler');
      return next(new AppError(`Consumer ${consumerId} not found.`, 404, 'NOT_FOUND'));
    }

    const inspection = await prisma.inspection.create({
      data: { consumerId, operatorId: req.user.sub, status, notes },
      include: {
        consumer: { select: { id: true, groundTruthLabel: true } },
        operator: { select: { email: true } },
      },
    });

    await audit(req.user.sub, 'INSPECTION_LOGGED', { consumerId, status }, req);
    res.status(201).json({ inspection });
  } catch (err) { next(err); }
});

// PATCH /api/inspections/:id
router.patch('/:id', validate(updateInspectionSchema), async (req, res, next) => {
  const { status, notes } = req.body;
  try {
    const prisma = getPrismaClient();
    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data:  {
        ...(status !== undefined && { status }),
        ...(notes  !== undefined && { notes  }),
      },
    });
    await audit(req.user.sub, 'INSPECTION_UPDATED', { id: req.params.id, status }, req);
    res.json({ inspection });
  } catch (err) { next(err); }
});

// GET /api/inspections/:id
router.get('/:id', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const inspection = await prisma.inspection.findUnique({
      where:   { id: req.params.id },
      include: {
        consumer: true,
        operator: { select: { email: true, role: true } },
      },
    });
    if (!inspection) {
      const { AppError } = require('../middleware/errorHandler');
      return next(new AppError('Inspection not found.', 404, 'NOT_FOUND'));
    }
    res.json({ inspection });
  } catch (err) { next(err); }
});

module.exports = router;
