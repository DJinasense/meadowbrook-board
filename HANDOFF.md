# MeadowBrook Board — handoff (written 2026-10-13)

Read this first in a new session, then CLAUDE.md. CLAUDE.md is the detailed
technical history; this file is the current state, what is waiting on the
owner, and what's next.

## Where things stand

**Live on mbb7.us (`main`):**
- Single-building board, open signup, email + display name + password.
- Archives page (documents, folder + date) — fix in PR #3, merged 2026-10-12.
- Landing page with General and Members cards — PR #2, merged.
- Two-board *code* (`/board` General, `/members` Members) — PR #1, merged.
  **But the database change it needs has NOT been run yet** (see "Blocking").

**Open draft PRs:**
- **PR #4** `claude/urgent-auto-email` — Urgent posts email members
  automatically; Building work / Heads up never email; unit "Confirm" review
  removed; "Signups per unit" panel added in Admin → Members.
  Vercel preview builds fine. Not merged.
- This branch (`docs/handoff`) — this file plus a pointer in CLAUDE.md.

## Blocking launch (in this order)

1. **Vercel env vars** (owner does this, from the laptop):
   - `RESEND_API_KEY` (send-only), if not already there.
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API →
     `service_role`. **Never prefix with `VITE_`** (it would be published to
     every browser). Redeploy after adding.
2. **Run `supabase_two_boards.sql`** in the Supabase SQL Editor, then its
   VERIFY queries at the bottom. Until this runs, the live site's two-board
   code reads a `threads.board` column that doesn't exist. Run it **before**
   the next deploy that matters. It moves every existing thread to the
   Members board (General starts empty) — that's intended.
3. **Merge PR #4.**
4. **Test one real member email** from a second account with announcements on:
   tick "Email this to members" on a Members post. Expect: a real email arrives,
   the poster sees "Emailed to N members".
   Nothing has ever been sent through the real Resend/Supabase path.
5. **Run `supabase_label_cap_and_default_notify.sql`** in the Supabase SQL Editor
   (Urgent cap 3/24h; new signups default to member emails on). Then run its VERIFY lines.

Goal: single-building version launched by Wednesday 2026-10-15.

## What members can and can't do (current)

- **Guests:** read + post anonymously on General only. No replies, likes,
  labels, archives, or uploads.
- **Members:** both boards, replies, likes, uploads (photo/PDF/Word/Excel,
  25 MB), private messages, edit/delete own posts, Archives, labels.
- **Labels:** Urgent, Building work and Heads up are visual flags only, never
  emailed. Email is a separate "Email this to members" checkbox on Members-board
  posts and archive filings (never General). Max 3 Urgent posts per member per
  rolling 24 h; other labels are not capped (`supabase_label_cap_and_default_notify.sql`).
- **Units:** picked at signup from Apt 101–708, self-declared, no approval.
  Admin sees signups per unit (Members tab) and can Mute or Delete.

## Decisions the owner has made

- Two boards: General public, Members registered. Existing threads → Members.
- Unit: self-declared, good faith, no admin approval (2026-10-13).
- Email: per post, by checkbox on the Members board only (2026-10-13). Urgent
  is a visual flag and never emails by itself. No admin review step.
- Anonymous posting stays; the landing page no longer says the admin can see
  who wrote a post (owner removed that line 2026-10-12).
- "General" post category renamed "Everyday Talk" (id still `general`).

## Open decisions for the owner

1. **Resend daily cap.** Believed ~100 emails/day on the free plan; not verified
   (no dashboard access from Claude). Check it on the Resend dashboard. Two
   emailed posts to ~55 members in one day could hit it.
2. **Resend daily cap.** Free plan limit is believed to be ~100 emails/day —
   verify on the Resend dashboard. Two emailed posts to ~55 members in a day
   could hit it.
3. **Long-term: D-Board (multi-building).** Idea: sell or license the platform
   to other buildings. Not started. It's a re-architecture (every table needs a
   building ID, per-building admins and signup), not a rename. Needs a lawyer
   on licensing, liability and email rules, and a security review before other
   buildings' data goes in. Recommended order: launch MeadowBrook, run it a few
   weeks, then build D-Board with real usage numbers.

## Known limits (don't forget these)

- **Anonymity is from casual readers only.** Posts store `user_id`; a
  technically capable member can resolve the author via the API. Fixing it
  needs a masking view/RPC. Not built.
- **Attachments are on a public bucket.** Anyone with a file URL can open it;
  URLs aren't listed without the gated `files` rows. Private bucket + signed
  URLs not built.
- **Member emails have never run for real.** The filter syntax in
  `api/send-announcement.js` is untested against the live project.
- **Unit numbers are unverified** by design now.
- **Deleting an account** keeps their posts as "Anonymous". Suspend is a
  pause; there's no real delete-my-account.
- **Phone testing** hasn't been done. Only headless browser at phone width.
  The owner wanted a real-phone check (Add to Home Screen, timing) — the
  owner must do this.
- The PWA and the signup tap-target work from CLAUDE.md are still not done.

## Testing done (and where it lives)

- `supabase_two_boards.sql`: tested on a scratch Postgres 16 with stubbed
  roles: 33 guest/member/admin permission checks, idempotent rerun, and the
  abort path. Scratch files were not committed; re-create if needed.
- `api/send-announcement.js`: 22 cases against mocked Supabase and Resend.
  Not committed either.
- Frontend: headless Chromium at phone width against a mocked Supabase
  (landing, guest gates, signup validation, member flow, Archives filing,
  urgent auto-send, admin Notices and Members). Not committed.
- `npm run build` passes on every branch; `oxlint` shows only the three
  existing warnings.

**Tip for the next session:** if you want these tests kept, commit them under
`scripts/` or `tests/` first. They aren't in the repo.

## Owner's working style (from the user's preferences)

Straight answers, no fluff. Explain tradeoffs in plain language; say
clearly when something is a decision for the owner rather than a technical
detail. Confirm before any outward action (merges, emails, DB changes). The
owner runs SQL and Vercel changes themselves unless a Management API token is
being used.

## Accounts and access (do not delete)

- Owner admin: `dgromensky@gmail.com`, Apt 205, `is_admin = true`.
- Supabase Management API token lives in `C:/Users/DGR/.secrets/supabase.env`
  (owner's machine). Don't print it.
