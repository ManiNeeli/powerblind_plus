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

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(o=>o.trim());
app.use(cors({
  origin: (origin, cb) => (!origin || allowedOrigins.includes(origin) ? cb(null,true) : cb(new Error(`CORS: ${origin}`))),
  credentials: true,
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Request-Id'],
  exposedHeaders: ['X-Request-Id','Content-Disposition'],
}));

app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(requestContext);
app.use(sanitizeMiddleware);

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
