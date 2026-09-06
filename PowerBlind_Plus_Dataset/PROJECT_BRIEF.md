# PowerBlind+: Explainable Multi-Class Smart Meter Anomaly Diagnosis and
# Decision Support System for Electricity Distribution Networks

## ROLE
You are building a full-stack web application for me, end to end. Work in
phases (below), confirming with me briefly between phases rather than
building everything silently in one shot. Ask me clarifying questions only
when something blocks progress — otherwise make sensible defaults and note
the assumption.

## PROBLEM STATEMENT
Electricity distribution companies suffer significant financial losses due
to electricity theft, faulty meters, and communication failures. Most
existing systems only classify consumers as "Theft" or "No Theft" and act
as black-box models, making it difficult for utility operators to
understand the reason behind anomalies and prioritize inspections.

PowerBlind+ is an AI-driven, explainable, multi-class anomaly diagnosis
framework that detects different types of smart meter anomalies, explains
the reasoning behind each prediction, and assists utility companies in
operational decision-making (e.g., which consumers to physically inspect
first, and why).

## ANOMALY CLASSES (ground truth taxonomy — already defined)
- **Normal** — no anomaly
- **Theft** (5 sub-types): T1_PartialReduction, T2_ZeroConsumption,
  T3_RandomReduction, T4_ByPassMeter, T5_ReverseTamper
- **FaultyMeter** (4 sub-types): F1_StuckAt, F2_Drift, F3_NoiseSpike,
  F4_UnderRegister
- **CommFailure** (3 sub-types): C1_MissingData, C2_DuplicateTransmission,
  C3_ClockSkew

## DATASET
I have a generated dataset at `/data/` (or wherever I place it in the repo)
consisting of:
- `powerblind_smartmeter_readings.csv` — ~1.8M rows, one row per
  consumer-day: `consumer_id, date, consumer_type, kwh, voltage_v,
  current_a, power_factor, comm_flag, label, anomaly_subtype`
- `powerblind_consumer_labels.csv` — one row per consumer with ground-truth
  label, subtype, and anomaly date window
- `data_dictionary.json` — full column/taxonomy documentation
- `generate_dataset.py` — the generator script (reproducible, seed=42)

Read `data_dictionary.json` first to understand the schema fully before
writing any data-loading or model code.

## TECH STACK (confirmed)
- **Frontend:** React (Vite), Tailwind CSS for styling, Recharts for
  charts/visualizations
- **Backend:** Node.js + Express, REST API
- **Database:** Start with an embedded/virtual database for fast local dev
  — use **SQLite** (via `better-sqlite3` or `prisma` with the sqlite
  provider) so there's zero external setup required. Structure it so
  swapping to PostgreSQL later is a one-line config change (use Prisma ORM
  for this portability).
- **ML model:** Python microservice (FastAPI) called by the Node backend
  over HTTP, OR a Node-native model if simpler — your call, but isolate ML
  logic behind a clean internal API (`POST /predict`) so the
  implementation can change without touching the rest of the app.

## DESIGN BAR (read this before writing any UI code)
This needs to look and feel like a production utility-grade enterprise
product, not a bootcamp CRUD demo — this is the single biggest factor in
whether it impresses a technical reviewer. Before writing frontend code,
read `/mnt/skills/public/frontend-design/SKILL.md` if present in your
environment, and apply its guidance. Concretely:
- A real design system: defined color tokens (don't use default Tailwind
  blue-500 everywhere), consistent spacing scale, a deliberate type scale,
  not just default browser/Tailwind defaults
- A cohesive dark-mode-first "grid operations center" aesthetic is a good
  fit for a utility ops tool (think monitoring dashboards, not a SaaS
  landing page) — but execute it with restraint and polish, not neon
  overload
- Meaningful empty states, loading skeletons (not spinners everywhere),
  and micro-interactions on key actions (status changes, predictions
  loading, charts rendering)
