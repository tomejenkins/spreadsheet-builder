import { PACKAGES } from './packages';

export type SupabaseEnv = { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string };

export type JobRow = {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  payment_status?: string;
  scope_review_required?: boolean;
  package_id?: string;
  package_name?: string;
  package_type?: string;
  amount_paid_cents?: number;
  currency?: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  business_name?: string;
  spreadsheet_platform?: string;
  project_description?: string;
  project_goal?: string;
  broken_or_needed_details?: string;
  file_link?: string;
  access_notes?: string;
  desired_deadline?: string;
  terms_acknowledged?: boolean;
  source?: string;
};

const baseUrl = (env: SupabaseEnv) => env.SUPABASE_URL.replace(/\/$/, '');

const headers = (env: SupabaseEnv, prefer?: string) => ({
  apikey: env.SUPABASE_SECRET_KEY,
  authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  'content-type': 'application/json',
  ...(prefer ? { prefer } : {}),
});

const request = async <T>(env: SupabaseEnv, path: string, init: RequestInit = {}) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Supabase is not configured.');
  const response = await fetch(`${baseUrl(env)}/rest/v1/${path}`, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || `Supabase request failed: ${response.status}`;
    throw new Error(message);
  }
  return data as T;
};

export const upsertPackages = async (env: SupabaseEnv) => {
  const rows = Object.values(PACKAGES).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    package_type: pkg.type,
    price_cents: pkg.amount,
    currency: 'usd',
    is_deposit: pkg.isDeposit,
    active: true,
  }));
  await request(env, 'packages?on_conflict=id', {
    method: 'POST',
    headers: headers(env, 'resolution=merge-duplicates'),
    body: JSON.stringify(rows),
  });
};

export const getWebhookEvent = async (env: SupabaseEnv, id: string) => {
  const rows = await request<Array<{ id: string; processed_at?: string }>>(env, `webhook_events?id=eq.${encodeURIComponent(id)}&select=id,processed_at&limit=1`, { headers: headers(env) });
  return rows[0] || null;
};

export const insertWebhookEvent = async (env: SupabaseEnv, event: { id: string; provider: string; event_type: string; payload: unknown }) =>
  request(env, 'webhook_events', {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify(event),
  });

export const markWebhookProcessed = async (env: SupabaseEnv, id: string) =>
  request(env, `webhook_events?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(env),
    body: JSON.stringify({ processed_at: new Date().toISOString() }),
  });

export const getJobBySession = async (env: SupabaseEnv, sessionId: string) => {
  const rows = await request<JobRow[]>(env, `jobs?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`, { headers: headers(env) });
  return rows[0] || null;
};

export const upsertJobBySession = async (env: SupabaseEnv, job: JobRow) => {
  const rows = await request<JobRow[]>(env, 'jobs?on_conflict=stripe_checkout_session_id', {
    method: 'POST',
    headers: headers(env, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify(job),
  });
  return rows[0];
};

export const updateJobBySession = async (env: SupabaseEnv, sessionId: string, job: JobRow) => {
  const rows = await request<JobRow[]>(env, `jobs?stripe_checkout_session_id=eq.${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: headers(env, 'return=representation'),
    body: JSON.stringify({ ...job, updated_at: new Date().toISOString() }),
  });
  return rows[0];
};

export const insertJobEvent = async (env: SupabaseEnv, jobId: string | undefined, eventType: string, payload: unknown) => {
  if (!jobId) return;
  await request(env, 'job_events', {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ job_id: jobId, event_type: eventType, event_payload: payload }),
  });
};

export const listAdminJobs = async (env: SupabaseEnv, limit = 100) =>
  request<JobRow[]>(env, `jobs?select=*&order=created_at.desc&limit=${limit}`, { headers: headers(env) });

export const exportJobs = async (env: SupabaseEnv, params: { status?: string; since?: string; limit: number }) => {
  const query = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: String(params.limit) });
  if (params.status) query.set('status', `eq.${params.status}`);
  if (params.since) query.set('created_at', `gte.${params.since}`);
  return request<Record<string, unknown>[]>(env, `jobs_sheet_export?${query.toString()}`, { headers: headers(env) });
};
