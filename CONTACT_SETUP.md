# Contact workflow setup

The contact form submits to the Cloudflare Pages Function at `/api/contact`, which emails the inquiry to `tom@thomas-jenkins.net` using Resend. No client-side email API key is exposed.

## Required setup

1. In Resend, verify `thomas-jenkins.net` as a sending domain. Follow Resend's current DNS instructions carefully, preserving Google Workspace MX, SPF, DKIM and DMARC records. If needed, use a dedicated sending subdomain rather than modifying the Workspace sending domain.
2. In the existing Cloudflare Pages project's **Settings → Variables and Secrets**, add `RESEND_API_KEY` as an encrypted secret. Set `CONTACT_FROM` to a verified sender, e.g. `Thomas Jenkins Website <inquiries@thomas-jenkins.net>` (or an address at your verified sending subdomain).
3. Confirm Cloudflare Pages deploys the repository root with `npm run build` and output directory `dist`. The `functions/` directory is picked up by Cloudflare Pages during Git deployments.
4. Submit a test inquiry and verify receipt in `tom@thomas-jenkins.net`. Test invalid fields, spam honeypot, and the direct email fallback.

## Security and limitations

The form validates fields server-side, uses a hidden honeypot and same-origin check, and never publishes the Resend API key. For public launch, add Cloudflare Turnstile or WAF rate limits to mitigate high-volume spam; honeypots alone are not sufficient. No automated acknowledgment is sent and no lead data is stored in a database. Replies go directly to the prospect via the email's Reply-To header. Do not claim form delivery works until the sending domain, secret and test have been verified.
