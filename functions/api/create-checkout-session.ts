interface Env {
  STRIPE_SECRET_KEY: string;
  PUBLIC_SITE_URL: string;
  PUBLIC_INTAKE_FORM_URL: string;
  STRIPE_SUCCESS_PATH?: string;
  STRIPE_CANCEL_PATH?: string;
}

type PackageKey = 'quick-fix' | 'spreadsheet-cleanup' | 'dashboard-repair' | 'starter-build';

const packages: Record<PackageKey, { name: string; amount: number; description: string }> = {
  'quick-fix': { name: 'Quick Fix', amount: 4900, description: 'One specific spreadsheet issue repair.' },
  'spreadsheet-cleanup': { name: 'Spreadsheet Cleanup', amount: 9900, description: 'Clean up and improve an existing workbook, tracker, or report.' },
  'dashboard-repair': { name: 'Dashboard Repair', amount: 14900, description: 'Repair or improve an existing dashboard or KPI report.' },
  'starter-build': { name: 'Starter Tracker or Dashboard Build', amount: 19900, description: 'Simple new tracker, reporting template, or dashboard.' },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.PUBLIC_SITE_URL || !env.PUBLIC_INTAKE_FORM_URL) {
    return json({ error: 'Checkout is not configured.' }, 500);
  }

  let body: { packageKey?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  const packageKey = body.packageKey as PackageKey | undefined;
  if (!packageKey || !(packageKey in packages)) {
    return json({ error: 'Invalid package selected.' }, 400);
  }

  const selected = packages[packageKey];
  const siteUrl = env.PUBLIC_SITE_URL.replace(/\/$/, '');
  const successPath = env.STRIPE_SUCCESS_PATH || '/success';
  const cancelPath = env.STRIPE_CANCEL_PATH || '/cancel';

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${siteUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}${cancelPath}`);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(selected.amount));
  params.set('line_items[0][price_data][product_data][name]', selected.name);
  params.set('line_items[0][price_data][product_data][description]', selected.description);
  params.set('metadata[package_key]', packageKey);

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
