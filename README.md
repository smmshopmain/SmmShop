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
VELONA_API_KEY=
```

3. Start both development servers in separate terminals:

```bash
npm --prefix backend run dev -- --port 3002
npm --prefix frontend run dev -- --port 3000
```

Open `http://localhost:3000`.

For local password-reset OTP email, set `EMAIL_WORKER_URL=http://localhost:3000/api/internal/send-email` and `EMAIL_WORKER_SECRET` in `backend/.env.local`. Set the same `EMAIL_WORKER_SECRET` plus `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `FROM_EMAIL` in `frontend/.env.local`. The worker secret values must match. Restart both dev servers after changing environment files.

## Frontend and Backend Deployment

- Frontend: deploy the next.js application to Vercel.
- Backend: deploy the API routes to Render. GitHub Actions runs the scheduled catalog refresh and email campaign jobs.
- The frontend uses `NEXT_PUBLIC_API_URL` for all backend requests.
- The backend allows CORS for configured Vercel domains via `FRONTEND_URL` and `ALLOWED_ORIGINS`.
- Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` only in the backend environment. Do not add admin credentials to Vercel/frontend variables.

### Vercel

Set `NEXT_PUBLIC_API_URL` to your Render backend URL.
Example: `https://your-backend.onrender.com`

Also add `EMAIL_WORKER_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `FROM_EMAIL` to the Vercel frontend environment. The Vercel route at `/api/internal/send-email` uses these values to send email through SMTP.

### Render

Use the existing Render service configuration and set backend env vars as shown above. The Render service keeps the backend API, MongoDB access, Telegram integration, and cron sync jobs running. Set `EMAIL_WORKER_URL` and `EMAIL_WORKER_SECRET` there so the backend calls the Vercel worker instead of attempting direct SMTP from Render.

For Google sign-in, configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the Render backend, and set `APP_BASE_URL` to the Render backend origin. In Google Cloud OAuth client settings, add `https://<your-render-backend>/api/auth/google/callback` as an authorized redirect URI. Then enable Google sign-in from **Admin > Settings**. Google OAuth is disabled by default and the client secret must never be added to Vercel.

## Auth Notes

- New registrations require a mobile number and stay pending until the email OTP is verified. Verification codes expire after 10 minutes and allow up to 5 attempts; email delivery uses the configured email worker.
- After email verification, the backend sends a welcome email with account details and a live service snapshot. If delivery fails, the signed-in user can retry from the registration completion screen; retries are limited to 3 per day.
- Public registration always creates a normal user account.
- Login accepts email or mobile number when a user has `phone` saved.
- Google sign-in creates accounts from Google-verified emails and does not require a mobile number; administrators can enable or disable it in **Admin > Settings**.
- The main admin signs in using `ADMIN_USERNAME` and `ADMIN_PASSWORD` from the backend environment; `ADMIN_NAME` is optional. Changing these values invalidates existing environment-admin sessions. Unsetting either username or password disables environment-admin login.
- Main admin credentials are not stored in MongoDB. Existing MongoDB accounts with the `admin` role must be disabled once with `npm --prefix backend run migrate-admin-auth -- --apply`; the migration keeps the records but downgrades and bans those accounts and replaces their password hashes. Staff and secondary-admin roles are unchanged.
- Remove the old hard-coded main-admin setup; use only the backend environment variables for main-admin access.
- Forgot password sends a 6 digit OTP to the user's email through a Vercel worker endpoint because Render free-tier SMTP is blocked.
- OTPs are hashed before storing in MongoDB, expire after 10 minutes, and allow 5 attempts.

## User-facing design

