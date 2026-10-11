const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { sanitizeMiddleware }     = require('./middleware/sanitize');
const { requestContext }         = require('./middleware/requestContext');
const { apiLimiter }             = require('./middleware/rateLimiter');

const app = express();

// Disable Express fingerprinting header (Debug/Info Leak prevention)
app.disable('x-powered-by');

// Enterprise Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4000", "http://127.0.0.1:4000", "http://localhost:8000", "http://127.0.0.1:8000", "https://*.vercel.app"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));

// Strict CORS Configuration
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4000', 'http://127.0.0.1:4000'];
const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser requests (Postman, curl, internal ping), approved origins, or Vercel deployments
    const isVercelDomain = origin && /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin);
    if (!origin || allowedOrigins.includes(origin) || isVercelDomain) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: Origin ${origin} not permitted`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
  maxAge: 86400, // 24-hour preflight cache
}));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(requestContext);
app.use(sanitizeMiddleware);

// Route prefix normalization for Vercel Services & direct routing
app.use((req, res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use('/api', apiLimiter);
}

app.use('/api/health',      require('./routes/health'));
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/consumers',   require('./routes/consumers'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/audit-log',   require('./routes/auditLog'));
app.use('/api/model',       require('./routes/model'));
app.use('/api/export',      require('./routes/export'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
