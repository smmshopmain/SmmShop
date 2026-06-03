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

## Useful Commands

```bash
npm run build
npm run lint
npm run start
```

## Health Endpoints

- `/api/health` checks MongoDB connectivity.
- `/api/keep-alive` is available for Render/free-tier keep-alive monitors.
