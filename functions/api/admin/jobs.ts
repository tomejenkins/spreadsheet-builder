import { json } from '../../_lib/http';
import { listJobs } from '../../_lib/jobs';

type Env = { JOBS_KV: KVNamespace; ADMIN_API_TOKEN?: string };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (env.ADMIN_API_TOKEN) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.ADMIN_API_TOKEN}`) return json({ error: 'Unauthorized.' }, 401);
  }

  const jobs = await listJobs(env, 100);
  return json({ jobs });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
