import { json } from '../_lib/http';
import { createEmptyPaidJob } from '../_lib/jobs';
import { notifyAdmin } from '../_lib/notifications';

type Env = {
  STRIPE_WEBHOOK_SECRET: string;
  JOBS_KV: KVNamespace;
  ADMIN_NOTIFICATION_EMAIL?: string;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  PUBLIC_SITE_URL?: string;
};

type StripeSession = {
  id: string;
  object: 'checkout.session';
  payment_intent?: string;
  customer_details?: { email?: string; name?: string };
  customer_email?: string;
  amount_total?: number;
  payment_status?: 'paid' | 'unpaid' | 'no_payment_required';
  metadata?: Record<string, string>;
};

type StripeEvent = { id: string; type: string; data: { object: StripeSession } };

const encoder = new TextEncoder();
const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};

const verifyStripeSignature = async (payload: string, signatureHeader: string | null, secret: string) => {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signedPayload = `${timestamp}.${payload}`;
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  return safeEqual(hex(digest), signature);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Webhook secret is not configured.' }, 500);

  const rawBody = await request.text();
  const verified = await verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!verified) return json({ error: 'Invalid Stripe signature.' }, 400);

  const event = JSON.parse(rawBody) as StripeEvent;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const job = await createEmptyPaidJob(env, {
      checkoutSessionId: session.id,
      paymentIntent: session.payment_intent,
      customerEmail: session.customer_details?.email || session.customer_email,
      customerName: session.customer_details?.name,
      amountTotal: session.amount_total,
      paymentStatus: session.payment_status === 'paid' ? 'paid' : 'pending',
      packageId: session.metadata?.package_id,
      packageName: session.metadata?.package_name,
      packagePrice: session.metadata?.package_price,
      packageType: session.metadata?.package_type,
    });
    waitUntil(notifyAdmin(env, job, 'Payment received'));
  }

  return json({ received: true });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
