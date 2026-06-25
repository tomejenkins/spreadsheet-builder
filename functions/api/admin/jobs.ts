import { json } from '../../_lib/http';
import { listAdminJobs } from '../../_lib/supabase';

type Env = { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string; ADMIN_PASSWORD?: string };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (env.ADMIN_PASSWORD) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.ADMIN_PASSWORD}`) return json({ error: 'Unauthorized.' }, 401);
  }
  return json({ jobs: await listAdminJobs(env, 100) });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
