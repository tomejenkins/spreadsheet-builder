import { json } from '../_lib/http';
import { exportJobs } from '../_lib/supabase';

type Env = { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string; SUPABASE_JOBS_EXPORT_TOKEN?: string };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SUPABASE_JOBS_EXPORT_TOKEN) return json({ error: 'Jobs export token is not configured.' }, 500);
  if (request.headers.get('authorization') !== `Bearer ${env.SUPABASE_JOBS_EXPORT_TOKEN}`) return json({ error: 'Unauthorized.' }, 401);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') || 500), 1000);
  const jobs = await exportJobs(env, {
    status: url.searchParams.get('status') || undefined,
    since: url.searchParams.get('since') || undefined,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 500,
  });
  return json(jobs);
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
