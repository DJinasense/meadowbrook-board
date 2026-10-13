// Vercel serverless function: emails a Members-board post to every member who
// opted in under Settings -> "Notify me with important announcements".
//
// It runs only when the poster ticked "Email this to members" on the new-post
// form (the browser calls it right after the post is saved). A label such as
// Urgent is a visual flag and never sends email by itself. General-board posts
// are never emailed.
//
// Why a server function: it needs the Resend key and members' email addresses,
// neither of which may reach the browser.
//
// Who may send: the post's own author, or an admin. The caller's login token is
// checked with Supabase first. After that the function uses the service key
// for exactly four things (look up the caller, claim the post, list recipients,
// release the claim), each with explicit filters.
//
// Env vars (Vercel project settings):
//   RESEND_API_KEY              required (a send-only key is enough)
//   SUPABASE_SERVICE_ROLE_KEY   required. NEVER give it a VITE_ prefix: VITE_
//                               variables are bundled into the public website.
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY   already set for the frontend build
//   ANNOUNCE_FROM, SITE_URL     optional overrides

const FROM = process.env.ANNOUNCE_FROM || 'MeadowBrook Board <noreply@dgrvip.net>';
const SITE_URL = (process.env.SITE_URL || 'https://mbb7.us').replace(/\/$/, '');
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 100; // Resend's batch limit

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function excerpt(text, max = 600) {
  const clean = String(text || '').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

// PostgREST call as the service role. Callers build explicit filters.
async function db(path, { method = 'GET', body, returning = false } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(returning ? { Prefer: 'return=representation' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function buildEmail(post) {
  const link = `${SITE_URL}/thread/${post.id}`;
  const preview = excerpt(post.content);
  const subject = `MeadowBrook notice: ${post.title}`;
  const text = [
    'MeadowBrook Building 7 — notice from the Members board',
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
  <p style="color:#1d4ed8;font-weight:bold;margin:0 0 4px">Notice from the Members board &middot; MeadowBrook Building 7</p>
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
  if (!SERVICE_KEY) return res.status(500).json({ error: 'Email sending is not set up yet (missing SUPABASE_SERVICE_ROLE_KEY).' });
  if (!SUPABASE_URL || !ANON_KEY) return res.status(500).json({ error: 'Server is missing its Supabase settings.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const threadId = req.body && req.body.threadId;
  if (!token) return res.status(401).json({ error: 'Please log in again.' });
  if (!threadId || !/^[0-9a-f-]{36}$/i.test(threadId)) return res.status(400).json({ error: 'Missing or invalid post id.' });

  // 1. Who is calling? Supabase verifies the token; we never trust a user id from the browser.
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return res.status(401).json({ error: 'Please log in again.' });
  const caller = await who.json().catch(() => null);
  if (!caller || !/^[0-9a-f-]{36}$/i.test(caller.id || '')) return res.status(401).json({ error: 'Please log in again.' });

  const profile = await db(`users?id=eq.${caller.id}&select=is_admin,is_muted,is_suspended`);
  const me = profile.ok && Array.isArray(profile.data) ? profile.data[0] : null;
  if (!me) return res.status(403).json({ error: 'No member account found for this login.' });
  if (!me.is_admin && (me.is_muted || me.is_suspended)) return res.status(403).json({ error: 'Posting is paused on this account.' });

  // 2. Claim the post. One atomic update: only a live, not-yet-emailed Members
  //    post matches, and a non-admin only matches their own. That blocks double
  //    sends and anyone emailing a post that isn't theirs.
  const authorFilter = me.is_admin ? '' : `&user_id=eq.${caller.id}`;
  const claim = await db(
    `threads?id=eq.${threadId}&board=eq.members&announced_at=is.null&status=eq.visible${authorFilter}&select=id,title,content`,
    { method: 'PATCH', body: { announced_at: new Date().toISOString() }, returning: true },
  );
  if (!claim.ok) return res.status(502).json({ error: 'Could not check the post. Please try again.' });
  const post = Array.isArray(claim.data) ? claim.data[0] : null;
  if (!post) return res.status(409).json({ error: 'That post was already emailed, is not a Members post of yours, or is no longer live.' });

  const release = () => db(`threads?id=eq.${threadId}`, { method: 'PATCH', body: { announced_at: null } }).catch(() => {});

  try {
    // 3. Who gets it: everyone opted in and not suspended (the poster included).
    const rec = await db(`users?notify_announcements=eq.true&is_suspended=eq.false&email=not.is.null&select=email`);
    if (!rec.ok) throw new Error('Could not load the recipient list.');
    const recipients = [...new Set((rec.data || []).map((r) => r.email).filter(Boolean))];
    if (recipients.length === 0) {
      await release();
      return res.status(200).json({ sent: 0, note: 'No one has opted in yet, so nothing was sent.' });
    }

    // 4. One message per person (never a shared To/Cc, so addresses stay private).
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
        // If nothing went out yet, free the post so it can be retried; if some
        // batches already went, keep it marked sent so no one gets it twice.
        if (sent === 0) await release();
        const detail = await r.json().catch(() => ({}));
        return res.status(502).json({
          error: sent === 0
            ? `The email service refused the send${detail.message ? `: ${detail.message}` : ''}. Nothing was sent.`
            : `Sent to ${sent} of ${recipients.length} before the email service failed.`,
        });
      }
      sent += batch.length;
    }
    return res.status(200).json({ sent });
  } catch (err) {
    await release();
    return res.status(502).json({ error: `${err.message} Nothing was sent.` });
  }
}
