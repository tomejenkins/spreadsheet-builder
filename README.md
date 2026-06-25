# Spreadsheet Fixer

A production-ready Vite + React + TypeScript landing page, Stripe Checkout flow, intake form, webhook handler, and simple Cloudflare KV-backed job queue for a spreadsheet repair / dashboard build service at `thomas-jenkins.net`.

## Overview

Spreadsheet Fixer helps small businesses repair Excel and Google Sheets files, build dashboards and trackers, and scope spreadsheet automations or connected-data workflows. This version intentionally uses transparent package-based pricing instead of an AI quoter.

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare KV for durable job storage
- Stripe Checkout via direct server-side `fetch`
- Resend or SendGrid email notifications, plus optional Slack webhook notifications

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

For full Cloudflare Pages local development with Functions and KV bindings, build first and run Wrangler Pages dev:

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2024-10-01 --kv=JOBS_KV
```

## Cloudflare Pages deployment

Connect the GitHub repository to Cloudflare Pages.

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Framework preset:** Vite or None

Create a Cloudflare KV namespace for job storage and bind it to the Pages project as `JOBS_KV` in production and preview.

## Required environment variables and bindings

Set these in Cloudflare Pages **Settings → Environment variables**. Store secrets as encrypted secrets where possible. Do not commit real values.

| Variable / binding | Required | Purpose |
| --- | --- | --- |
| `JOBS_KV` | Yes | Cloudflare KV namespace binding used for job/payment/intake records. |
| `STRIPE_SECRET_KEY` | Yes | Server-only Stripe secret key used by `/api/create-checkout-session`. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret used by `/api/stripe-webhook`. |
| `STRIPE_PRICE_QUICK_FIX` | Yes | Stripe Price ID for Quick Fix ($99). |
| `STRIPE_PRICE_SPREADSHEET_REPAIR` | Yes | Stripe Price ID for Spreadsheet Repair ($249). |
| `STRIPE_PRICE_CUSTOM_DEPOSIT` | Yes | Stripe Price ID for Custom Tracker / Dashboard Build deposit ($149). |
| `STRIPE_PRICE_AUTOMATION_DEPOSIT` | Yes | Stripe Price ID for Automation / Connected Data diagnostic deposit ($149). |
| `PUBLIC_SITE_URL` | Yes | Canonical site URL, for example `https://thomas-jenkins.net`. |
| `ADMIN_NOTIFICATION_EMAIL` | Recommended | Admin recipient for job notifications. |
| `RESEND_API_KEY` or `SENDGRID_API_KEY` | Recommended | Email provider key for admin notifications. |
| `SLACK_WEBHOOK_URL` | Optional | Sends job/payment notifications to Slack. |
| `ADMIN_API_TOKEN` | Recommended | Bearer token required by `/api/admin/jobs` and the `/admin/jobs` page. |
| `STRIPE_SUCCESS_PATH` | Optional | Defaults to `/success`. |
| `STRIPE_CANCEL_PATH` | Optional | Defaults to `/cancel`. |

## Stripe setup checklist

1. In the Stripe Dashboard, create Prices for:
   - Quick Fix — `$99`
   - Spreadsheet Repair — `$249`
   - Custom Tracker / Dashboard Build deposit — `$149`
   - Automation / Connected Data diagnostic deposit — `$149`
2. Copy the four Stripe Price IDs into the Cloudflare environment variables listed above.
3. Create a Stripe webhook endpoint pointing to:

```text
https://thomas-jenkins.net/api/stripe-webhook
```

4. Subscribe the webhook endpoint to `checkout.session.completed`.
5. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Checkout, payment, and job flow

1. A customer selects one of the four package cards.
2. The browser sends only `{ "packageId": "..." }` to `/api/create-checkout-session`.
3. The Pages Function validates the package and uses the trusted Stripe Price ID from Cloudflare environment variables.
4. Stripe Checkout receives package metadata: `package_id`, `package_name`, `package_price`, and `package_type`.
5. Stripe redirects to `/success?session_id={CHECKOUT_SESSION_ID}` after payment.
6. Stripe also sends `checkout.session.completed` to `/api/stripe-webhook`.
7. The webhook verifies the Stripe signature using the raw body and `STRIPE_WEBHOOK_SECRET`.
8. The webhook creates or updates a KV job record idempotently by checkout session ID and marks payment as paid.
9. The customer submits the intake form on the success page.
10. `/api/submit-intake` updates the same job record with file/access details, requirements, deadline, scope acknowledgement, and scope-review flags.
11. Intake submission sends an admin email and/or Slack notification when notification variables are configured.

## Job storage abstraction

Job persistence lives behind helper functions in `functions/_lib/jobs.ts`. It currently uses Cloudflare KV through the `JOBS_KV` binding. The same helper boundary can later be moved to D1, Supabase, Neon, or another database without rewriting every API route.

## Admin job queue

A simple hidden admin route exists at:

```text
/admin/jobs
```

It calls:

```text
GET /api/admin/jobs
```

If `ADMIN_API_TOKEN` is set, enter that token in the page before loading jobs. The queue displays job ID, created date, customer, package, payment status, intake status, job status, deadline, and a short project description.

## Scope guardrails

If a customer selects Quick Fix or Spreadsheet Repair but intake details mention API work, BigQuery, Apps Script, external data, automation, database work, dashboard builds, multiple files, or unclear requirements, the job is flagged as `Needs Scope Review` and the reasons are included in the admin notification.

## Updating packages and prices

- Frontend cards are defined in `src/main.tsx`.
- Trusted package metadata is defined in `functions/_lib/packages.ts`.
- Stripe Price IDs are stored in Cloudflare environment variables.

When changing prices, update Stripe, Cloudflare variables, frontend display copy, and server-side package metadata.