Administrators can manage the site-wide appearance and loading animations from **Admin > Animations** or **Admin > Settings**. Use the **Default** button to immediately save and apply the standard appearance and animation settings: **Classic · Original**, enabled motion, all 20 loading animations with random rotation, theme-matched teal accent colour, and 1.0x speed. Animation accents automatically follow the selected design: teal for Classic and Studio, violet for Orbit, terracotta for Atelier, mint for Pulse, indigo for Midnight Studio, navy for Meridian, sage for Sage, and wine for Ledger. The selected design is reflected on the public landing and login pages as well as the signed-in workspace. Page entrance, ambient floating, and interactive motion controls apply across the public pages and user workspace; the master switch turns off every animation and transition. **Orbit · New experience** restructures the signed-in user navigation and dashboard, services, orders, wallet, support, refills, referrals, notifications, and profile screens without changing their workflows. Admins can also choose **Atelier · Editorial**, with a warm paper palette and compact icon-rail navigation, or **Pulse · After dark**, with dark teal surfaces and mint highlights. **Meridian · Executive** offers cool stone surfaces and restrained navy, **Sage · Workspace** pairs warm ivory with muted greens, and **Ledger · Editorial** uses paper tones, ink, wine accents, and quiet serif headings. **Studio · Teal** and **Midnight Studio** remain available too. Admins can enable or disable loading animations, choose a specific animation or random rotation, and individually enable or disable each of 20 themed animations. The reduced-motion browser preference is always respected.

In **Admin > Email Management**, announcement and advertisement campaigns can include a selectable festival banner, an uploaded JPG, PNG, or WEBP banner (up to 10 MB), or both together. Upload progress is shown as a percentage and uploaded images appear in the preview. Festival selections theme the email to match. Custom banners and optional email background images (also up to 10 MB) are attached inline so recipients can view them after campaign uploads are cleaned up. After a campaign is successfully sent, its uploaded banner and background images are removed from the database unless another scheduled or in-progress campaign still uses them.

In **Admin > Popup Campaigns**, administrators can create multiple scheduled announcements, festival greetings, and advertisements; attach JPG, PNG, or WEBP images with upload progress; and set automatic start and expiry times. Links are optional and can target an internal page, any active service, or an external HTTP(S) URL; links open in the same tab. Website visitors see eligible popups one at a time outside the admin panel; they can dismiss one for the session or choose **Don't show this again today**. Popup styling follows the selected website theme.

In **Admin > Marketing Calendar**, administrators can combine Google Calendar public holidays with editable, date-specific campaign events. Each date also shows the email and popup campaigns scheduled to start that day, including their channel, status, time, and popup expiry when available; selecting a campaign date lists its scheduled campaigns and links to campaign management. Configure `GOOGLE_CALENDAR_API_KEY` in the backend environment to load holidays; the default calendar is India (`en.indian#holiday@group.v.calendar.google.com`), and `GOOGLE_HOLIDAY_CALENDAR_ID` can select another public holiday calendar. AI can create email and popup copy drafts from a selected calendar event when the AI assistant is enabled and `VELONA_API_KEY` is configured. Email drafts include occasion-matched copy, colors, a festival banner design, and custom generated artwork and open in the email composer with the occasion date and content prefilled. Custom image generation uses Velona credits. **Auto-schedule occasion emails** saves a persistent background run and starts the server-side worker immediately after returning the response, so administrators can leave the page or close the site while campaigns continue scheduling. The range preview supports up to one year; admins can deselect individual occasions and may schedule at most 25 selected occasions per run. A switch controls custom advertisement image generation; when off, the AI writes the email and schedules it without generating or attaching a banner. Administrators may add up to 2,000 characters of AI instructions before starting. When enabled, the AI uses the configured email shop name in each promotional image prompt and the email displays the brand with the banner. The worker refreshes five active services, sends only to eligible subscribed users (unsubscribed users are excluded), and skips occasions already linked to a campaign. Per-occasion progress and failures are saved and can be checked after returning to the calendar. The existing **Process scheduled email campaigns** GitHub Actions workflow also advances unfinished runs after a backend restart, so configure its `BACKEND_URL` variable and `CRON_SECRET` secret as described in the deployment section. Review the event list and confirm the image-generation cost before starting. Google holidays are read-only, and campaigns remain one-time schedules using the existing email worker and popup expiry handling.

Banner generation is off by default for new calendar runs. Completed background runs are hidden from the calendar view. Each special date shows whether a popup campaign is linked; dates without one offer **Create popup (no AI)**, which opens the popup composer with the occasion and date filled in. Popup campaigns created from an occasion are linked back to that calendar date. If saved calendar work remains queued, **Start queued schedules** appears on the active run so an administrator can manually kick the backend worker; the persisted run remains recoverable through the scheduled email-campaign workflow after a backend restart.

