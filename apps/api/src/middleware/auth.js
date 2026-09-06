const { verifyAccessToken } = require('../lib/jwt');
const { AppError } = require('./errorHandler');

/**
 * requireAuth — verifies the Bearer access token in the Authorization header.
 * Attaches the decoded payload to req.user.
 *
 * On failure: throws 401 (caught by errorHandler, which maps JWT errors to safe messages).
 * Never passes a raw JWT library error to the client.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    // Let errorHandler map JsonWebTokenError / TokenExpiredError to clean messages
    next(err);
  }
}

/**
 * requireRole — must be used AFTER requireAuth.
 * Rejects requests from users whose role isn't in the allowed list.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('Authentication required.', 401, 'UNAUTHENTICATED'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
