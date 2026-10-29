# Vercel setup

Project: https://vercel.com/tech-unite/entrynex-eams

This release deploys the Vite frontend and Express HTTP/WebSocket backend together using Vercel Services (beta). It uses relative /api URLs, so previews do not call production. The project is created, but no Atlas account, payment account, email credentials or storage credentials have been connected by this release.

## Connect the new MongoDB Atlas database

1. Open https://vercel.com/marketplace/mongodb-atlas and install/connect it to the Tech Unite team and entrynex-eams project. Complete MongoDB's account authorization yourself.
2. Create a new cluster/database and a database user restricted to that application database. Choose a region close to the Vercel function region (sin1/Singapore). Configure Atlas networking for your Vercel deployment; use static egress/private networking when available rather than exposing database access broadly.
3. Add MONGODB_URI as a sensitive environment variable in Vercel. Use separate databases for preview and production. Never paste credentials into chat or commit .env files.
4. Add a random JWT_SECRET of at least 32 characters and a separate random CRON_SECRET. Set FRONTEND_URL and BACKEND_URL to the intended HTTPS deployment origin, and CORS_ORIGINS to exact allowed origins. Generated Vercel deployment origins are also recognized automatically.
5. From a trusted terminal with the production configuration securely loaded, run `cd backend && npm ci && npm run db:indexes`. This adds required indexes without automatically dropping existing ones. On an existing database, replace the old Attendee event/rfidTag sparse index with the new partial index during maintenance; review duplicates first. A fresh Atlas database needs no legacy migration.
6. Set ADMIN_EMAIL and a unique ADMIN_PASSWORD (14+ characters) in your secure local environment, run `npm run admin:create`, then remove those bootstrap variables. No demo accounts are installed. Enable MFA after login.
7. Redeploy. `/api/health/ready` must return 200 before testing live workflows. It returns 503 if runtime configuration or the database is unavailable.

## Email, storage and payment

Configure either SENDGRID_API_KEY plus a verified EMAIL_FROM, or SMTP_HOST/PORT/USER/PASS and EMAIL_FROM. Production never treats console-only email as successful delivery; SMTP certificate verification is enabled.

Existing image uploads use Azure: AZURE_STORAGE_CONNECTION_STRING and AZURE_STORAGE_CONTAINER. Receipts require a separate AZURE_PRIVATE_STORAGE_CONTAINER with public access disabled. Receipts are streamed only through the authenticated receipt endpoint. Configure storage lifecycle/retention policies. Hosted uploads are limited to 3 MB per file; keep total multipart requests under Vercel's 4.5 MB request limit. Upload branding images separately if combined files exceed the envelope.

Configure the chosen Stripe or PayHere credentials and their webhook secrets. Stripe webhook: `/api/payment/stripe-webhook`; PayHere: `/api/payment/notify`. Verify sandbox purchases and callbacks on this deployment before accepting real payments. AI remains optional: AI_ENABLED=true, OPENAI_API_KEY, OPENAI_MODEL.

## Reliable scheduling on your current Hobby plan

Vercel rejected one-minute crons on this team because Hobby permits only daily scheduling. The default vercel.json therefore has a daily recovery cron, and successful payment callbacks wake the durable fulfillment worker immediately with waitUntil.

**Before go-live, enable the included five-minute external maintenance schedule.** Put this repository in GitHub, set repository variable EAMS_URL to the production origin, set production-environment secret CRON_SECRET to the same value configured in Vercel, and enable `.github/workflows/maintenance.yml` on the default branch. Review deployment protection: automated requests must be allowed through protection using a separately configured bypass or a public custom domain. GitHub scheduled jobs can be delayed; monitor maintenance execution and failed payment tasks.

Alternatively, after choosing Vercel Pro yourself, change the vercel.json cron schedule to `* * * * *` and redeploy. This release does not upgrade your billing plan. Do not rely solely on the daily fallback for event operations. Scheduler requests are protected by CRON_SECRET and a database lease; payment and RFID state changes are transactional.

## Verification

Backend: `npm test`, `npm run check`, `npm run test:integration`, `npm audit`.
Frontend: `npm ci`, `npm run build`, `npm audit`.
Integration tests create disposable local replica sets; do not point tests at production.

The integration suites now exercise payment callback concurrency, cancelled-order rejection, transactional RFID assignment/release, archive cleanup, shared rate limits, reservation expiry, and real HTTP login/reader/cron routes. Physical readers and real external accounts still require acceptance testing. Passing these tests does not certify all legacy features or production infrastructure.

## Deploy from source

Import the repository root in Vercel, keeping vercel.json at the root. Do not set the root directory to frontend. Select Node.js 24. The Services configuration selects Vite and Express. For local development, run the backend with configured MongoDB, then `npm start` in frontend; Vite proxies /api and /socket.io.

The final backend target uses `backend/Dockerfile.vercel` (Node 24 container) to preserve the complete runtime dependency tree and HTTP/WebSocket server. Vercel Services and container runtime availability must be enabled on the target account. Build success alone does not prove API readiness.
