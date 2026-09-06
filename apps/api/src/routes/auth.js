require('dotenv').config();
const express = require('express');
const { getPrismaClient } = require('@powerblind/db');
const { AppError }        = require('../middleware/errorHandler');
const { requireAuth }     = require('../middleware/auth');
const { authLimiter }     = require('../middleware/rateLimiter');
const {
  signAccessToken, signRefreshToken,
  verifyRefreshToken, getExpiresIn,
} = require('../lib/jwt');
const { comparePassword, hashPassword, validatePassword } = require('../lib/password');
const { validate, loginSchema, changePasswordSchema }     = require('../lib/validate');
const { audit } = require('../lib/audit');

const router = express.Router();

const MAX_FAILED   = 5;
const LOCK_MINUTES = 15;

function setRefreshCookie(res, token, rememberMe) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/api/auth',
    ...(rememberMe ? { maxAge: 7 * 24 * 60 * 60 * 1000 } : {}),
  });
}

function safeUser(user) {
  const { passwordHash, failedLoginCount, ...safe } = user;
  return safe;
}

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  const { email, password, rememberMe } = req.body;
  const prisma = getPrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always compare to prevent timing attacks on user enumeration
    const dummyHash = '$2b$12$invalidhashpaddingtomaintaintiming00000000000000000000';
    const valid = await comparePassword(password, user?.passwordHash ?? dummyHash);

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await audit(user.id, 'LOGIN_LOCKED', { email }, req);
      return next(new AppError('Account is temporarily locked. Contact an administrator.', 423, 'ACCOUNT_LOCKED'));
    }

    if (!user || !valid) {
      if (user) {
        const failed      = user.failedLoginCount + 1;
        const lockedUntil = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
        await prisma.user.update({
          where: { id: user.id },
          data:  { failedLoginCount: failed, ...(lockedUntil ? { lockedUntil } : {}) },
        });
        if (lockedUntil) await audit(user.id, 'ACCOUNT_LOCKED', { email, attempts: failed }, req);
      }
      await audit(user?.id ?? null, 'LOGIN_FAILED', { email }, req);
      return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    // Reset on success
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });

    const payload      = { sub: user.id, email: user.email, role: user.role };
    const accessToken  = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresIn    = getExpiresIn(accessToken);

    setRefreshCookie(res, refreshToken, rememberMe);
    await audit(user.id, 'LOGIN_SUCCESS', { email }, req);
    return res.json({ accessToken, expiresIn, user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', authLimiter, async (req, res, next) => {
  const token = req.cookies?.refreshToken;
  if (!token) return next(new AppError('No refresh token.', 401, 'UNAUTHENTICATED'));
  try {
    const decoded     = verifyRefreshToken(token);
    const prisma      = getPrismaClient();
    const user        = await prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user) return next(new AppError('User not found.', 401, 'UNAUTHENTICATED'));

    const payload     = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const expiresIn   = getExpiresIn(accessToken);
    return res.json({ accessToken, expiresIn, user: safeUser(user) });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    await audit(req.user?.sub ?? null, 'LOGOUT', null, req);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', requireAuth, authLimiter, validate(changePasswordSchema), async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const prisma = getPrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));

    const valid = await comparePassword(currentPassword, user.passwordHash);
    if (!valid) return next(new AppError('Current password is incorrect.', 400, 'INVALID_CREDENTIALS'));

    const policyErr = validatePassword(newPassword);
    if (policyErr) return next(new AppError(policyErr, 422, 'VALIDATION_ERROR'));

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await audit(user.id, 'PASSWORD_CHANGED', null, req);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const prisma = getPrismaClient();
    const user   = await prisma.user.findUnique({
      where:  { id: req.user.sub },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    return res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;
