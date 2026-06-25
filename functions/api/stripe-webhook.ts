import { json } from '../_lib/http';
import { getWebhookEvent, insertJobEvent, insertWebhookEvent, markWebhookProcessed, upsertJobBySession, upsertPackages } from '../_lib/supabase';

type Env = { STRIPE_WEBHOOK_SECRET: string; SUPABASE_URL: string; SUPABASE_SECRET_KEY: string };

type StripeSession = {
  id: string;
  payment_intent?: string;
  customer?: string;
  customer_details?: { email?: string; name?: string };
  customer_email?: string;
  amount_total?: number;
  currency?: string;
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  metadata?: Record<string, string>;
};

type StripeEvent = { id: string; type: string; data: { object: StripeSession } };
const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const safeEqual = (a: string, b: string) => a.length === b.length && [...a].reduce((ok, char, index) => ok && char === b[index], true);

const verifyStripeSignature = async (payload: string, signatureHeader: string | null, secret: string) => {
  if (!signatureHeader || !secret) return false;
  const signatures = signatureHeader.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});
  const timestamp = signatures.t?.[0];
  const v1 = signatures.v1 || [];
  if (!timestamp || !v1.length) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return v1.some((signature) => safeEqual(digest, signature));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook secret is not configured.' }, 500);
  const rawBody = await request.text();
  const verified = await verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return json({ error: 'Invalid Stripe signature.' }, 400);

  const event = JSON.parse(rawBody) as StripeEvent;
  const existingEvent = await getWebhookEvent(env, event.id);
  if (existingEvent?.processed_at) return json({ received: true, duplicate: true });
  if (!existingEvent) await insertWebhookEvent(env, { id: event.id, provider: 'stripe', event_type: event.type, payload: event });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await upsertPackages(env);
    const job = await upsertJobBySession(env, {
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent,
      stripe_customer_id: session.customer,
      customer_email: session.customer_details?.email || session.customer_email,
      customer_name: session.customer_details?.name,
      amount_paid_cents: session.amount_total,
      currency: session.currency || 'usd',
      payment_status: session.payment_status === 'paid' ? 'paid' : 'unpaid',
      status: 'paid_no_intake',
      package_id: session.metadata?.package_id,
      package_name: session.metadata?.package_name,
      package_type: session.metadata?.package_type,
      source: 'website',
    });
    await insertJobEvent(env, job?.id, 'payment_completed', { stripe_event_id: event.id, session });
  }

  await markWebhookProcessed(env, event.id);
  return json({ received: true });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
