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
- Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optional `ADMIN_NAME` in the backend environment to manage main-admin access. Do not put these values in frontend environment variables.
- To disable old MongoDB-backed main-admin accounts once, run `npm run migrate-admin-auth -- --apply` from this directory. This disables those accounts without deleting their related records.
