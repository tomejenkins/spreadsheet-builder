export type JobStatus = 'New' | 'Reviewing' | 'Waiting on Customer' | 'In Progress' | 'Delivered' | 'Complete' | 'Refunded / Canceled' | 'Needs Scope Review';

export type JobRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  checkoutSessionId: string;
  paymentIntent?: string;
  customerEmail?: string;
  customerName?: string;
  phone?: string;
  businessName?: string;
  spreadsheetPlatform?: string;
  packageId?: string;
  packageName?: string;
  packagePrice?: string;
  packageType?: string;
  amountTotal?: number;
  paymentStatus: 'pending' | 'paid' | 'unpaid' | 'refunded' | 'canceled';
  intakeStatus: 'Not Submitted' | 'Submitted';
  jobStatus: JobStatus;
  projectDescription?: string;
  brokenOrBuildDetails?: string;
  desiredDeadline?: string;
  fileLink?: string;
  accessNotes?: string;
  scopeAcknowledged?: boolean;
  scopeReviewReasons?: string[];
};

export type JobListItem = JobRecord;

type JobStorageEnv = { JOBS_KV?: KVNamespace };

const jobKey = (id: string) => `job:${id}`;
const sessionKey = (sessionId: string) => `session:${sessionId}`;
const indexKey = (createdAt: string, id: string) => `job-index:${createdAt}:${id}`;

const makeId = () => `job_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

const requireKv = (env: JobStorageEnv) => {
  if (!env.JOBS_KV) throw new Error('JOBS_KV binding is not configured.');
  return env.JOBS_KV;
};

export const createEmptyPaidJob = async (env: JobStorageEnv, input: Partial<JobRecord> & { checkoutSessionId: string }) => {
  const existing = await getJobBySession(env, input.checkoutSessionId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const job: JobRecord = {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    ...input,
    checkoutSessionId: input.checkoutSessionId,
    paymentStatus: input.paymentStatus || 'paid',
    intakeStatus: 'Not Submitted',
    jobStatus: 'New',
  };
  await saveJob(env, job);
  return job;
};

export const getJobBySession = async (env: JobStorageEnv, checkoutSessionId: string) => {
  const kv = requireKv(env);
  const id = await kv.get(sessionKey(checkoutSessionId));
  if (!id) return null;
  const raw = await kv.get(jobKey(id));
  return raw ? (JSON.parse(raw) as JobRecord) : null;
};

export const saveJob = async (env: JobStorageEnv, job: JobRecord) => {
  const kv = requireKv(env);
  const updated = { ...job, updatedAt: new Date().toISOString() };
  await kv.put(jobKey(updated.id), JSON.stringify(updated));
  await kv.put(sessionKey(updated.checkoutSessionId), updated.id);
  await kv.put(indexKey(updated.createdAt, updated.id), updated.id);
  return updated;
};

export const listJobs = async (env: JobStorageEnv, limit = 100) => {
  const kv = requireKv(env);
  const listed = await kv.list({ prefix: 'job-index:', limit });
  const jobs = await Promise.all(
    listed.keys.map(async (key) => {
      const id = await kv.get(key.name);
      if (!id) return null;
      const raw = await kv.get(jobKey(id));
      return raw ? (JSON.parse(raw) as JobRecord) : null;
    }),
  );
  return jobs.filter((job): job is JobRecord => Boolean(job)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const scopeReviewReasons = (packageId: string | undefined, text: string) => {
  if (packageId !== 'quick_fix' && packageId !== 'spreadsheet_repair') return [];
  const checks: Array<[RegExp, string]> = [
    [/(api|apis|connector|connected data|external data|third-party|third party)/i, 'Mentions external data, API, or connector work'],
    [/(bigquery|database|sql|supabase|neon|d1)/i, 'Mentions database or warehouse work'],
    [/(apps script|script|automation|automate|email alert|scheduled refresh)/i, 'Mentions Apps Script or automation'],
    [/(dashboard build|new dashboard|build a dashboard|tracker build|new tracker|from scratch)/i, 'Mentions a new dashboard/tracker build'],
    [/(multiple files|many files|several files|folder of files)/i, 'Mentions multiple files'],
    [/(not sure|unclear|unknown|figure out)/i, 'Requirements may be unclear'],
  ];
  return checks.filter(([pattern]) => pattern.test(text)).map(([, reason]) => reason);
};
