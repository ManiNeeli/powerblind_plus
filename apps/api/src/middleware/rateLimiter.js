const rateLimit = require('express-rate-limit');

const json429 = (msg) => (_req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: msg } });

const isTest = () => process.env.NODE_ENV === 'test';
const isBypassed = () => process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';

/** Strict auth limiter — login / refresh / change-password */
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             process.env.NODE_ENV === 'production' ? 10 : 500,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            () => process.env.NODE_ENV === 'test',
  handler:         json429('Too many attempts. Please wait 15 minutes.'),
});

/** Prediction endpoint — ML calls are expensive */
const predictLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             process.env.NODE_ENV === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            isTest,
  handler:         json429('Too many prediction requests. Slow down.'),
});

/** General API limiter — broad protection */
const apiLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            isTest,
  handler:         json429('Too many requests. Please slow down.'),
});

module.exports = { authLimiter, predictLimiter, apiLimiter };