- Data-dense views (tables, charts) need real information hierarchy —
  this is what separates "looks like a tutorial" from "looks like a tool
  a utility company would actually buy"
- No generic icon-and-card grids; design each screen for what it
  specifically needs to communicate (risk dashboard ≠ consumer detail ≠
  audit log — each has a different information shape)

## AUTHENTICATION & SECURITY (required — this is a graded/portfolio
project, treat security as a real feature, not an afterthought)

### Operator login
- Real authentication, not a fake "demo mode" toggle: email + password
  login, passwords hashed with **bcrypt** (never plain text, never
  reversible encryption)
- **JWT-based sessions**: short-lived access token (15 min) + longer-lived
  refresh token (7 days), refresh token stored as an **httpOnly, secure,
  sameSite cookie** (not localStorage — explain this choice in the README,
  it's a common interview question and a deliberate design decision worth
  highlighting)
- Role-based access control (RBAC) with at least two roles:
  - **Operator** — view dashboard, view consumer detail/explanations, log
    inspections
  - **Admin** — everything Operator can do, plus: manage operator
    accounts, view full audit log, trigger model retraining, view system
    health
- Seed script creates a default admin account on first run (credentials
  printed to console / written to a `.env.example`, never hardcoded in
  source)
- Protected routes on both frontend (route guards + redirect to login) and
  backend (auth middleware on every non-public endpoint)
- "Remember me" / session expiry handled gracefully — auto-refresh token
  silently, redirect to login with a clear message if the session is
  truly expired (not a blank screen or cryptic error)

### API & application security hardening
- **Input validation** on every endpoint (use `zod` or `joi`) — reject
  malformed requests before they touch the database or business logic
- **Rate limiting** on auth endpoints specifically (`express-rate-limit`)
  to prevent brute-force login attempts
- **Helmet.js** for secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
- **CORS** configured explicitly (no wildcard `*` in anything that
  touches auth or write endpoints)
- **SQL injection protection** — guaranteed by using Prisma's parameterized
  queries throughout; never construct raw SQL from user input
- **Audit logging** — every inspection decision, login, failed login
  attempt, and admin action (e.g. account creation, role change) is logged
  with timestamp + actor + action, queryable by Admins in an "Audit Log"
  screen
- **Environment-based secrets** — JWT signing secret, any API keys, all in
  `.env`, never committed (include a proper `.gitignore` and
  `.env.example`)
- **Password policy** enforced at signup/account-creation time (minimum
  length, not in a common-password blocklist — a small built-in list is
  fine for a demo)
- **Account lockout** after N failed login attempts within a time window,
  with a clear (but not info-leaking) error message
- Document all of the above explicitly in the README under a "Security"
  section — for a portfolio project, *demonstrating* you understand these
  tradeoffs is as valuable as implementing them, so write a short
  paragraph per measure explaining *why*, not just *that* it's there

## OPERATOR EXPERIENCE — "TOP-END" FEATURE SET
Beyond the core dashboard from the original brief, build these so the
breadth of the system is immediately apparent to anyone reviewing it:

- **Login → Operator Console**: after auth, land on a command-center style
  overview (key metrics, live-feeling activity feed of recent
  predictions/inspections, system status indicator for the ML service)
- **Global search/command palette** (Cmd+K style) to jump to any consumer
  by ID instantly — small detail, disproportionately impressive
- **Role-aware navigation** — Admin sees extra nav items (Audit Log, User
  Management, Model Health) that Operators don't see at all (not just
  greyed out — actually absent, enforced both client- and server-side)
- **Model Health panel (Admin only)**: shows current model version,
  training date, per-class precision/recall/F1, confusion matrix
  visualization, and a "Retrain model" action that re-runs the training
  pipeline and hot-swaps the active model
