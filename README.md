# SMM Reseller Panel

Production-ready SMM reseller platform built with Next.js App Router, TypeScript, Tailwind CSS, MongoDB Atlas, Mongoose, JWT cookies, Telegram notifications, provider APIs, cron-ready sync routes, and email OTP password reset.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill real values:

```bash
PROVIDER_API_URL=
PROVIDER_API_KEY=
MONGODB_URI=
JWT_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_ADMIN_ID=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

3. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Auth Notes

- Public registration always creates a normal user account.
- Login accepts email or mobile number when a user has `phone` saved.
- Forgot password sends a 6 digit OTP to the user's email.
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
