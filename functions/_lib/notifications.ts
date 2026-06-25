import type { JobRecord } from './jobs';

type NotificationEnv = {
  ADMIN_NOTIFICATION_EMAIL?: string;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  PUBLIC_SITE_URL?: string;
};

const money = (amount?: number) => (amount ? `$${(amount / 100).toFixed(2)}` : 'Unknown');

const jobSummary = (job: JobRecord) => {
  const adminUrl = job.checkoutSessionId ? `${job.checkoutSessionId}` : job.id;
  return [
    `Job ID: ${job.id}`,
    `Status: ${job.jobStatus}`,
    `Package: ${job.packageName || job.packageId || 'Unknown'}`,
    `Amount paid: ${money(job.amountTotal)}`,
    `Customer: ${job.customerName || 'Unknown'} <${job.customerEmail || 'unknown'}>`,
    job.phone ? `Phone: ${job.phone}` : undefined,
    job.spreadsheetPlatform ? `Platform: ${job.spreadsheetPlatform}` : undefined,
    job.desiredDeadline ? `Deadline: ${job.desiredDeadline}` : undefined,
    job.fileLink ? `File/access link: ${job.fileLink}` : undefined,
    job.projectDescription ? `Project: ${job.projectDescription}` : undefined,
    job.brokenOrBuildDetails ? `Details: ${job.brokenOrBuildDetails}` : undefined,
    job.scopeReviewReasons?.length ? `Scope review: ${job.scopeReviewReasons.join('; ')}` : undefined,
    `Stripe checkout session: ${job.checkoutSessionId}`,
    `Admin lookup: ${adminUrl}`,
  ].filter(Boolean).join('\n');
};

export const notifyAdmin = async (env: NotificationEnv, job: JobRecord, subjectPrefix = 'Spreadsheet job update') => {
  const subject = `${subjectPrefix}: ${job.packageName || job.packageId || 'Unknown package'}${job.jobStatus === 'Needs Scope Review' ? ' — needs scope review' : ''}`;
  const text = jobSummary(job);
  const tasks: Promise<Response>[] = [];

  if (env.SLACK_WEBHOOK_URL) {
    tasks.push(fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `*${subject}*\n\n\`\`\`\n${text}\n\`\`\`` }),
    }));
  }

  if (env.ADMIN_NOTIFICATION_EMAIL && env.RESEND_API_KEY) {
    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'Spreadsheet Fixer <notifications@thomas-jenkins.net>',
        to: [env.ADMIN_NOTIFICATION_EMAIL],
        subject,
        text,
      }),
    }));
  } else if (env.ADMIN_NOTIFICATION_EMAIL && env.SENDGRID_API_KEY) {
    tasks.push(fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: env.ADMIN_NOTIFICATION_EMAIL }] }],
        from: { email: 'notifications@thomas-jenkins.net', name: 'Spreadsheet Fixer' },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    }));
  }

  await Promise.allSettled(tasks);
};
