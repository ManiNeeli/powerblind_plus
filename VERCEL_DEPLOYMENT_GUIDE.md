# 🚀 Deploying PowerBlind+ to Vercel

This guide provides step-by-step instructions for hosting **PowerBlind+** on [Vercel](https://vercel.com) using your GitHub repository:
👉 **[https://github.com/ManiNeeli/powerblind_plus](https://github.com/ManiNeeli/powerblind_plus)**

---

## 🏗️ Multi-Service Architecture on Vercel

PowerBlind+ is configured as a unified **Vercel Services** multi-service project:

| Service | Root Directory | Framework / Runtime | Visibility | Role & Routing |
| :--- | :--- | :--- | :--- | :--- |
| **`web`** | `apps/web` | Vite (React 18 + Tailwind) | **Public** (`/(.*)`) | Frontend user interface & dashboard |
| **`api`** | `apps/api` | Express.js (Node.js) | **Public** (`/api/(.*)`) | Core business logic, auth, & database adapter |
| **`ml`** | `services/ml` | FastAPI (Python) | **Internal only** | XGBoost ML inference, SHAP analysis, & retraining |

> 🔒 **Service Bindings**: The `api` service automatically connects to the internal `ml` service using a Vercel service binding, which dynamically injects the internal URL via the `ML_SERVICE_URL` environment variable. The `ml` service is never directly exposed to the public internet.

---

## 📋 Prerequisites

1. **GitHub Account**: Your repository is synced at `https://github.com/ManiNeeli/powerblind_plus`.
2. **Vercel Account**: Free account at [vercel.com](https://vercel.com/signup).
3. **MongoDB Atlas Database** (Free 512 MB cluster):
   - Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
   - Create a database user (username & password).
   - Under **Network Access**, add `0.0.0.0/0` (Allow access from anywhere, required for cloud serverless functions).
   - Copy your connection string:
     ```text
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/powerblind?retryWrites=true&w=majority
     ```

---

## 🚀 Method 1: Deploy via Vercel Web Dashboard (Recommended)

### Step 1: Import Project from GitHub
1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** → **"Project"**.
3. Under **Import Git Repository**, find `ManiNeeli/powerblind_plus` and click **"Import"**.

### Step 2: Configure Project Settings
Vercel will automatically read the root [`vercel.json`](./vercel.json) configuration:
- **Framework Preset**: Vite
- **Root Directory**: `./` (leave default)
- **Build Command**: `npm run build -w apps/web` (auto-configured)
- **Output Directory**: `apps/web/dist` (auto-configured)

### Step 3: Add Environment Variables
In the **Environment Variables** section, expand and add the following:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.abcde.mongodb.net/powerblind` | Your MongoDB Atlas connection URI |
| `MONGODB_DB_NAME` | `powerblind` | Target MongoDB database name |
| `JWT_ACCESS_SECRET` | `pb_access_prod_secret_key_849202482390` | 32+ character random secret for access tokens |
| `JWT_REFRESH_SECRET` | `pb_refresh_prod_secret_key_90238472938` | 32+ character random secret for refresh tokens |
| `NODE_ENV` | `production` | Production environment flag |

> 💡 *Note: You do **not** need to set `VITE_API_URL` when deploying both frontend and API together — Vercel routes `/api/*` on the same domain seamlessly!*

### Step 4: Click Deploy!
- Click **"Deploy"**.
- Vercel will install workspace dependencies, build the Vite frontend, package the `/api` serverless functions, and assign a production URL (e.g., `https://powerblind-plus.vercel.app`).

---

## ⚡ Method 2: Deploy via Vercel CLI (Command Line)

If you have the Vercel CLI installed:

```bash
# 1. Login to Vercel
npx vercel login

# 2. Deploy a preview build
npx vercel

# 3. Deploy to production
npx vercel --prod
```

Follow the interactive prompts:
- **Set up and deploy?**: `y`
- **Which scope?**: Select your personal or team account
- **Link to existing project?**: `n`
- **What’s your project’s name?**: `powerblind-plus`
- **In which directory is your code located?**: `./`

Then add your environment variables either in the Vercel Dashboard under **Project Settings → Environment Variables** or via CLI:
```bash
npx vercel env add MONGODB_URI production
npx vercel env add JWT_ACCESS_SECRET production
npx vercel env add JWT_REFRESH_SECRET production
```

---

## 🔍 Verification After Deployment

Once deployed, verify your deployment:

1. **Frontend Verification**:
   - Open `https://<your-project>.vercel.app`.
   - Ensure the login page loads with the Cyber Dark / Light mode toggle, custom logo, and responsive navigation.
   - Navigate to `/dashboard`, `/consumers`, `/inspections` and refresh the page to confirm SPA rewrites work without 404s.

2. **API Health Check**:
   - Open `https://<your-project>.vercel.app/api/health` in your browser.
   - You should see:
     ```json
     {
       "service": "powerblind-api",
       "version": "0.2.0",
       "environment": "production",
       "checks": {
         "database": {
           "status": "ok",
           "engine": "mongodb"
         }
       }
     }
     ```

3. **Authentication & Features**:
   - Log into the app with seeded credentials (or seed initial users via Atlas Compass).
   - Test search, filters, inspection workflows, export CSV, and dark mode toggle.

---

## 🔒 Security Best Practices for Production
- Keep `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` long and confidential.
- In MongoDB Atlas, ensure database credentials are only used by authorized backend functions.
- The built-in CORS configuration automatically permits your `*.vercel.app` domain and custom production domains.
