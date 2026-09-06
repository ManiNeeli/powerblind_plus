const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_TTL    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error(
    'JWT secrets not configured. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in .env'
  );
}

function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

/** Returns seconds until expiry from a JWT string (without verifying). */
function getExpiresIn(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return 900;
    return decoded.exp - Math.floor(Date.now() / 1000);
  } catch {
    return 900;
  }
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, getExpiresIn };
