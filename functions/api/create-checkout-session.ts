import { json } from '../_lib/http';
import { getPackage } from '../_lib/packages';

interface Env {
  STRIPE_SECRET_KEY: string;
  PUBLIC_SITE_URL: string;
  PUBLIC_INTAKE_FORM_URL: string;
  STRIPE_PRICE_QUICK_FIX: string;
  STRIPE_PRICE_SPREADSHEET_REPAIR: string;
  STRIPE_PRICE_CUSTOM_DEPOSIT: string;
  STRIPE_PRICE_AUTOMATION_DEPOSIT: string;
  STRIPE_SUCCESS_PATH?: string;
  STRIPE_CANCEL_PATH?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.PUBLIC_SITE_URL) {
    return json({ error: 'Checkout is not configured.' }, 500);
  }

  let body: { packageId?: string; packageKey?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  const selected = getPackage(body.packageId || body.packageKey);
  if (!selected) return json({ error: 'Invalid package selected.' }, 400);

  const stripePriceId = env[selected.stripePriceEnv as keyof Env];
  if (!stripePriceId) {
    return json({ error: `Stripe Price ID missing for ${selected.name}. Create the Price in Stripe and set ${selected.stripePriceEnv} in Cloudflare Pages.` }, 500);
  }

  const siteUrl = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const successPath = env.STRIPE_SUCCESS_PATH || '/success';
  const cancelPath = env.STRIPE_CANCEL_PATH || '/cancel';

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}${cancelPath}`);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price]', stripePriceId);
  params.set('metadata[package_id]', selected.id);
  params.set('metadata[package_name]', selected.name);
  params.set('metadata[package_price]', selected.priceLabel);
  params.set('metadata[package_type]', selected.type);
  params.set('payment_intent_data[metadata][package_id]', selected.id);
  params.set('payment_intent_data[metadata][package_name]', selected.name);
  params.set('payment_intent_data[metadata][package_price]', selected.priceLabel);
  params.set('payment_intent_data[metadata][package_type]', selected.type);
  params.set('allow_promotion_codes', 'true');
  params.set('customer_creation', 'if_required');

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const stripeBody = await stripeResponse.json() as { url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !stripeBody.url) {
    return json({ error: stripeBody.error?.message || 'Stripe checkout session could not be created.' }, 502);
  }

  return json({ url: stripeBody.url });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
