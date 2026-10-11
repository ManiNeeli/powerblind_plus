/**
 * PowerBlind+ Vercel Catch-All Serverless Route Handler
 *
 * Forwards any nested /api/* routes directly to the main Express app handler.
 */

const handler = require('./index');

module.exports = (req, res) => {
  return handler(req, res);
};
