# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN npm install --workspace=apps/api --workspace=packages/db --omit=dev

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install ALL deps (including dev) for Prisma generate
RUN npm install --workspace=apps/api --workspace=packages/db

# Copy source
COPY apps/api/   ./apps/api/
COPY packages/db/ ./packages/db/

# Generate Prisma client
RUN npx --prefix packages/db prisma generate

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only production artefacts
COPY --from=build /app/node_modules       ./node_modules
COPY --from=build /app/apps/api           ./apps/api
COPY --from=build /app/packages/db        ./packages/db
COPY package.json ./

# Prisma needs the schema at runtime for migrations
COPY packages/db/prisma/ ./packages/db/prisma/

# Create volume mount point for SQLite DB
RUN mkdir -p /data && chown appuser:appgroup /data

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "apps/api/src/index.js"]
