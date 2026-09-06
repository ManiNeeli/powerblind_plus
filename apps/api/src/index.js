require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
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
  server.close(() => process.exit(0));
});
