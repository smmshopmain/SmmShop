# SMM Reseller Panel

Production-ready SMM reseller platform built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB Atlas, Mongoose, JWT cookies, Telegram notifications, provider APIs, cron-ready sync routes, and email OTP password reset.

> Important: This repository has separate packages for frontend and backend.
> Use `frontend/src` for UI changes and `backend/src` for backend/API changes.
> The root `src` folder is a legacy duplicate and is not the production deployment target.

## Setup

1. Install dependencies:

```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

2. Copy `.env.example` to `.env.local` and fill real values:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-backend.onrender.com
PROVIDER_API_URL=
PROVIDER_API_KEY=
MONGODB_URI=
JWT_SECRET=
CRON_SECRET=
APP_BASE_URL=
PAYMENT_WEBHOOK_SECRET=
PAYMENT_VERIFY_API_URL=
PAYMENT_VERIFY_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ADMIN_ID=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
```

3. Start development server:

```bash
npm run dev
```

This will run the deployed frontend app from `frontend/` so local development matches Vercel.

Open `http://localhost:3000`.

## Frontend and Backend Deployment

- Frontend: deploy the next.js application to Vercel.
- Backend: deploy the API routes and cron jobs to Render.
- The frontend uses `NEXT_PUBLIC_API_URL` for all backend requests.
- The backend allows CORS for configured Vercel domains via `FRONTEND_URL` and `ALLOWED_ORIGINS`.

### Vercel

Set `NEXT_PUBLIC_API_URL` to your Render backend URL.
Example: `https://your-backend.onrender.com`

### Render

Use the existing Render service configuration and set backend env vars as shown above. The Render service keeps the backend API, MongoDB access, Telegram integration, and cron sync jobs running.

## Auth Notes

- Public registration always creates a normal user account.
- Login accepts email or mobile number when a user has `phone` saved.
- Forgot password sends a 6 digit OTP to the user's email through SMTP.
- OTPs are hashed before storing in MongoDB, expire after 10 minutes, and allow 5 attempts.

## Render Deploy

Use these settings if you create the service manually on Render:

```bash
Build Command: npm ci && npm run build
Start Command: npm run start
```

Add all variables from `.env.example` in Render Environment. Do not upload `.env.local`.

### Payment Details

Admin can configure deposit payment details from:

```text
/admin/settings
```

Open Admin > Settings, then scroll to **Payment details shown to users**. Add the QR image, UPI ID, bank name, account holder name, account number, IFSC, and payment instructions. Users will see these details on Dashboard > Wallet before submitting a deposit request.

### Render Keep Alive

The blueprint includes `smm-keep-alive`, a cron service that calls:

```text
/api/keep-alive
```

Set `APP_BASE_URL` on Render to your live URL, for example:

```text
https://your-service-name.onrender.com
```

This sends an inbound request every 10 minutes to reduce Render free-tier cold starts.

### Nightly Catalog Refresh

The Render blueprint includes `smm-nightly-catalog-refresh`, a cron service that calls:

```text
/api/cron/auto-sync
```

It runs service import first, then recalculates prices so the catalog shows updated rates. Render evaluates cron schedules in UTC, so the blueprint uses `30 18 * * *`, which runs at 12:00 AM IST.

## Useful Commands

```bash
npm run build
npm run lint
npm run start
```

## Health Endpoints

- `/api/health` checks MongoDB connectivity.
- `/api/keep-alive` is available for Render/free-tier keep-alive monitors.

## Telegram Deposit Verification

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADMIN_ID`, and `APP_BASE_URL`.
The app auto-configures the Telegram webhook when a new deposit request is submitted. You can also configure it manually to:

```text
https://your-service-name.onrender.com/api/telegram/deposits
```

Only `TELEGRAM_ADMIN_ID` can use the approve/reject buttons.
If `TELEGRAM_ADMIN_ID` is missing, the app only accepts callbacks from the same private chat ID configured in `TELEGRAM_CHAT_ID`; setting `TELEGRAM_ADMIN_ID` is recommended.
