const express = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { AppError } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { hashPassword, validatePassword } = require('../lib/password');
const { validate, createUserSchema } = require('../lib/validate');
const { audit } = require('../lib/audit');

const router = express.Router();

// All user management routes require Admin
router.use(requireAuth, requireRole('ADMIN'));

function safeUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const users  = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, failedLoginCount: true, lockedUntil: true, createdAt: true },
    });
    res.json({ users });
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', validate(createUserSchema), async (req, res, next) => {
  const { email, password, role } = req.body;
  try {
    const policyErr = validatePassword(password);
    if (policyErr) return next(new AppError(policyErr, 422, 'VALIDATION_ERROR'));

    const prisma       = getPrismaClient();
    const passwordHash = await hashPassword(password);
    const user         = await prisma.user.create({ data: { email, passwordHash, role } });

    await audit(req.user.sub, 'USER_CREATED', { targetEmail: email, role }, req);
    res.status(201).json({ user: safeUser(user) });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/role
router.patch('/:id/role', async (req, res, next) => {
  const { role } = req.body;
  if (!['OPERATOR', 'ADMIN'].includes(role))
    return next(new AppError('role must be OPERATOR or ADMIN.', 422, 'VALIDATION_ERROR'));

  try {
    const prisma = getPrismaClient();
    const user   = await prisma.user.update({
      where: { id: req.params.id },
      data:  { role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    await audit(req.user.sub, 'ROLE_CHANGED', { targetId: user.id, newRole: role }, req);
    res.json({ user });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/unlock
router.patch('/:id/unlock', async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const user   = await prisma.user.update({
      where: { id: req.params.id },
      data:  { lockedUntil: null, failedLoginCount: 0 },
      select: { id: true, email: true, role: true },
    });
    await audit(req.user.sub, 'ACCOUNT_UNLOCKED', { targetId: user.id }, req);
    res.json({ user });
  } catch (err) { next(err); }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res, next) => {
  if (req.params.id === req.user.sub)
    return next(new AppError('You cannot delete your own account.', 400, 'FORBIDDEN'));

  try {
    const prisma = getPrismaClient();
    await prisma.user.delete({ where: { id: req.params.id } });
    await audit(req.user.sub, 'USER_DELETED', { targetId: req.params.id }, req);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
