/**
 * Centralised error handling — Phase 2 hardened version.
 *
 * Rules:
 * - NEVER send stack traces to clients
 * - Always return { error: { code, message, fields? } }
 * - Log full error + requestId server-side
 * - Map known error types (Prisma, Zod, JWT) to clean HTTP codes
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode   = statusCode;
    this.code         = code;
    this.isOperational = true;
  }
}

function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const reqId = req.requestId ?? '—';

  // Server-side logging (full detail, never sent to client)
  if (process.env.NODE_ENV !== 'test') {
    if (!err.isOperational) {
      console.error(`[error][${reqId}] UNEXPECTED:`, err.message);
      console.error(err.stack);
    } else {
      console.warn(`[warn][${reqId}] ${err.statusCode} ${err.code}: ${err.message}`);
    }
  }

  // ── Prisma errors ──────────────────────────────────────────────────────────
  if (err.code === 'P2025')
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Record not found.' } });
  if (err.code === 'P2002')
    return res.status(409).json({ error: { code: 'CONFLICT',  message: 'A record with that value already exists.' } });
  if (err.code === 'P2003')
    return res.status(422).json({ error: { code: 'INVALID_RELATION', message: 'Related record not found.' } });

  // ── Zod validation ─────────────────────────────────────────────────────────
  if (err.name === 'ZodError')
    return res.status(422).json({
      error: {
        code:    'VALIDATION_ERROR',
        message: 'Invalid request data.',
        fields:  err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
      },
    });

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError')
    return res.status(401).json({ error: { code: 'INVALID_TOKEN',  message: 'Invalid or malformed token.' } });
  if (err.name === 'TokenExpiredError')
    return res.status(401).json({ error: { code: 'TOKEN_EXPIRED',  message: 'Token has expired.' } });
  if (err.name === 'NotBeforeError')
    return res.status(401).json({ error: { code: 'TOKEN_NOT_ACTIVE', message: 'Token not yet valid.' } });

  // ── CORS error ─────────────────────────────────────────────────────────────
  if (err.message?.startsWith('CORS:'))
    return res.status(403).json({ error: { code: 'CORS_BLOCKED', message: 'Origin not allowed.' } });

  // ── Operational (intentional AppErrors) ───────────────────────────────────
  if (err.isOperational)
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });

  // ── Unexpected — safe generic message ─────────────────────────────────────
  return res.status(500).json({
    error: {
      code:    'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      ref:     reqId,   // lets operator cross-reference server logs without exposing internals
    },
  });
}

module.exports = { AppError, notFound, errorHandler };