### AI Assistant

Set `VELONA_API_KEY` only in the backend environment (Render); it is never sent to the browser. The assistant uses Velona's documented OpenAI-compatible `https://velona.in/v1/chat/completions` endpoint with the `openai/gpt-4o-mini` model and tool calling ([official docs](https://velona.in/docs)). Create the key in Velona and keep sufficient Velona wallet credits available. Each signed-in account has its own private list of conversations; administrator histories are also isolated by admin account. Opening the assistant starts a fresh chat, while the three-line **History** menu lists chat topics; selecting a topic opens that conversation so it can be continued. **New chat** starts another separate conversation. The assistant greets by the account profile name in every new chat. Existing single-thread histories are migrated into the new list without losing their messages. Enable the AI assistant and choose its action policy from **Admin > Settings**. A movable AI launcher is available throughout signed-in admin and customer workspaces; it sends the current section as context. The backend grounds each response in a role-aware guide to the real website sections and workflows plus current public site settings; live service/order/admin facts continue to come from permission-checked tools rather than model guesses. The developer name is read from the configured footer credit, and the assistant says it is not publicly listed when that credit is hidden or unset. This is runtime grounding, not model fine-tuning. Email Management and Popup Campaigns expose section-specific AI actions. Admins can inspect sanitized summaries across other workspace sections and, subject to approval policy, manage user access/wallet freezes, cancel orders, update service availability/margins and provider availability/priority, review deposits, manage promo codes and support tickets, create/schedule opted-in email campaigns, create scheduled popups, and change supported website appearance settings. Campaign emails automatically use a matching festival banner or a special-offer banner. Admins can request custom Velona-generated campaign artwork for email or popups; image generation spends Velona wallet credits and always requires approval before rendering. Deposit decisions and order cancellations always require approval. Provider credentials, payment proofs, UTRs, account deletion, role changes, and other financial secrets are intentionally excluded from AI operations. User assistants can list active-service categories, search active services, view only their own recent orders, and create support tickets. Uploaded campaign and popup images can also be attached in the admin assistant.

The default **Preview first** policy requires approval for actions. **Admin direct** applies admin actions immediately but asks users to approve their assistant actions. **Direct all** applies supported actions immediately. Disabling AI removes both assistant navigation entries and rejects assistant requests. Email campaigns created by the assistant are one-time scheduled campaigns; calendar events and AI-generated calendar drafts do not automatically publish or recur yearly.

The website has a responsive, theme-matched footer on the homepage, sign-in pages, and user workspace. Administrators can edit the brand details, section headings, quick links, support links, contact email/phone/WhatsApp, address, business hours, copyright text, and visibility from **Admin > Settings**. The optional **Developer credit** can also be enabled or hidden there and can link to the developer or agency website.

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

Admins can open **Admin > Animations** (or Admin > Settings) to manage 20 content-themed loaders. Enable or disable loading animations, choose a specific animation or random rotation from the individually enabled set, and save it site-wide. The same section lets admins apply **Classic · Original**, **Studio · Teal**, **Orbit · New experience**, **Atelier · Editorial**, **Pulse · After dark**, **Midnight Studio**, **Meridian · Executive**, **Sage · Workspace**, or **Ledger · Editorial**, control page-entry, floating, and interactive effects, choose the animation accent colour, and adjust speed. The browser's reduced-motion preference is always respected.

### Content Copy Deterrents

Visible page text is non-selectable by default, right-click is suppressed on regular page content, and images cannot be dragged. Form fields, table data, and explicitly marked values remain selectable for normal account and operations workflows. These are usability deterrents only; they cannot prevent screenshots, browser developer tools, or access to assets delivered to a visitor's browser.

### Keep the Render Backend Warm

The GitHub Actions workflow `.github/workflows/keep-backend-awake.yml` calls:

```text
/api/keep-alive
```

Set the repository Actions variable `BACKEND_URL` to your deployed backend URL, and add a repository Actions secret `CRON_SECRET` matching the backend's Render `CRON_SECRET` value. For example:

