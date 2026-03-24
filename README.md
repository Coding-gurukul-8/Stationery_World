# Stationery_World

A full-stack stationery e-commerce project (frontend + backend).

## 📌 Workspace structure
- `backend/` — Node.js + Express API with Prisma & PostgreSQL
- `frontend/` — React + Vite UI

## 🚀 Running locally
### Backend
```bash
cd backend
npm install
cp .env.example .env
# update .env with your DB and SMTP credentials
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## ☁️ Vercel deployment (frontend)
- Deploy from the repository root (this project includes root `vercel.json`).
- The build is configured to run in `frontend/` and publish `frontend/dist`.
- SPA rewrites intentionally exclude:
  - `/api/*` (so backend/API routes are not rewritten to `index.html`)
  - `/assets/*`, `/favicon.ico`, `/vite.svg` (so static files are served directly)
- `index.html` is served with `Cache-Control: no-cache, no-store, must-revalidate` to reduce stale HTML referencing old hashed bundle names after redeploy.
