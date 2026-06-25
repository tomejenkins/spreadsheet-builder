import { json } from '../_lib/http';
import { createEmptyPaidJob, getJobBySession, saveJob, scopeReviewReasons } from '../_lib/jobs';
import { notifyAdmin } from '../_lib/notifications';

type Env = {
  JOBS_KV: KVNamespace;
  ADMIN_NOTIFICATION_EMAIL?: string;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  PUBLIC_SITE_URL?: string;
};

type IntakePayload = {
  customerName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  spreadsheetPlatform?: string;
  packagePurchased?: string;
  checkoutSessionId?: string;
  projectDescription?: string;
  brokenOrBuildDetails?: string;
  desiredDeadline?: string;
  fileLink?: string;
  accessNotes?: string;
  scopeAcknowledged?: boolean;
};

const requiredText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  let body: IntakePayload;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400);
  }

  if (!requiredText(body.customerName) || !requiredText(body.email) || !requiredText(body.checkoutSessionId) || !requiredText(body.projectDescription) || !requiredText(body.brokenOrBuildDetails) || !requiredText(body.fileLink)) {
    return json({ error: 'Please complete all required intake fields.' }, 400);
  }
  if (!body.scopeAcknowledged) return json({ error: 'Please acknowledge the scope and guarantee terms.' }, 400);

  const sessionId = body.checkoutSessionId!.trim();
  const existing = await getJobBySession(env, sessionId);
  const baseJob = existing || await createEmptyPaidJob(env, { checkoutSessionId: sessionId, paymentStatus: 'pending' });
  const combinedScopeText = [body.projectDescription, body.brokenOrBuildDetails, body.accessNotes].join('\n');
  const reasons = scopeReviewReasons(baseJob.packageId || body.packagePurchased, combinedScopeText);

  const job = await saveJob(env, {
    ...baseJob,
    customerName: body.customerName?.trim(),
    customerEmail: body.email?.trim(),
    phone: body.phone?.trim(),
    businessName: body.businessName?.trim(),
    spreadsheetPlatform: body.spreadsheetPlatform,
    packageId: baseJob.packageId || body.packagePurchased,
    projectDescription: body.projectDescription?.trim(),
    brokenOrBuildDetails: body.brokenOrBuildDetails?.trim(),
    desiredDeadline: body.desiredDeadline?.trim(),
    fileLink: body.fileLink?.trim(),
    accessNotes: body.accessNotes?.trim(),
    scopeAcknowledged: body.scopeAcknowledged,
    intakeStatus: 'Submitted',
    jobStatus: reasons.length ? 'Needs Scope Review' : 'New',
    scopeReviewReasons: reasons,
  });

  waitUntil(notifyAdmin(env, job, 'Intake submitted'));
  return json({ ok: true, jobId: job.id, jobStatus: job.jobStatus, scopeReviewReasons: reasons });
};

export const onRequest: PagesFunction<Env> = async () => json({ error: 'Method not allowed.' }, 405);