```text
https://your-service-name.onrender.com
```

The workflow sends an authenticated request every 5 minutes; the backend endpoint connects to MongoDB, runs a lightweight ping, and checks whether the administrator-configured daily catalog refresh is due. Email campaign processing runs in its own 10-minute workflow so sending a large campaign cannot delay the keep-alive request. This can reduce Render cold starts without adding a Render cron service. Scheduled workflows run from the repository's default branch, and GitHub may delay scheduled jobs during high load. Render or MongoDB Atlas may still suspend services under their free-tier policies if a ping is delayed or fails, so this does not guarantee uninterrupted availability.

### Daily Catalog Refresh

Admins can enable the daily catalog refresh and choose its start time in **Admin > Service admin**. The configured time uses India Standard Time (IST); the refresh starts on the first five-minute backend check at or after that time. The backend imports services, syncs the catalog, and recalculates prices sequentially, and persists the daily run so repeated checks cannot start duplicate runs. Progress appears in the catalog refresh status panel. The **Nightly catalog refresh** GitHub Actions workflow remains available for manual runs from the Actions tab.

The daily scheduler uses the same repository Actions variable `BACKEND_URL` and `CRON_SECRET` secret required by **Keep the Render Backend Warm**. The manual workflow calls:

```text
/api/cron/auto-sync
```

The workflow polls `/api/admin/sync-status` using the same cron secret. GitHub scheduled runs can be delayed during high load; use **Run workflow** to start a refresh immediately when needed.

## Useful Commands

```bash
npm run build
npm run lint
npm run start
```

## Health Endpoints

- `/api/health` checks MongoDB connectivity.
- `/api/keep-alive` is available for Render/free-tier keep-alive monitors.

### Reseller API

The reseller API is disabled by default. Enable it from **Admin > Settings > Global API controls**. Turning it off hides the API links in user and admin navigation, rejects key-management and reseller requests server-side, and skips API service-sync jobs. It does not disable the website's own provider integration, website orders, payments, or catalog sync.

Users can create, copy, regenerate, and revoke keys from **Dashboard > API Access**. API keys are verified using SHA-256 hashes and encrypted with AES-256-GCM for later copying; the encrypted value is never returned by the key-list endpoint. Copying or retrieving a key requires the signed-in owner account. Configure a stable `API_KEY_ENCRYPTION_SECRET` in the backend environment (or `JWT_SECRET` is used as a fallback). Existing keys created before encrypted storage was added must be regenerated once before they can be copied again. Send custom REST credentials using `Authorization: Bearer <key>` or `x-api-key`; the Standard SMM endpoint accepts its key in the POST body.

