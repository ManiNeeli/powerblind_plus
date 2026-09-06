# PowerBlind+ Deployment Guide

This guide covers deploying the full PowerBlind+ stack to a production Linux server using Docker Compose.

---

## Prerequisites

- Linux server (Ubuntu 22.04 LTS recommended), 4GB+ RAM
- Docker ≥ 24 and Docker Compose v2 (`docker compose` not `docker-compose`)
- Domain name pointed at your server (for HTTPS)
- The dataset CSVs in `/data/`

Install Docker:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out and back in
```

---

## Step 1 — Clone and configure

```bash
git clone <your-repo> powerblind-plus
cd powerblind-plus
```

Set up production environment file:
```bash
cp apps/api/.env.production.example apps/api/.env
nano apps/api/.env
```

**Required values to set:**
```env
JWT_ACCESS_SECRET=<64-char random hex>   # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_REFRESH_SECRET=<64-char random hex>  # different value from ACCESS_SECRET
CORS_ORIGINS=https://yourdomain.com
SEED_ADMIN_EMAIL=admin@yourcompany.com
```

---

## Step 2 — Build Docker images

```bash
docker compose build
```

This builds three images (~5 min first time, cached after):
- `powerblind-plus-web` — React app served by nginx
- `powerblind-plus-api` — Node.js Express API
- `powerblind-plus-ml`  — Python FastAPI ML service

---

## Step 3 — Run database migration and seed

```bash
# Run the migrate+seed one-shot container
docker compose --profile migrate up migrate
```

This will:
1. Apply Prisma migrations (creates the SQLite database)
2. Load the 5,000 consumers + 1.8M readings (~3–5 min)
3. Create the admin account and print credentials to the console

**Save the admin credentials printed to the console before they scroll away.**

---

## Step 4 — Start the full stack

```bash
# Production mode (with resource limits, restart policies)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Check all services are healthy:
```bash
docker compose ps
# All services should show "healthy" after ~30s
```

Verify:
```bash
curl http://localhost/api/health
# → {"service":"powerblind-api","status":"ok",...}
```

---

## Step 5 — Set up HTTPS (Let's Encrypt)

Install Certbot:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

Certificates are saved to `/etc/letsencrypt/live/yourdomain.com/`.

Update `docker/nginx/app.conf` — uncomment the HTTPS server block and update:
```nginx
ssl_certificate     /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

Mount the certificates into the nginx container — add to `docker-compose.yml` under `web.volumes`:
```yaml
volumes:
  - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
  - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
```

Also update nginx to listen on 443 and add the HTTP→HTTPS redirect block.

Rebuild and redeploy:
```bash
docker compose build web
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d web
```

Auto-renew certificates (add to crontab):
```bash
0 3 * * * certbot renew --quiet && docker compose exec web nginx -s reload
```

---

## Step 6 — Train the real XGBoost model (optional)

The ML service runs in **mock mode** by default. To enable the real model:

```bash
# Enter the ML container
docker compose exec ml bash

# Run training (takes 5–15 min)
python -m training.train \
  --readings ../../data/powerblind_smartmeter_readings.csv \
  --labels   ../../data/powerblind_consumer_labels.csv \
  --out      models/ \
  --n_splits 5

# Exit container — model is saved to the ml-models volume
exit
```

The ML service will auto-detect and load the new model. Verify via Admin → Model Health.

---

## Updating to a new version

```bash
git pull
docker compose build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Run migrations if schema changed:
docker compose --profile migrate up migrate
```

---

## Switching from SQLite to PostgreSQL

1. Provision a PostgreSQL instance (managed service or `docker compose` service)
2. Update `apps/api/.env`:
   ```env
   DATABASE_URL=postgresql://user:password@postgres:5432/powerblind
   ```
3. In `packages/db/prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   # was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
4. Rebuild and re-migrate:
   ```bash
   docker compose build api
   docker compose --profile migrate up migrate
   ```

No application code changes required — Prisma abstracts the provider.

---

## Monitoring and logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f ml

# API health
curl http://localhost/api/health | jq

# ML health
docker compose exec ml curl -s http://localhost:8000/health | jq
```

---

## Backup

Back up the SQLite database volume:
```bash
docker compose exec api sh -c "cp /data/powerblind.db /data/powerblind.db.bak"
docker cp $(docker compose ps -q api):/data/powerblind.db ./backups/powerblind-$(date +%Y%m%d).db
```

Back up trained model:
```bash
docker cp $(docker compose ps -q ml):/app/models ./backups/ml-models-$(date +%Y%m%d)/
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `api` exits immediately | Missing `.env` | Check `apps/api/.env` has all required vars |
| `api` shows DB error | DB file not writable | Check `db-data` volume permissions |
| `ml` shows `status: mock` | No trained model | Run training inside the ml container |
| CORS errors in browser | Wrong `CORS_ORIGINS` | Update `.env` to match your domain |
| 502 Bad Gateway | API not healthy yet | Wait 30s and check `docker compose ps` |
| Seed prints no admin creds | Admin already exists | Check `docker compose logs migrate` |
