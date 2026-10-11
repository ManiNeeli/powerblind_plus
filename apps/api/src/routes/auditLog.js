const express = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

// GET /api/audit-log
router.get('/', async (req, res, next) => {
  try {
    const prisma  = getPrismaClient();
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 50);
    const action  = req.query.action;
    const actorId = req.query.actorId;

    const where = {
      ...(action  && { action }),
      ...(actorId && { actorId }),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const shaped = logs.map(l => {
      let parsedMeta = null;
      if (typeof l.metadata === 'string') {
        try { parsedMeta = JSON.parse(l.metadata); } catch { parsedMeta = l.metadata; }
      } else if (l.metadata && typeof l.metadata === 'object') {
        parsedMeta = l.metadata;
      }
      return {
        id:         l.id,
        action:     l.action,
        actorId:    l.actorId,
        actorEmail: l.actor?.email ?? null,
        actorRole:  l.actor?.role  ?? null,
        metadata:   parsedMeta,
        ip:         l.ip,
        createdAt:  l.createdAt,
      };
    });

    res.json({ logs: shaped, total, page, limit });
  } catch (err) { next(err); }
});

module.exports = router;
