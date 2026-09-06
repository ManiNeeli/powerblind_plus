/**
 * Lightweight input sanitizer.
 * Recursively trims strings and blocks null-byte injection.
 * Runs before every route handler so no individual route needs to think about it.
 */
function sanitize(obj) {
  if (typeof obj === 'string') return obj.replace(/\0/g, '').trim();
  if (Array.isArray(obj))     return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    return out;
  }
  return obj;
}

function sanitizeMiddleware(req, _res, next) {
  if (req.body)  req.body  = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  next();
}

module.exports = { sanitizeMiddleware };
