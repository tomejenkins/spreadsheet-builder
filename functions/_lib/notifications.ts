import { insertJobEvent, type JobRow, type SupabaseEnv } from './supabase';

type NotificationEnv = SupabaseEnv & {
  GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL?: string;
  EMAIL_NOTIFICATION_SECRET?: string;
};

export const notifyIntakeSubmitted = async (env: NotificationEnv, job: JobRow) => {
  if (!env.GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL) return;

  const payload = {
    secret: env.EMAIL_NOTIFICATION_SECRET,
    event_type: 'intake_submitted',
    job_id: job.id,
    package_name: job.package_name,
    amount_paid_cents: job.amount_paid_cents,
    customer_name: job.customer_name,
    customer_email: job.customer_email,
    customer_phone: job.customer_phone,
    business_name: job.business_name,
    spreadsheet_platform: job.spreadsheet_platform,
    desired_deadline: job.desired_deadline,
    project_description: job.project_description,
    broken_or_needed_details: job.broken_or_needed_details,
    file_link: job.file_link,
    access_notes: job.access_notes,
    scope_review_required: job.scope_review_required,
    stripe_checkout_session_id: job.stripe_checkout_session_id,
  };

  try {
    const response = await fetch(env.GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.EMAIL_NOTIFICATION_SECRET ? { 'x-notification-secret': env.EMAIL_NOTIFICATION_SECRET } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Google Apps Script webhook failed: ${response.status}`);
  } catch (error) {
    console.error('Notification failed', error);
    await insertJobEvent(env, job.id, 'notification_failed', {
      message: error instanceof Error ? error.message : 'Unknown notification error',
    });
  }
};
