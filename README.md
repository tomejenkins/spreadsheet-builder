# Spreadsheet Fixer

A production-ready Vite + React + TypeScript landing page and Stripe Checkout flow for an online spreadsheet repair and custom tracker/dashboard service at `thomas-jenkins.net`.

## Overview

Spreadsheet Fixer helps small businesses repair broken Google Sheets/Excel files, clean up messy workbooks, fix dashboards, and build new trackers, dashboards, and light automation workflows.

The app is designed for GitHub-backed Cloudflare Pages deployment and uses Cloudflare Pages Functions for the server-side Stripe Checkout Session API.

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Cloudflare Pages
- Cloudflare Pages Functions
- Stripe Checkout via direct server-side `fetch`

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

For full Cloudflare Pages local development, use Wrangler:

```bash
npx wrangler pages dev dist --compatibility-date=2024-10-01
```

A typical workflow is:

```bash
npm run build
npx wrangler pages dev dist --compatibility-date=2024-10-01
```

## Required environment variables

Set these in Cloudflare Pages **Settings → Environment variables** for production and preview environments. Do not commit real secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Server-only Stripe secret key used by `/api/create-checkout-session`. |
| `PUBLIC_SITE_URL` | Yes | Canonical site URL, for example `https://thomas-jenkins.net`. |
| `PUBLIC_INTAKE_FORM_URL` | Yes | Intake form URL used after successful checkout and for custom quote requests. |
| `STRIPE_SUCCESS_PATH` | No | Defaults to `/success`. |
| `STRIPE_CANCEL_PATH` | No | Defaults to `/cancel`. |

For client-side Vite builds, you may also set `VITE_INTAKE_FORM_URL` if you want the browser bundle to use a Vite-prefixed value. The app falls back to `PUBLIC_INTAKE_FORM_URL` and then to a contact email link.

## Cloudflare Pages deployment

Connect the GitHub repository to Cloudflare Pages.

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Framework preset:** Vite or None
- **Production branch:** your chosen main branch

Cloudflare Pages automatically detects functions in the `functions/` directory. The checkout endpoint is deployed at:

```text
POST /api/create-checkout-session
```

## Stripe checkout flow

1. A customer clicks **Pay & Start** on a package card.
2. The browser sends only `{ "packageKey": "..." }` to `/api/create-checkout-session`.
3. The Pages Function validates the package key and maps it to a trusted server-side amount.
4. The function creates a Stripe Checkout Session with `mode=payment` using `application/x-www-form-urlencoded`.
5. Stripe redirects the customer to hosted checkout.
6. After payment, Stripe redirects to `${PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`.
7. If canceled, Stripe redirects to `${PUBLIC_SITE_URL}/cancel`.

`STRIPE_SECRET_KEY` is only read inside the Cloudflare Pages Function and is never exposed to client code.

## Updating packages and prices

- Frontend display cards are defined in `src/main.tsx`.
- Trusted checkout amounts are defined server-side in `functions/api/create-checkout-session.ts`.

When changing prices, update both places so marketing copy and server-side Stripe amounts stay aligned. The server-side function remains the source of truth for payment amounts.

## Pages included

- `/` landing page
- `/success` payment success and intake CTA
- `/cancel` checkout canceled page
- `/privacy` starter privacy page
- `/terms` starter terms page

The Privacy and Terms pages include starter placeholder language and should be reviewed before publishing.