Custom REST endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/services` | List active services and API purchase prices; supports `?category=` |
| GET | `/api/v1/services/{id}` | Read one available service |
| GET | `/api/v1/categories` | List categories containing available services |
| POST | `/api/v1/services/import` | Import all, selected, or category services into the account mapping |
| POST | `/api/v1/services/sync` | Refresh existing service availability mappings |
| GET | `/api/v1/account` | Read the authenticated API account and key prefix |
| GET | `/api/v1/balance` | Read the API account's website wallet balance |
| GET | `/api/v1/usage` | Read request, response-time, and API order usage statistics |
| POST | `/api/v1/orders` | Create an API order; requires an `Idempotency-Key` header |
| GET | `/api/v1/orders/{id}` | Read a fresh, rate-limited status for the account's own order |
| POST | `/api/v1/orders/status` | Read up to 100 authorized order statuses |
| GET | `/api/v1/orders?limit=50&offset=0` | List this account's API-created orders |

Custom REST responses use `{ "success": true, "data": {}, "message": "..." }` or a structured error. Standard SMM compatibility is available at `POST /api/v1/standard` with `services`, `balance`, `add`, `status`, `multi_status`, `refill`, `refill_status`, or `cancel` actions. Add requests require an `Idempotency-Key` header. Cancellation follows the existing website cancellation rules and does not issue a refund.

#### Request details

- Send REST keys in `Authorization: Bearer <key>` or `x-api-key`; never put a key in a URL. Use JSON for REST POST requests. If version-header enforcement is enabled, include `X-API-Version: 1`.
- The Standard SMM endpoint accepts JSON or `application/x-www-form-urlencoded`; its key is sent as the `key` form/body field (or the same Authorization header).
- `GET /api/v1/services` supports `category`, `limit` (1–500), and `offset`. `GET /api/v1/orders` supports `limit` (1–100) and `offset`. Both return `total` and `nextOffset`.
- Service imports accept `{"all":true}`, `{"category":"Instagram"}`, or `{"serviceIds":["<service-id>"]}`. Import pages accept `limit` (1–500) and `offset`; continue with the returned `nextOffset` until it is `null`. Mapping IDs are stable and based on the website service ID. `POST /api/v1/services/sync` refreshes availability for existing mappings.
- API order input is `{"serviceId":"<service-id>","link":"https://example.com/post","quantity":100}`. The service must be active, quantity must be in range, and the URL must be HTTP(S). Include a unique `Idempotency-Key` on every create request; reusing the key with a different payload returns `409 IDEMPOTENCY_CONFLICT`. A duplicate of the same request returns its original order when available.
- `POST /api/v1/orders/status` accepts `{"orderIds":["<order-id>"]}` (up to 100 IDs) and only returns orders owned by the authenticated account. `GET /api/v1/orders/{id}` refreshes one non-terminal provider status at most once per 60 seconds.
- Standard `add` uses `service`, `link`, and `quantity`; `status` uses `order`; `multi_status` uses comma-separated `orders`; `cancel` uses `order`; `refill` uses `order`; and `refill_status` uses the returned local `refill` ID. Standard service and balance responses follow the SMM panel response format; REST responses use the success/error envelope above.
- Common HTTP errors include `401 INVALID_API_KEY`, `403 API_ACCESS_DISABLED`/`IP_NOT_ALLOWED`, `409` for duplicate/conflicting operations, `429 RATE_LIMIT_EXCEEDED`, and `503 API_DISABLED`/`API_MAINTENANCE`. Error responses include a stable `code` and a user-safe `message`.

Admins can enable maintenance mode and configure its response message in Admin Settings. Optional IP enforcement uses per-user exact IPv4/IPv6 allowlists maintained in API Management; enable it only when the deployment proxy provides a trusted client IP header. Requests without a valid matching address are rejected.

The REST API is versioned at `/api/v1`. Admins can optionally require `X-API-Version: 1` for REST requests; this does not change the Standard SMM protocol. The API provider timeout setting applies to reseller API provider calls and does not change normal website order timeouts.

API administrators can review order history at `/admin/api/orders`, customer service mappings at `/admin/api/services`, and import/manual/automatic sync activity at `/admin/api/sync-history`. These pages and their data endpoints are unavailable while the global API switch is off.

API discounts are calculated server-side from the current admin settings and apply only to API orders. Normal website orders keep the existing pricing. A changed discount applies to subsequent API requests without rotating keys; fetch the service list again to read the new rates. Orders already placed retain their original price snapshot. The user API page displays the effective discount and refreshes it periodically. API-created orders use the existing order and wallet transaction collections. API request logs exclude credentials and request bodies and are retained for 90 days. Service auto-sync requires the global setting, the user's opt-in, and the `smm-api-service-sync` Render cron service in `backend/render.yaml`; configure its `APP_BASE_URL` and `CRON_SECRET` values.

## Telegram Deposit Verification

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID`, and `APP_BASE_URL`. Set `TELEGRAM_CHAT_ID` to the notification destination (group or private chat); if it is omitted, notifications are sent to `TELEGRAM_ADMIN_ID` as a private-chat fallback.
The app auto-configures the Telegram webhook when a new deposit request is submitted. You can also configure it manually to:

```text
https://your-service-name.onrender.com/api/telegram/deposits
```

Only `TELEGRAM_ADMIN_ID` can use the approve/reject buttons.
If `TELEGRAM_ADMIN_ID` is missing, the app only accepts callbacks from the same private chat ID configured in `TELEGRAM_CHAT_ID`; setting `TELEGRAM_ADMIN_ID` is recommended.
