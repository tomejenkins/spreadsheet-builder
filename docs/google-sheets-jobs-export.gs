/**
 * Spreadsheet Fixer Google Sheets job queue export.
 * Script Properties required:
 * - JOBS_EXPORT_URL = https://YOUR_DOMAIN/api/jobs-export
 * - JOBS_EXPORT_TOKEN = same value as SUPABASE_JOBS_EXPORT_TOKEN in Cloudflare
 */
function refreshJobs() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('JOBS_EXPORT_URL');
  var token = props.getProperty('JOBS_EXPORT_TOKEN');
  var response = UrlFetchApp.fetch(url + '?limit=500', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: false
  });
  var jobs = JSON.parse(response.getContentText());
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Jobs') || ss.insertSheet('Jobs');
  var headers = ['job_id','created_at','updated_at','status','payment_status','scope_review_required','package_id','package_name','package_type','amount_paid_cents','amount_paid_dollars','customer_name','customer_email','customer_phone','business_name','spreadsheet_platform','desired_deadline','short_project_description','file_link','access_notes'];
  var rows = jobs.map(function(job) { return headers.map(function(header) { return job[header] || ''; }); });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function createHourlyTrigger() {
  ScriptApp.newTrigger('refreshJobs').timeBased().everyHours(1).create();
}

/**
 * Secondary option: direct Supabase REST reads can query jobs_sheet_export, but do not put Supabase keys in cells.
 * Store SUPABASE_URL and a private API key in Script Properties and restrict Sheet sharing if you use that approach.
 */
