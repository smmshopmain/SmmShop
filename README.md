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

2. Copy the package-specific environment examples to `.env.local` and fill in the required values:

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
```

For local development, set `NEXT_PUBLIC_API_URL=http://localhost:3002` in `frontend/.env.local`. Set the MongoDB and backend secrets in `backend/.env.local`.

The production frontend API URL and backend environment variables include:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-backend.onrender.com
PROVIDER_API_URL=
PROVIDER_API_KEY=
MONGODB_URI=
JWT_SECRET=
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=replace-with-a-long-random-password
ADMIN_NAME=Admin
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
EMAIL_WORKER_URL=https://your-frontend.vercel.app/api/internal/send-email
EMAIL_WORKER_SECRET=replace-with-a-long-random-secret
```

3. Start both development servers in separate terminals:

```bash
npm --prefix backend run dev -- --port 3002
npm --prefix frontend run dev -- --port 3000
```

Open `http://localhost:3000`.

## Frontend and Backend Deployment

- Frontend: deploy the next.js application to Vercel.
- Backend: deploy the API routes and cron jobs to Render.
- The frontend uses `NEXT_PUBLIC_API_URL` for all backend requests.
- The backend allows CORS for configured Vercel domains via `FRONTEND_URL` and `ALLOWED_ORIGINS`.
- Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` only in the backend environment. Do not add admin credentials to Vercel/frontend variables.

### Vercel

Set `NEXT_PUBLIC_API_URL` to your Render backend URL.
Example: `https://your-backend.onrender.com`

Also add `EMAIL_WORKER_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `FROM_EMAIL` to the Vercel frontend environment. The Vercel route at `/api/internal/send-email` uses these values to send email through SMTP.

### Render

Use the existing Render service configuration and set backend env vars as shown above. The Render service keeps the backend API, MongoDB access, Telegram integration, and cron sync jobs running. Set `EMAIL_WORKER_URL` and `EMAIL_WORKER_SECRET` there so the backend calls the Vercel worker instead of attempting direct SMTP from Render.

## Auth Notes

- Public registration always creates a normal user account.
- Login accepts email or mobile number when a user has `phone` saved.
- The main admin signs in using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the backend environment; `ADMIN_NAME` is optional. Changing these values invalidates existing environment-admin sessions. Unsetting either username or password disables environment-admin login.
- Main admin credentials are not stored in MongoDB. Existing MongoDB accounts with the `admin` role must be disabled once with `npm --prefix backend run migrate-admin-auth -- --apply`; the migration keeps the records but downgrades and bans those accounts and replaces their password hashes. Staff and secondary-admin roles are unchanged.
- Remove the old hard-coded main-admin setup; use only the backend environment variables for main-admin access.
- Forgot password sends a 6 digit OTP to the user's email through a Vercel worker endpoint because Render free-tier SMTP is blocked.
- OTPs are hashed before storing in MongoDB, expire after 10 minutes, and allow 5 attempts.

## User-facing design

Administrators can preview and save the site-wide appearance from **Admin > Settings > Website design & animations**. **Classic · Original** retains the existing design, **Studio · Redesigned** applies the refreshed styling across signed-in dashboard pages, and **Midnight Studio** remains available. Saving a preset sets the default for users and visitors.

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

### Website Design and Animation Controls

Admins can open **Admin > Design & motion** (or Admin > Settings) to preview and apply **Default Design** (the original light teal design) or **Midnight Studio**. The selected design is saved site-wide for visitors and logged-in user/admin panels. Admins can also enable or disable website motion, control page-entry, floating, and interactive effects, choose the animation accent colour, and adjust speed. The browser's reduced-motion preference is always respected.

### Content Copy Deterrents

Visible page text is non-selectable by default, right-click is suppressed on regular page content, and images cannot be dragged. Form fields, table data, and explicitly marked values remain selectable for normal account and operations workflows. These are usability deterrents only; they cannot prevent screenshots, browser developer tools, or access to assets delivered to a visitor's browser.

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
