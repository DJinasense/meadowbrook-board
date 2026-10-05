// Vercel serverless function: emails an admin-approved labeled post (urgent /
// building work / heads up) to every
// member who opted in under Settings -> "Notify me with important announcements".
//
// Why a server function: it needs the Resend key and members' email addresses,
// neither of which may reach the browser. It never holds a Supabase service key
// either. It forwards the caller's own login token to Supabase, so the database
// functions (all "Admins only") decide who is allowed:
//   admin_claim_announcement      marks the post sent (atomic; blocks double sends)
//   admin_announcement_recipients opted-in, not-suspended members' emails
//   admin_release_announcement    undoes the claim if the email provider fails
//
// Env vars (Vercel project settings):
//   RESEND_API_KEY            required (a send-only key is enough)
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY   already set for the frontend build
//   ANNOUNCE_FROM, SITE_URL   optional overrides

const FROM = process.env.ANNOUNCE_FROM || 'MeadowBrook Board <noreply@dgrvip.net>';
const SITE_URL = (process.env.SITE_URL || 'https://mbb7.us').replace(/\/$/, '');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const BATCH_SIZE = 100; // Resend's batch limit

// Wording and look per label; keys match threads.alert_type.
const KINDS = {
  urgent: { subject: 'Urgent', heading: 'Urgent notice', color: '#b91c1c', mark: '&#9733;', markText: '★' },
  construction: { subject: 'Building work', heading: 'Building work notice', color: '#c2410c', mark: '&#128679;', markText: '🚧' },
  attention: { subject: 'Heads up', heading: 'Heads up', color: '#a16207', mark: '&#9733;', markText: '★' },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function excerpt(text, max = 600) {
  const clean = String(text || '').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

async function rpc(name, args, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

function buildEmail(post) {
  const link = `${SITE_URL}/thread/${post.id}`;
  const preview = excerpt(post.content);
  const kind = KINDS[post.alert_type] || KINDS.attention;
  const subject = `${kind.subject}: ${post.title}`;
  const text = [
    `MeadowBrook Building 7 — ${kind.heading.toLowerCase()}`,
    '',
    post.title,
    '',
    preview,
    '',
    `Read it on the board: ${link}`,
    '',
    'You got this because you chose "Notify me with important announcements" in your board settings.',
    'To stop these emails, log in, open Settings, and uncheck that box.',
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <p style="color:${kind.color};font-weight:bold;margin:0 0 4px">${kind.mark} ${kind.heading} &middot; MeadowBrook Building 7</p>
  <h2 style="margin:0 0 12px">${escapeHtml(post.title)}</h2>
  <p style="white-space:pre-line;line-height:1.5;margin:0 0 16px">${escapeHtml(preview)}</p>
  <p style="margin:0 0 24px"><a href="${link}" style="background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Read it on the board</a></p>
  <p style="font-size:12px;color:#64748b;margin:0">You got this because you chose &ldquo;Notify me with important announcements&rdquo; in your board settings. To stop these emails, log in, open Settings, and uncheck that box.</p>
</div>`;
  return { subject, text, html };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email sending is not set up yet (missing RESEND_API_KEY).' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Server is missing its Supabase settings.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const threadId = req.body && req.body.threadId;
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  if (!threadId || !/^[0-9a-f-]{36}$/i.test(threadId)) return res.status(400).json({ error: 'Missing or invalid post id.' });

  // 1. Claim the post. Only an admin gets past this, and only once per post.
  const claim = await rpc('admin_claim_announcement', { p_thread: threadId }, token);
  if (!claim.ok) {
    const msg = claim.body && claim.body.message;
    if (msg && /admins only/i.test(msg)) return res.status(403).json({ error: 'Only admins can send announcements.' });
    if (claim.status === 401) return res.status(401).json({ error: 'Please log in again.' });
    return res.status(502).json({ error: 'Could not check the post. Please try again.' });
  }
  const post = Array.isArray(claim.body) ? claim.body[0] : null;
  if (!post) return res.status(409).json({ error: 'That post was already emailed, or is no longer a labeled live post.' });

  const release = () => rpc('admin_release_announcement', { p_thread: threadId }, token).catch(() => {});

  try {
    // 2. Who gets it.
    const rec = await rpc('admin_announcement_recipients', {}, token);
    if (!rec.ok) throw new Error('Could not load the recipient list.');
    const recipients = [...new Set((rec.body || []).map((r) => r.email).filter(Boolean))];
    if (recipients.length === 0) {
      await release();
      return res.status(200).json({ sent: 0, note: 'No one has opted in yet, so nothing was sent.' });
    }

    // 3. One message per person (never a shared To/Cc, so addresses stay private).
    const { subject, text, html } = buildEmail(post);
    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE).map((to) => ({ from: FROM, to: [to], subject, text, html }));
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!r.ok) {
        // If nothing went out yet, free the post so the admin can retry; if some
        // batches already went, keep it marked sent so no one gets it twice.
        if (sent === 0) await release();
        const detail = await r.json().catch(() => ({}));
        return res.status(502).json({
          error: sent === 0
            ? `The email service refused the send${detail.message ? `: ${detail.message}` : ''}. Nothing was sent; you can try again.`
            : `Sent to ${sent} of ${recipients.length} before the email service failed.`,
        });
      }
      sent += batch.length;
    }
    return res.status(200).json({ sent });
  } catch (err) {
    await release();
    return res.status(502).json({ error: `${err.message} Nothing was sent; you can try again.` });
  }
}
