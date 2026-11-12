const allowedServices = new Set(['Reporting & dashboards', 'Workflow automation', 'Operations improvement', 'Not sure yet']);
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export async function onRequestPost({ request, env }) {
  if (Number(request.headers.get('content-length') || 0) > 12000) return response({ error: 'Submission too large.' }, 413);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return response({ error: 'Invalid origin.' }, 403);
  let data;
  try { data = await request.json(); } catch { return response({ error: 'Invalid submission.' }, 400); }
  if (data.website) return response({ ok: true }); // Honeypot: silently discard automated submissions.
  const name = clean(data.name, 100), email = clean(data.email, 200), company = clean(data.company, 120);
  const service = clean(data.service, 80), message = clean(data.message, 3000);
  if (!name || !company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowedServices.has(service) || message.length < 15 || data.consent !== true) return response({ error: 'Please complete all required fields.' }, 400);
  if (!env.RESEND_API_KEY) return response({ error: 'Contact form is not configured yet.' }, 503);
  const payload = {
    from: env.CONTACT_FROM || 'Thomas Jenkins Website <inquiries@thomas-jenkins.net>',
    to: ['tom@thomas-jenkins.net'],
    reply_to: email,
    subject: 'New consulting inquiry: ' + service,
    text: ['New consulting inquiry', '', 'Name: ' + name, 'Email: ' + email, 'Company: ' + company, 'Service: ' + service, '', 'Project details:', message].join('\n')
  };
  try {
    const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!result.ok) { console.error('Contact email provider error:', result.status); return response({ error: 'Message delivery is temporarily unavailable.' }, 502); }
    return response({ ok: true });
  } catch { return response({ error: 'Message delivery is temporarily unavailable.' }, 502); }
}
