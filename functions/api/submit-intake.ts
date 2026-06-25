import { json } from '../_lib/http';
import { insertJobEvent, getJobBySession, updateJobBySession, upsertJobBySession, type JobRow } from '../_lib/supabase';
import { notifyIntakeSubmitted } from '../_lib/notifications';

type Env = { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string; STRIPE_SECRET_KEY: string; GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL?: string; EMAIL_NOTIFICATION_SECRET?: string };

type IntakePayload = {
  stripe_checkout_session_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  business_name?: string;
  spreadsheet_platform?: string;
  project_description?: string;
  project_goal?: string;
  broken_or_needed_details?: string;
  desired_deadline?: string;
  file_link?: string;
  access_notes?: string;
  terms_acknowledged?: boolean;
};

const requiredText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

const scopeReviewRequired = (packageId: string | undefined, text: string) => {
  if (packageId !== 'quick_fix' && packageId !== 'spreadsheet_repair') return false;
  return /(api|bigquery|apps script|external data|automation|database|dashboard build|multiple files|unclear access|connected sheet|sql)/i.test(text);
};

const retrieveStripeSession = async (env: Env, sessionId: string) => {
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const data = await response.json() as { id: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string; customer?: string; customer_details?: { email?: string; name?: string }; metadata?: Record<string, string>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || 'Unable to verify Stripe Checkout Session.');
  return data;
};

const ensurePaidJob = async (env: Env, sessionId: string) => {
  const existing = await getJobBySession(env, sessionId);
  if (existing?.payment_status === 'paid') return existing;
  const session = await retrieveStripeSession(env, sessionId);
  if (session.payment_status !== 'paid') return null;
  return upsertJobBySession(env, {
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : undefined,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : undefined,
    amount_paid_cents: session.amount_total,
    currency: session.currency || 'usd',
    payment_status: 'paid',
    status: 'paid_no_intake',
    package_id: session.metadata?.package_id,
    package_name: session.metadata?.package_name,
    package_type: session.metadata?.package_type,
    customer_email: existing?.customer_email || session.customer_details?.email,
    customer_name: existing?.customer_name || session.customer_details?.name,
    source: 'website',
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  let body: IntakePayload;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON request body.' }, 400); }

  if (!requiredText(body.stripe_checkout_session_id) || !requiredText(body.customer_name) || !requiredText(body.customer_email) || !requiredText(body.project_description) || !requiredText(body.broken_or_needed_details) || !requiredText(body.file_link)) {
    return json({ error: 'Please complete all required intake fields.' }, 400);
  }
  if (!body.terms_acknowledged) return json({ error: 'Please acknowledge the scope and guarantee terms.' }, 400);

  const sessionId = body.stripe_checkout_session_id!.trim();
  const paidJob = await ensurePaidJob(env, sessionId);
  if (!paidJob) return json({ error: 'Payment has not been confirmed for this checkout session.' }, 402);

  const review = scopeReviewRequired(paidJob.package_id, [body.project_description, body.project_goal, body.broken_or_needed_details, body.access_notes].join('\n'));
  const updates: JobRow = {
    customer_name: body.customer_name?.trim(),
    customer_email: body.customer_email?.trim(),
    customer_phone: body.customer_phone?.trim(),
    business_name: body.business_name?.trim(),
    spreadsheet_platform: body.spreadsheet_platform,
    project_description: body.project_description?.trim(),
    project_goal: body.project_goal?.trim(),
    broken_or_needed_details: body.broken_or_needed_details?.trim(),
    desired_deadline: body.desired_deadline?.trim(),
    file_link: body.file_link?.trim(),
    access_notes: body.access_notes?.trim(),
    terms_acknowledged: body.terms_acknowledged,
    scope_review_required: review,
    status: review ? 'needs_scope_review' : 'new_paid_intake_submitted',
  };

  const job = await updateJobBySession(env, sessionId, updates);
  await insertJobEvent(env, job?.id, 'intake_submitted', { intake: updates });
  waitUntil(notifyIntakeSubmitted(env, job));
  return json({ ok: true, job_id: job?.id, status: job?.status, scope_review_required: job?.scope_review_required });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
