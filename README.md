# Spreadsheet Fixer

A Vite + React + TypeScript landing page for a transparent paid-package spreadsheet repair and dashboard/tracker build service. The backend runs on Cloudflare Pages Functions, uses Stripe Checkout for payment, stores jobs/payments/intake in Supabase, can notify through a Google Apps Script Gmail webhook, and exposes a protected export endpoint for a private Google Sheet job queue.

## Architecture

Customer selects package → Stripe Checkout → Stripe webhook confirms payment → Supabase job/payment record is created → customer completes paid intake form → Supabase job record is updated → optional Google Apps Script email notification → Google Sheet pulls job queue data from `/api/jobs-export`.

No AI quoter is included in this version.

## Local setup

```bash
npm install
cp .env.example .dev.vars
npm run dev
```

For Cloudflare Pages Functions locally:

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2024-10-01
```

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`
- Add all secrets/environment variables in Cloudflare Pages project settings.
- Redeploy after changing variables.
- Confirm Pages Functions are enabled so `/api/*` routes deploy.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical site URL, for example `https://thomas-jenkins.net`. |
| `STRIPE_SECRET_KEY` | Server-only Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. |
| `STRIPE_PRICE_QUICK_FIX` | Stripe Price ID for Quick Fix `$99`. |
| `STRIPE_PRICE_SPREADSHEET_REPAIR` | Stripe Price ID for Spreadsheet Repair `$249`. |
| `STRIPE_PRICE_CUSTOM_DASHBOARD_DEPOSIT` | Stripe Price ID for Custom Dashboard/Tracker deposit `$149`. |
| `STRIPE_PRICE_AUTOMATION_DEPOSIT` | Stripe Price ID for Automation diagnostic deposit `$149`. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SECRET_KEY` | Backend-only Supabase service role/secret key. Never expose this in browser code. |
| `SUPABASE_JOBS_EXPORT_TOKEN` | Strong bearer token for `/api/jobs-export`. |
| `GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL` | Optional Apps Script web app URL for Gmail notifications. |
| `EMAIL_NOTIFICATION_SECRET` | Shared secret sent to the Apps Script email webhook. |
| `ADMIN_PASSWORD` | Optional bearer token/password for `/admin/jobs` and `/api/admin/jobs`. |

`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` are not needed for this implementation because all Supabase reads/writes happen server-side.

## Stripe setup

1. Create products/prices for the four packages:
   - Quick Fix — `$99`
   - Spreadsheet Repair — `$249`
   - Custom Tracker / Dashboard Build deposit — `$149`
   - Automation / Connected Data diagnostic deposit — `$149`
2. Add the Stripe Price IDs to Cloudflare using the variable names above.
3. Add `STRIPE_SECRET_KEY` to Cloudflare secrets.
4. Create a webhook endpoint pointing to:

```text
https://YOUR_DOMAIN/api/stripe-webhook
```

5. Subscribe it to `checkout.session.completed`.
6. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Supabase setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `SUPABASE_URL` from project settings.
5. Create/copy the backend service role or secret key and add it to Cloudflare as `SUPABASE_SECRET_KEY`.
6. Add a strong random `SUPABASE_JOBS_EXPORT_TOKEN` if using `/api/jobs-export`.
7. Never expose `SUPABASE_SECRET_KEY` in browser/client-side code.

The schema enables RLS and intentionally creates no public policies for jobs, job events, or webhook events. Server-side Cloudflare Functions use `SUPABASE_SECRET_KEY` for trusted writes and private reads.

## Checkout and intake flow

- `POST /api/create-checkout-session` accepts `{ "package_id": "quick_fix" }`.
- The function validates the package server-side and uses the matching Stripe Price ID from Cloudflare variables.
- Checkout metadata includes `package_id`, `package_name`, `package_type`, and `expected_amount`.
- Success URL is `/success?session_id={CHECKOUT_SESSION_ID}`.
- Cancel URL is `/?checkout=cancelled`.
- `POST /api/stripe-webhook` verifies the raw Stripe signature, deduplicates via `webhook_events`, upserts the paid job by `stripe_checkout_session_id`, and inserts a `payment_completed` job event.
- `POST /api/submit-intake` requires a paid Stripe Checkout Session or existing paid Supabase job before updating intake details.

## Scope review guardrails

If Quick Fix or Spreadsheet Repair intake mentions API, BigQuery, Apps Script, external data, automation, database, dashboard build, multiple files, unclear access, connected sheet, or SQL, the job is marked `needs_scope_review` with `scope_review_required = true`.

## Google Apps Script email hook setup

1. Create a new Apps Script project.
2. Paste `docs/google-apps-script-email-webhook.js`.
3. Set Script Properties:
   - `EMAIL_NOTIFICATION_SECRET`
   - `ADMIN_NOTIFICATION_EMAIL`
   - `CUSTOMER_CONFIRMATION_FROM_NAME` optional
4. Deploy as a Web App.
5. Copy the Web App URL to `GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL` in Cloudflare.
6. Add the same `EMAIL_NOTIFICATION_SECRET` to Cloudflare.

If the email webhook fails, the customer intake still succeeds and a `notification_failed` job event is recorded.

## Google Sheets job queue setup

1. Create a Google Sheet.
2. Open **Extensions > Apps Script**.
3. Paste `docs/google-sheets-jobs-export.gs`.
4. Set Script Properties:
   - `JOBS_EXPORT_URL = https://YOUR_DOMAIN/api/jobs-export`
   - `JOBS_EXPORT_TOKEN = same value as SUPABASE_JOBS_EXPORT_TOKEN`
5. Run `refreshJobs()` and approve permissions.
6. Run `createHourlyTrigger()` if you want hourly refreshes.

`GET /api/jobs-export` requires `Authorization: Bearer ${SUPABASE_JOBS_EXPORT_TOKEN}`, reads the private `jobs_sheet_export` Supabase view server-side, supports `status`, `since`, and `limit`, and defaults to 500 rows.

## Admin route

`/admin/jobs` is a simple hidden admin page. If `ADMIN_PASSWORD` is set, enter it on the page; the API sends it as a bearer token to `/api/admin/jobs`.

## Updating packages

- Frontend display copy lives in `src/main.tsx`.
- Server-side package metadata lives in `functions/_lib/packages.ts`.
- Supabase seed rows live in `supabase/schema.sql`.
- Stripe Price IDs live in Cloudflare environment variables.
