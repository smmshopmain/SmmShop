Backend (Render)

This folder contains the Next.js API-only backend for the SMM panel. Deploy to Render.

Quick start:

1. Copy `.env.example` to `.env.local` and fill backend secrets.
2. Install and run:

```bash
npm ci
npm run build
npm run start
```

Notes:
- Exposes API under `/api/*` (health, cron jobs, auth, orders, deposits, providers).
- Configure Render cron jobs to call `/api/cron/*` endpoints.
- `middleware.ts` has been moved to `backend/middleware.ts` and should be used by the backend service.
