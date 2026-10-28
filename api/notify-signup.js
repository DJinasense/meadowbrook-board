// Vercel serverless function: emails the site owner when a new member signs up.
//
// Supabase calls this from a Database Webhook on INSERT into public.users
// (Supabase -> Database -> Webhooks). A users row is only created once the
// person confirms their email, so each email means a confirmed signup.
//
// Env vars (Vercel project settings):
//   RESEND_API_KEY            required (same key the announcement emails use)
//   SIGNUP_WEBHOOK_SECRET     required. Long random string; the same value goes
//                             in the webhook's "x-webhook-secret" header.
//   SIGNUP_NOTIFY_EMAIL       optional. Who gets the email. Defaults to the owner.
//   ANNOUNCE_FROM             optional override of the sender address

const FROM = process.env.ANNOUNCE_FROM || 'MeadowBrook Board <noreply@dgrvip.net>';
const NOTIFY_TO = process.env.SIGNUP_NOTIFY_EMAIL || 'dgromensky@gmail.com';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Constant-time comparison so the secret can't be guessed by timing.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });
  const secret = process.env.SIGNUP_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'Missing SIGNUP_WEBHOOK_SECRET' });

  if (!sameSecret(req.headers['x-webhook-secret'], secret)) {
    return res.status(401).json({ error: 'Not authorised' });
  }

  // Supabase sends { type, table, schema, record, old_record }. Only act on new rows.
  const body = req.body || {};
  if (body.type !== 'INSERT' || body.table !== 'users' || !body.record) {
    return res.status(200).json({ skipped: true });
  }

  const r = body.record;
  const when = r.created_at ? new Date(r.created_at).toUTCString() : new Date().toUTCString();
  const name = r.username || '(no display name)';
  const unit = r.apartment || 'not given';
  const email = r.email || 'no email on file';

  const subject = `New MeadowBrook signup: ${name}`;
  const text = [
    'A new member has confirmed their email and joined the board.',
    '',
    `Display name: ${name}`,
    `Unit: ${unit}`,
    `Email: ${email}`,
    `Signed up: ${when}`,
    '',
    'Manage members in the Admin Dashboard on https://mbb7.us',
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <h2 style="margin:0 0 12px">New member signed up</h2>
  <table style="border-collapse:collapse;font-size:15px">
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Display name</td><td>${escapeHtml(name)}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Unit</td><td>${escapeHtml(unit)}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Email</td><td>${escapeHtml(email)}</td></tr>
    <tr><td style="padding:4px 14px 4px 0;color:#64748b">Signed up</td><td>${escapeHtml(when)}</td></tr>
  </table>
  <p style="margin:20px 0 0"><a href="https://mbb7.us/admin" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the Admin Dashboard</a></p>
</div>`;

  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [NOTIFY_TO], subject, text, html }),
  });
  if (!send.ok) {
    const detail = await send.json().catch(() => ({}));
    // A non-2xx here makes Supabase retry the webhook, so report it honestly.
    return res.status(502).json({ error: `Email service refused the send${detail.message ? `: ${detail.message}` : ''}` });
  }
  return res.status(200).json({ sent: true });
}