- **Notifications/activity feed**: real-time-feeling (polling is fine,
  don't need real websockets unless you want them) feed of new
  high-confidence anomaly detections
- **Exportable reports**: ability to export a filtered consumer list or a
  single consumer's full diagnosis (including SHAP explanation) as a PDF
  or CSV — utilities need this for compliance/audit trails
- **Dark/light theme toggle** persisted per user
- **Responsive design** — must look intentional on tablet width too (field
  inspectors plausibly use this on a tablet), not just desktop
- **Settings page**: operator can update their own password, see their
  own recent activity

## THINGS YOU (CLAUDE CODE) SHOULD FLAG IF MISSING
As you build, actively look for and propose anything in this list that
isn't already covered above, and check with me before skipping any of
them:
- HTTPS/TLS notes for eventual deployment (even if running HTTP locally,
  document the production requirement)
- A health-check endpoint (`GET /api/health`) for the Node API and a
  separate one for the Python ML service
- Graceful error handling everywhere — no raw stack traces ever returned
  to the client; structured error responses with safe messages
- Database backup/seed reset script for demo purposes (`npm run db:reset`)
- A `CONTRIBUTING.md`/architecture doc if the codebase grows large enough
  that a reviewer (or future you) would benefit from a map of it
- Loading/error/empty states for every data-fetching screen, not just the
  happy path
- Basic automated tests for at least the auth flow and the prediction
  endpoint (even a small Jest/Vitest suite signals engineering maturity
  to a technical reviewer)

## ML MODEL APPROACH (phased)
**Phase A (mock):** Build a deterministic mock predictor that reads the
existing `label`/`anomaly_subtype` columns from the dataset (since we
already have ground truth) and returns them as "predictions" with a
plausible confidence score and a templated explanation, so the full UI and
API can be built and tested before any real model exists.

**Phase B (real model):** Replace the mock with a real trained classifier:
- Multi-class classifier (XGBoost or Random Forest to start — interpretable
  and fast) trained on engineered features from the time series (rolling
  mean/std, day-over-day delta, voltage/PF anomalies, missing-data ratio,
  etc.)
- Explainability via **SHAP** — return top contributing features per
  prediction so the frontend can show "why" a consumer was flagged
  (this is the core differentiator of the project — do not skip this)
- Expose via `POST /predict` returning: `{ predicted_label,
  predicted_subtype, confidence, top_features: [{feature, impact,
  direction}], recommendation }`

## CORE FEATURES TO BUILD

### 1. Data Ingestion & Database
- Script to load the CSV dataset into SQLite/Prisma on first run (seed
  script)
- Schema: `consumers`, `readings` (time series), `predictions` (model
  outputs + explanations, cached), `inspections` (operator action log —
  see feature 5)

### 2. REST API (Express)
**Auth (public except where noted):**
- `POST /api/auth/login` — email + password, rate-limited, returns access
  token + sets refresh cookie
- `POST /api/auth/refresh` — exchanges valid refresh cookie for new access
  token
- `POST /api/auth/logout` — clears refresh cookie, invalidates session
- `GET /api/auth/me` — (protected) returns current user + role
- `POST /api/users` — (Admin only) create a new operator/admin account
- `PATCH /api/users/me/password` — (protected) self-service password change

**Core domain (all protected, role checks where noted):**
- `GET /api/consumers` — paginated list with filters (by label, consumer
  type, date range, risk score)
- `GET /api/consumers/:id` — full consumer detail incl. time series
- `GET /api/consumers/:id/predict` — run/fetch prediction + explanation
  for this consumer
- `GET /api/consumers/:id/timeseries` — raw + flagged readings for
  charting
- `GET /api/consumers/:id/export` — export single-consumer diagnosis as
  PDF/CSV
- `GET /api/dashboard/summary` — aggregate stats (counts per class, trend
  over time, top at-risk consumers)
- `POST /api/inspections` — log an operator decision (mark
  inspected/confirmed/false-positive) — this closes the decision-support
  loop
- `GET /api/inspections` — inspection history/audit log
- `GET /api/audit-log` — (Admin only) full system audit trail
- `GET /api/model/health` — (Admin only) model version, metrics, confusion
  matrix
- `POST /api/model/retrain` — (Admin only) trigger retraining pipeline
- `GET /api/health` — public health check (Node API)

### 3. Frontend — Operator Dashboard
- **Overview page:** summary cards (total consumers, theft/fault/comm
  counts, trend chart), a prioritized "Top Risk Consumers" table sorted by
  model confidence
- **Consumer detail page:** time-series chart of kWh/voltage/current/PF
  with the anomaly window visually highlighted, predicted class +
  sub-type, confidence score, and a **plain-language explanation panel**
  (e.g., "Flagged as Theft (T1_PartialReduction) — consumption dropped
  42% below historical baseline starting March 3rd, while voltage and
  power factor remained normal, ruling out a meter fault")
- **SHAP feature importance chart** per prediction (bar chart of top
  contributing features)
- **Inspection workflow:** button to mark a consumer as
  "Queued for Inspection / Inspected — Confirmed / Inspected — False
  Positive", logged via the API
- **Filters/search:** by anomaly class, sub-type, consumer type, date
  range, confidence threshold

### 4. Explainability requirement (critical — this is the project's core
value proposition)
Every prediction shown in the UI must be paired with a human-readable
explanation, not just a class label. Use SHAP values to identify which
features drove the prediction, then template them into a sentence (not
raw SHAP output) for the operator-facing UI, while still exposing the raw
values in an "advanced/technical" expandable section for power users.

### 5. Decision support loop
The inspection logging (item 3 above) is what makes this a "decision
support system" rather than just a classifier — make sure it's wired
end-to-end: prediction → operator views explanation → operator logs a
decision → decision is stored and reflected back in the dashboard (e.g.,
"confirmed theft rate this month").

## BUILD PHASES (work through these in order, check in with me after each)
1. **Scaffold** — repo structure, Vite React app, Express API skeleton,
   Prisma + SQLite setup (including `User` model for auth), load dataset
   into DB
2. **Authentication & security foundation** — login/logout/refresh flow,
   RBAC middleware, rate limiting, Helmet, input validation, audit log
   table + logging hooks. Get this solid before building feature screens
   on top of it, since every later screen depends on it.
3. **Mock prediction API + basic dashboard (behind login)** — get the full
   data flow working end to end with mock predictions, gated by auth,
   before any ML work
4. **Real ML model + SHAP explainability** — Python FastAPI service,
   feature engineering, model training script, SHAP integration, wire it
   into the Node `/predict` endpoint, plus the Model Health admin panel
5. **Full UI polish & top-end features** — design system pass, charts,
   explanation panels, inspection workflow, filters, command palette,
   notifications feed, exports, theme toggle, responsive pass
6. **Tests & docs** — auth + prediction endpoint tests, README with setup
   instructions, architecture overview, and the Security section
   explaining each hardening measure

## NON-FUNCTIONAL NOTES
- Keep the ML service decoupled (separate process/folder) so it can be
  swapped or scaled independently later
- Use environment variables for config (DB path, ML service URL, ports,
  JWT secrets) — never hardcode secrets anywhere in source
- Write a root `README.md` explaining how to run everything locally with
  one or two commands, including default admin credentials for first
  login (clearly marked as dev-only, with a note on what changes in
  production)
- Don't over-engineer deployment infra (no need for Docker/K8s/CI unless
  you want to add it) — this is a research/portfolio project demo; keep
  it runnable locally with `npm run dev` style commands, but the *security
  posture inside the app itself* should be production-grade, since that's
  what a reviewer will actually inspect

## FIRST STEP
Start with Phase 1 only. Propose the folder structure and confirm the
Prisma schema with me before writing the seed script, since the dataset is
large (~1.8M rows) and I want to make sure the schema is efficient before
we load it all in.
