/**
 * Enterprise Input Sanitizer & Security Shield
 * 
 * Protects against:
 * 1. NoSQL Injection: Strips MongoDB operator keys (starting with '$' or containing '.')
 * 2. Stored & Reflected XSS: Strips script blocks, javascript: pseudo-protocols,
 *    event handlers (onload, onerror, etc.), and dangerous HTML tags.
 * 3. Null-Byte & Control Character Injection: Strips \0 and non-printable control chars.
 * 
 * Runs automatically on req.body, req.query, and req.params before route execution.
 */

// Regex patterns for XSS vectors
const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const DANGEROUS_TAGS_REGEX = /<\/?(script|iframe|embed|object|applet|meta|link|style)\b[^>]*>/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
const JS_PROTOCOL_REGEX = /javascript\s*:[^"'\s]*/gi;

/**
 * Sanitizes a single string against XSS, null bytes, and malicious control chars.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // 1. Remove null bytes and carriage-return / terminal escapes
  let clean = str.replace(/\0/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // 2. Strip explicit script blocks
  clean = clean.replace(SCRIPT_REGEX, '');

  // 3. Strip dangerous embedding tags
  clean = clean.replace(DANGEROUS_TAGS_REGEX, '');

  // 4. Strip inline event handlers (onerror, onload, onclick, etc.)
  clean = clean.replace(EVENT_HANDLER_REGEX, '');

  // 5. Strip javascript: pseudo-protocols
  clean = clean.replace(JS_PROTOCOL_REGEX, '');

  return clean.trim();
}

/**
 * Recursively sanitizes data structures and strips NoSQL operator keys ($ and .).
 */
function sanitize(obj) {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  if (obj && typeof obj === 'object') {
    // If it's a Date or RegExp, return as is
    if (obj instanceof Date || obj instanceof RegExp) return obj;

    const out = {};
    for (const [key, val] of Object.entries(obj)) {
      // NoSQL injection prevention: discard keys that start with '$' or contain '.'
      if (key.startsWith('$') || key.includes('.')) {
        console.warn(`[security] Blocked potential NoSQL injection key: "${key}"`);
        continue;
      }
      out[key] = sanitize(val);
    }
    return out;
  }

  return obj;
}

function sanitizeMiddleware(req, _res, next) {
  if (req.body)   req.body   = sanitize(req.body);
  if (req.query)  req.query  = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
}

module.exports = { sanitize, sanitizeString, sanitizeMiddleware };

