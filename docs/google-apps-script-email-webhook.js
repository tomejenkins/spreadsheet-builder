/**
 * Spreadsheet Fixer email webhook.
 * Script Properties required:
 * - EMAIL_NOTIFICATION_SECRET
 * - ADMIN_NOTIFICATION_EMAIL
 * - CUSTOMER_CONFIRMATION_FROM_NAME optional
 * Deploy as a Web App and add the deployment URL to GOOGLE_APPS_SCRIPT_EMAIL_WEBHOOK_URL in Cloudflare.
 */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty('EMAIL_NOTIFICATION_SECRET');
  var adminEmail = props.getProperty('ADMIN_NOTIFICATION_EMAIL');
  var payload = JSON.parse(e.postData.contents || '{}');
  var headerSecret = e.parameter.secret || payload.secret;

  if (expectedSecret && headerSecret !== expectedSecret) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' })).setMimeType(ContentService.MimeType.JSON);
  }

  var subject = 'New Spreadsheet Fixer Job — ' + (payload.package_name || 'Unknown Package') + ' — ' + (payload.customer_name || 'Unknown Customer');
  var body = [
    'Event: ' + payload.event_type,
    'Job ID: ' + payload.job_id,
    'Package: ' + payload.package_name,
    'Amount paid cents: ' + payload.amount_paid_cents,
    'Customer: ' + payload.customer_name + ' <' + payload.customer_email + '>',
    'Phone: ' + (payload.customer_phone || ''),
    'Business: ' + (payload.business_name || ''),
    'Platform: ' + (payload.spreadsheet_platform || ''),
    'Deadline: ' + (payload.desired_deadline || ''),
    'Scope review required: ' + payload.scope_review_required,
    'Project description:\n' + (payload.project_description || ''),
    'Broken / needed details:\n' + (payload.broken_or_needed_details || ''),
    'File link: ' + (payload.file_link || ''),
    'Access notes:\n' + (payload.access_notes || ''),
    'Stripe session: ' + payload.stripe_checkout_session_id
  ].join('\n\n');

  MailApp.sendEmail(adminEmail, subject, body);

  if (payload.customer_email) {
    var fromName = props.getProperty('CUSTOMER_CONFIRMATION_FROM_NAME') || 'Spreadsheet Fixer';
    MailApp.sendEmail(payload.customer_email, 'Spreadsheet Fixer intake received', 'Thanks — your intake was received. I will review your spreadsheet details and follow up with next steps.\n\n' + fromName);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
