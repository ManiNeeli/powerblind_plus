# ── Stage 1: build React app ───────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=apps/web

COPY apps/web/ ./apps/web/

# Pass API URL as build-time arg (Vite bakes it in at build time)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build --workspace=apps/web

# ── Stage 2: serve via nginx ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our production nginx config (see docker/nginx/app.conf)
COPY docker/nginx/app.conf /etc/nginx/conf.d/app.conf

# Copy built assets
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/health.txt || exit 1

CMD ["nginx", "-g", "daemon off;"]
