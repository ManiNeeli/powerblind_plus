const { randomUUID } = require('crypto');

/**
 * Attaches a unique requestId to every request.
 * Used for log correlation — include it in every console.log call.
 */
function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

module.exports = { requestContext };
