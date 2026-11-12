const form = document.getElementById('inquiry-form');
const status = document.getElementById('form-status');
const submit = document.getElementById('submit-inquiry');
form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  submit.disabled = true;
  status.textContent = 'Sending your inquiry…';
  const data = Object.fromEntries(new FormData(form).entries());
  data.consent = Boolean(form.elements.consent.checked);
  try {
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Unable to send your inquiry right now.');
    form.reset();
    status.textContent = 'Thanks — your inquiry was sent. I’ll be in touch soon.';
  } catch (error) {
    status.textContent = error.message + ' You can also email tom@thomas-jenkins.net directly.';
  } finally { submit.disabled = false; }
});
