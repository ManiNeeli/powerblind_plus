/**
 * PowerBlind+ Vercel Serverless Function Handler
 *
 * Mounts the Express application to run on Vercel's Node.js Serverless runtime.
 * Normalizes incoming request URLs and headers for transparent routing.
 */

const path = require('path');
require('dotenv').config();

const app = require('../apps/api/src/app');

module.exports = (req, res) => {
  // Support both direct rewrites and Vercel routing headers
  const matchedPath = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'] || req.headers['x-forwarded-uri'];
  if (matchedPath && matchedPath.startsWith('/api') && req.url !== matchedPath) {
    req.url = matchedPath;
  }
  return app(req, res);
};
