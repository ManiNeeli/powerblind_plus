# PowerBlind+

**Explainable Multi-Class Smart Meter Anomaly Diagnosis and Decision Support System**

PowerBlind+ is a full-stack AI application that detects electricity theft, faulty meters, and communication failures in smart meter data — explains *why* each anomaly was flagged using SHAP values — and supports utility operators in prioritising physical inspections.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         nginx (port 80/443)                 │
│                 Rate limiting · Static SPA · Reverse proxy  │
└───────────────┬─────────────────────────────────────────────┘
                │ /api/*
    ┌───────────▼──────────┐         ┌─────────────────────┐
    │   Express API :4000  │──────── │ FastAPI ML   :8000  │
    │   JWT auth · RBAC    │  HTTP   │ XGBoost + SHAP      │
    │   Zod validation     │         │ Mock fallback        │
    │   Rate limiting      │         └─────────────────────┘
    │   Audit logging      │
    └───────────┬──────────┘
                │ Prisma ORM
    ┌───────────▼──────────┐
    │  SQLite / PostgreSQL │
    │  5 000 consumers     │
    │  1.8M readings       │
    └──────────────────────┘
```

---

## Quick Start (local dev, no Docker)

### Prerequisites
- Node.js ≥ 18, npm ≥ 9
- Python ≥ 3.11 (for the ML service)

### 1. Install dependencies
```bash
git clone <repo> && cd powerblind-plus
npm install
```

### 2. Configure environment
```bash
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env

# Generate JWT secrets (run twice, use different values):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# → paste first output into JWT_ACCESS_SECRET
# → paste second output into JWT_REFRESH_SECRET
```

### 3. Set up the database + load dataset
```bash
# Place CSVs in data/ first:
#   data/powerblind_smartmeter_readings.csv   (146MB)
#   data/powerblind_consumer_labels.csv

npm run db:migrate   # creates SQLite file + all tables (~2s)
npm run db:seed      # loads 1.8M rows — takes 3–5 min, prints admin credentials
```

### 4. Start services (3 terminals)
```bash
# Terminal 1 — API
npm run dev:api          # http://localhost:4000

# Terminal 2 — Frontend
npm run dev:web          # http://localhost:5173

# Terminal 3 — ML service (optional; API falls back to mock if unavailable)
cd services/ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py           # http://localhost:8000
```

Open **http://localhost:5173** and sign in with the credentials from `npm run db:seed`.

---

## Quick Start (Docker)

```bash
cp apps/api/.env.production.example apps/api/.env
# Edit apps/api/.env — set JWT secrets and CORS_ORIGINS

docker compose build
docker compose --profile migrate up migrate   # seed DB (first run only)
docker compose up -d                          # start everything
```

Open **http://localhost** in your browser.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for HTTPS, PostgreSQL, and production setup.
See [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md) for 1-click cloud deployment on Vercel.

---

## Cloud Deployment (Vercel Multi-Services)

PowerBlind+ is configured for single-project multi-service deployment on [Vercel](https://vercel.com):

1. **Import Git Repository**: In your Vercel Dashboard, import `https://github.com/ManiNeeli/powerblind_plus`.
2. **Services Architecture (`vercel.json`)**:
   - `web` (`apps/web`): Static Vite React SPA (public at `/(.*)`).
   - `api` (`apps/api`): Node.js Express REST API (public at `/api/(.*)`).
   - `ml` (`services/ml`): FastAPI Python ML service (internal, bound to `api` via `ML_SERVICE_URL`).
3. **Required Environment Variables**:
   - `MONGODB_URI`: Cloud MongoDB Atlas connection string
   - `MONGODB_DB_NAME`: `powerblind`
   - `JWT_ACCESS_SECRET`: Secret key for access tokens
   - `JWT_REFRESH_SECRET`: Secret key for refresh tokens
   - `NODE_ENV`: `production`

---

## `make` commands

```bash
make install        # npm install
make dev-api        # start Express API
make dev-web        # start Vite frontend
make dev-ml         # start ML service
make db-seed        # seed database
make test           # run all API tests
make train          # train XGBoost model
make docker-up      # start full stack in Docker (dev mode)
make docker-prod    # start full stack in Docker (production mode)
make help           # list all targets
```

---

## Project Structure

```
powerblind-plus/
├── apps/
│   ├── api/                    # Node.js + Express REST API
│   │   ├── src/
│   │   │   ├── routes/         # auth, consumers, dashboard, inspections,
│   │   │   │                     audit-log, users, model, export, health
│   │   │   ├── middleware/     # auth (JWT), rateLimiter, sanitize,
│   │   │   │                     requestContext, errorHandler
│   │   │   └── lib/            # jwt, password, validate (Zod), audit
│   │   ├── tests/              # integration tests (vitest + supertest)
│   │   └── Dockerfile
│   │
│   └── web/                    # React + Vite + Tailwind frontend
│       ├── src/
│       │   ├── pages/          # Dashboard, Consumers, ConsumerDetail,
│       │   │                     Inspections, AuditLog, UserMgmt,
│       │   │                     ModelHealth, Settings, Login, NotFound
│       │   ├── components/
│       │   │   ├── charts/     # XAIWaterfall, ConfidenceGauge, ClassProbBar,
│       │   │   │                 PredictionHistory, GlobalSHAP
│       │   │   ├── layout/     # AppLayout, PageShell
│       │   │   └── ui/         # Badge, Skeleton, Modal, StatCard, Button,
│       │   │                     EmptyState, ErrorAlert, Pagination,
│       │   │                     ExportButton, CommandPalette, ErrorBoundary
│       │   ├── contexts/       # AuthContext, ToastContext, ThemeContext
│       │   └── hooks/          # useApi, useMutation, useDashboard,
│       │                         useConsumers, useInspections, usePrediction,
│       │                         useUsers, useAuditLog
│       └── Dockerfile
│
├── packages/
│   └── db/                     # Prisma schema + seed script
│       └── prisma/schema.prisma
│
├── services/
│   └── ml/                     # Python FastAPI ML microservice
│       ├── main.py             # Auto-detects real vs mock mode
│       ├── training/
│       │   ├── feature_engineering.py   # 26 consumer-level features
│       │   ├── train.py                 # XGBoost + SMOTE + SHAP pipeline
│       │   └── shap_explainer.py        # Per-prediction SHAP values
│       └── Dockerfile
│
├── data/                       # Dataset CSVs + data_dictionary.json
├── docker/nginx/app.conf       # nginx reverse proxy config
├── docker-compose.yml          # Full stack compose
├── docker-compose.prod.yml     # Production overrides
├── docker-compose.dev.yml      # Dev overrides (hot reload)
├── Makefile                    # Convenient commands
├── DEPLOYMENT.md               # Production deployment guide
└── README.md
```

---

## Security Design

| Concern | Implementation |
|---|---|
| Passwords | bcrypt (cost 12) — never stored in plain text |
| Sessions | Short-lived JWT access token (15 min) in memory + httpOnly refresh cookie (7 days) |
| Token refresh | Silent auto-refresh 60s before expiry; on 401 the API client retries once |
| Brute force | 5 failed logins → 15-min lockout; rate limiter (10 req/15 min) on auth endpoints |
| RBAC | Operator and Admin roles; admin-only routes enforced in both middleware and frontend |
| CORS | Explicit allowlist — no wildcard `*` |
| Input validation | Zod schemas on every endpoint |
| SQL injection | Prisma ORM parameterised queries throughout |
| Audit trail | Every login, logout, role change, inspection, and model action logged to DB |
| HTTP headers | Helmet sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| XSS | React escapes all rendered output; CSP disallows inline scripts |
| Secrets | Never in source — env vars only, .env files gitignored |

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login, returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | Cookie | Refresh access token |
| POST | `/api/auth/logout` | Optional | Clear refresh cookie |
| GET  | `/api/auth/me` | Bearer | Current user info |
| POST | `/api/auth/change-password` | Bearer | Change own password |

### Consumers
| Method | Path | Description |
|---|---|---|
| GET | `/api/consumers` | Paginated list with label/type/search filters |
| GET | `/api/consumers/:id` | Consumer detail with latest prediction |
| GET | `/api/consumers/:id/timeseries` | 365-day reading history |
| GET | `/api/consumers/:id/predictions` | Prediction history |
| GET | `/api/consumers/:id/predict` | Run prediction (ML → persist) |
| POST | `/api/consumers/batch-predict` | Batch predict up to 50 at once |

### Dashboard / Inspections / Export
| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard/summary` | Counts, trend, top-risk, inspection stats |
| GET/POST/PATCH | `/api/inspections` | Inspection CRUD |
| GET | `/api/export/consumers` | CSV download |
| GET | `/api/export/predictions` | CSV download |
| GET | `/api/export/inspections` | CSV download |

### Admin (ADMIN role only)
| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/users` | User management |
| GET | `/api/audit-log` | Paginated audit events |
| GET | `/api/model/versions` | Model version list + ML service status |
| POST | `/api/model/seed-version` | Seed a model version record |
| POST | `/api/model/retrain` | Trigger ML retraining |
| GET | `/api/model/shap` | Global SHAP feature importance |
| PATCH | `/api/model/versions/:id/activate` | Activate a model version |

---

## Dataset

5,000 consumers × 365 days = **1,825,000 readings** across 4 anomaly classes:

| Class | Count | Percentage |
|---|---|---|
| Normal | 3,983 | 79.7% |
| Theft | 527 | 10.5% |
| FaultyMeter | 283 | 5.7% |
| CommFailure | 207 | 4.1% |

12 sub-types across theft (T1–T5), faulty meter (F1–F4), and comm failure (C1–C3).

See `data/README.md` and `data/data_dictionary.json` for full documentation.

---

## ML Model

### Mock mode (default, no setup needed)
The ML service starts in mock mode when no trained model is found. It returns deterministic predictions using the ground-truth labels (for development and demo purposes).

### Real XGBoost model (Phase 4)
```bash
cd services/ml
source .venv/bin/activate
python -m training.train --n_splits 5   # 5–15 min
```

**Expected performance (5-fold CV):**

| Class | F1 |
|---|---|
| Normal | ~0.98 |
| Theft | ~0.87 |
| FaultyMeter | ~0.81 |
| CommFailure | ~0.93 |
| **Macro** | **~0.90** |

26 engineered features: kWh statistics, voltage/current/power-factor stats, missing data ratios, temporal patterns, consumer-type one-hot encoding.

---

## Tests

```bash
# Run all API integration tests
npm test -w apps/api

# Watch mode
npm run test:watch -w apps/api
```

**56 integration tests** across 4 test files:
- `auth.test.js` — login, refresh, lockout, change-password (18 tests)
- `consumers.test.js` — list, filter, timeseries, predict, dashboard (10 tests)
- `phase3.test.js` — batch-predict, CSV exports, inspection CRUD (12 tests)
- `phase4.test.js` — model versioning, RBAC, retrain, SHAP, audit trail (8+ tests)

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ | Repo scaffold, Prisma schema, 1.8M-row seed, Express + Vite skeletons |
| 2 | ✅ | JWT auth, RBAC, rate limiting, audit log, auto-refresh interceptor, toast, custom hooks |
| 3 | ✅ | End-to-end ML pipeline, XAI charts, inspection workflow, CSV exports, batch predict |
| 4 | ✅ | Real XGBoost training, SHAP explainability, model versioning, retrain pipeline |
| 5 | ✅ | Dark/light theme, responsive mobile, full accessibility (ARIA), UI polish |
| 6 | ✅ | Docker, nginx, production deployment guide, Makefile, final docs |
