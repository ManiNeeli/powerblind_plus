require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

let server;
if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`[api] PowerBlind+ API listening on http://localhost:${PORT}`);
    console.log(`[api] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[api] ML Service: ${process.env.ML_SERVICE_URL || 'http://localhost:8000'}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[api] SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('[api] Server closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    if (server) server.close(() => process.exit(0));
  });
}

module.exports = app;

