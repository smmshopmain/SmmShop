Frontend (Vercel)

This folder contains the Next.js UI for the SMM panel. Deploy to Vercel.

Quick start:

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL`.
2. Install and run:

```bash
npm ci
npm run build
npm run start
```

Notes:
- All client requests should use `NEXT_PUBLIC_API_URL`.
- Static `public/` assets and `src/app` pages/components live here.
