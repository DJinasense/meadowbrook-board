# MeadowBrook Community Board — Project Handoff

This file is a handoff for continuing work on this project in a fresh session.
It was written by a prior Claude Code session that built the app end-to-end
across several days of work. Read this before making changes.

## What this is

A private discussion board for MeadowBrook, Building 7 (56 units, 7 floors,
8 units/floor, numbered Apt 101–108 through Apt 701–708). React + Vite
frontend, Supabase (Postgres + Auth + Row Level Security) backend. Signup is
currently **open** (no invite code) — anyone can create an account with
email + display name + password; guests can also browse/post without an
account. This is deliberate, "for now" — see the Signup section below.

## Stack & where things live

- **Frontend**: Vite + React 19, Tailwind CSS v4 (`@import "tailwindcss"` in
  `src/index.css`, no `tailwind.config.js` — v4 uses CSS-based config).
  Dark mode via `@custom-variant dark (&:where(.dark, .dark *));` and a
  `dark` class toggled on `<html>` by `src/lib/useTheme.js` (persisted to
  `localStorage`, not synced to the account).
- **Backend**: Supabase project `kjsnaibbhjxkaglfsowd` (URL:
  `https://kjsnaibbhjxkaglfsowd.supabase.co`). Credentials live in
  `.env.local` (gitignored) as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
  The single shared client is `src/lib/supabaseClient.js`.
- **Icons for lucide-react**, no other UI library.
- **GitHub**: `github.com/DJinasense/meadowbrook-board`, branch `main`.
- **Vercel**: live at `https://mbb7.us` (auto-deploys on push to `main`). The old `meadowbrook-board.vercel.app` alias returns DEPLOYMENT_NOT_FOUND as of 2026-09-29 — don't use it to check deploys. Vite build preset,
  env vars set in Vercel project settings (must match `.env.local` exactly —
  we already hit a bug once where the key got truncated to `ITE_SUPABASE_URL`
  in Vercel's UI; double-check the full var name if anything breaks there).
- **Domain**: `mbb7.us`, bought at GoDaddy (2026-09-30). The registration
  contact is the user's real estate office, public in WHOIS by the user's
  choice (`.us` allows no privacy service). DNS stays at GoDaddy: A `@` ->
  `216.198.79.1` (Vercel's record; GoDaddy's "Parked" A records had to be
  removed) and CNAME `www` -> `cname.vercel-dns.com`. Verified 2026-09-30:
  `https://mbb7.us` serves the board over HTTPS and http redirects to https.
  Vercel domain setup (checked via API 2026-10-04): `mbb7.us` is the
  production domain with no redirect; `www.mbb7.us` and `mbb7.dgrvip.net`
  both 308-redirect to `mbb7.us`. Never set `mbb7.us` itself to redirect to
  another domain (the Vercel UI allows redirecting a domain to itself, which
  loops/takes the site down; this happened once on 2026-10-04 and the domain
  had to be re-attached). `www.mbb7.us` still had a pending HTTPS certificate
  when last checked.
  `index.html` canonical/OG tags use `https://mbb7.us`. A Claude Code session
  has no access to the Vercel, GoDaddy or Supabase dashboards; whether
  `https://mbb7.us` is in Supabase -> Authentication -> URL Configuration
  (Site URL and Redirect URLs): verified 2026-10-04 via the Management API
  that Site URL is `https://mbb7.us`, the allowlist includes it, and custom
  SMTP (Resend, `noreply@dgrvip.net`) is on. The app's email redirects all use
  `window.location.origin`, so they match the allowlist exactly.
- **Important**: whichever domain(s) actually serve the app (`.vercel.app`
  and/or the custom domain) must be added to Supabase → Authentication →
  URL Configuration → Redirect URLs, or login/signup/password-reset will
  silently break on that domain. This has bitten us more than once.

## Components (src/components/)

- `SignupFlow.jsx` (was `InviteSignupFlow.jsx` — renamed when invite codes
  were dropped from the signup path, see Signup section below) — landing →
  create account → success. No invite code step. Creates the `users` profile
  row with a direct `supabase.from('users').insert(...)` (see Signup
  section) rather than an RPC, since there's no code-redemption atomicity to
  worry about anymore.
- `LoginFlow.jsx` — email/password login + forgot-password request. Error
  message is deliberately generic ("Incorrect email or password") — Supabase
  itself doesn't distinguish wrong-password from no-such-account, and we
  shouldn't either (avoids account enumeration).
- `ResetPasswordFlow.jsx` — the "set a new password" screen a resident lands
  on after clicking the emailed reset link. Triggered in `App.jsx` by
  listening for the `PASSWORD_RECOVERY` auth event.
- `MainBoard.jsx` — the board itself: browse/post/reply/like/report, guest
  or signed-in, category filter, search. Also owns the account dropdown
  (Settings modal, Admin Dashboard link, Log out) and the light/dark toggle
  placement (to the immediate left of the dropdown, per explicit user
  request — don't move it back to inside the dropdown).
- `AdminDashboard.jsx` — report queue (approve takedown actually flips the
  underlying thread/reply `status` to `'removed'`, not just marks the report
  reviewed), invite-code tracker, real `COUNT()` stats. Gated by `is_admin`
  in both the UI (redirect) and RLS (defense in depth).
  **Note**: this file (and a new `public/print-invite-codes.html`) were
  modified/added outside this session's own changes — there's a `Printer`
  icon import and a print feature that this handoff's author didn't build.
  Take that as intentional prior work, not a bug — read it before touching
  it rather than assuming it needs fixing.

## Shared helpers (src/lib/)

- `supabaseClient.js` — the one client instance. Explicitly sets
  `persistSession`, `autoRefreshToken`, `detectSessionInUrl` (needed for the
  password-recovery link flow to work).
- `useCurrentUser.js` — hook returning `{ currentUser, loading, refresh }`.
  `currentUser` is the `public.users` profile row (not the raw auth user),
  keyed by matching UUIDs (`users.id === auth.uid()`). If someone's `users.id`
  doesn't match their real auth ID (can happen if a row was created some way
  other than `redeem_invite_code`, e.g. manually), they'll appear
  permanently logged-out from the app's perspective despite a valid session
  — this exact bug happened once with the real admin account and was fixed
  with a one-off `UPDATE users SET id = <real auth id>`.
- `useTheme.js` — light/dark state, `localStorage`-only, no DB involvement.
- `directory.js` — `fetchDirectory(ids)`, reads the `member_directory` view
  (safe public username/apartment lookup, doesn't expose email or bypass
  RLS on `users`).
- `router.js` — see the Routing section below.
- `pdfRender.js` — lazy access to pdf.js. `loadPdf(url)` caches documents by
  URL; `renderPageToCanvas(pdf, page, canvas, maxWidth)` draws at
  `devicePixelRatio` (capped at 2). pdf.js is a dynamic `import()` so it lands
  in its own chunk and only downloads when a PDF is actually previewed.

## Routing (added 2026-10-02) — read this before adding a screen

Screens used to be a plain `useState` string, which meant the app had **no**
browser history at all: the first Back press left the site. `src/lib/router.js`
fixes that with a ~140-line `pushState`/`popstate` router. **Do not add
react-router** — this is deliberate, and it keeps the "one string per screen"
model the components already used.

- `PATHS` maps a view name to a URL: `/`, `/board`, `/thread/<id>`, `/new`,
  `/login`, `/signup`, `/reset-password`, `/admin`, `/messages/<id>`,
  `/welcome`. Adding a screen means adding a line there.
- Only `App.jsx` (which screen to render) and `MainBoard.jsx`
  (landing/board/thread/create) read it, via `useRoute()`.
- Which mover to use: `navigate` for a screen the resident chose to open;
  `goBack(fallback)` when they're done with one (it **pops**, so in-app "Back"
  links and the browser's Back button agree instead of each leaving a trail);
  `replaceRoute` for sideways moves (login <-> signup) and one-time screens
  reached from an email link.
- `depth` is kept in history state so `goBack` knows whether there's anything
  to pop or whether this was a shared-link cold start.
- `seedRoute` sets the route **without touching the URL**, used only for the
  auth-email landings: the hash still holds the session that supabase-js reads
  asynchronously, so it must be left intact. Don't "clean up" the hash.
- `useBackToClose(closeFn | null)` makes Back close the topmost open overlay
  instead of leaving the screen under it. `MainBoard` passes a precedence
  chain (lightbox → confirm → report → settings → signup prompt). It works via
  a single module-level `overlayCloser`, deliberately **not** by pushing a
  marker entry — that breaks under React StrictMode's double-invoked effects.
- **`vercel.json` is required**: it rewrites everything to `/index.html`.
  Without it, refreshing or sharing `/thread/<id>` 404s in production.
- Drafts: moving around inside the app keeps `newThread`/`newReply` in state,
  so the only real loss is leaving the site — there's a `beforeunload` warning
  for that, plus an "unfinished post — Continue" bar on the board.

## Attachment previews (added 2026-10-02)

Photos **and** PDFs preview in the board list, not just inside a thread.
`components/Attachments.jsx` owns the tiles, `components/Lightbox.jsx` the
full-screen viewer.

- `AttachmentThumbs` (board list) is a sideways-scrolling strip;
  `AttachmentList` (open thread/reply) wraps. Both call
  `onOpen(files, index, event)` — keep that signature if you add a third.
- Tile sizes live in one place, `THUMB_SIZES` in `Attachments.jsx`. They're
  portrait (~4:5) on purpose: at those widths pdf.js draws nearly the whole
  first page, so a notice is readable in the list.
- PDFs render to a **canvas via pdf.js, not an `<iframe>`** — Android Chrome
  won't render a PDF in an iframe. Thumbnails are gated behind an
  `IntersectionObserver` so a busy board doesn't fetch every document at once.
- `downloadUrl(file)` in `lib/attachments.js` appends Supabase's
  `?download=<name>`. That param is the only thing that produces a real
  download; the HTML `download` attribute is ignored cross-origin.
- `vite.config.js` has a `copy-pdfjs-assets` plugin that copies pdf.js's
  `standard_fonts`/`wasm`/`iccs` out of `node_modules` into `public/pdfjs/`
  at build time (gitignored, regenerated on Vercel). `cmaps` is skipped
  deliberately — 1.5 MB, only needed for CJK PDFs.

## Post labels, announcement emails, suspend account (added 2026-10-04)

`supabase_urgent_and_suspend.sql` then `supabase_post_flags.sql` (both run on live
via the Supabase Management API, checked with 36 rolled-back permission tests).
What they do:

- **Post labels.** Members (not guests) can pick one optional label on the
  new-thread form (radio list under "Post anonymously"): **Urgent** (red filled
  star), **Building work** (orange traffic cone: construction, repairs, water
  shutoff) or **Heads up** (yellow filled star). The icon shows left of the
  author name on the board list and in the open thread. Definitions live in one
  place, `components/PostFlag.jsx` (`FLAGS`, `FLAG_ORDER`, `FlagIcon`); the
  email wording/colors are mirrored in `KINDS` in `api/send-announcement.js`.
  Stored in `threads.alert_type` (NULL, 'urgent', 'construction', 'attention',
  CHECK-constrained). The old boolean `threads.is_urgent` was replaced by it.
  The INSERT policy lets only signed-in, unmuted members set a label, max 2
  labeled posts per rolling 24h, and refuses a pre-set `announced_at`. Neither
  column is user-updatable (threads UPDATE is column-granted); only admin RPCs
  change them. **threads INSERT is table-wide for anon/authenticated, so any
  new threads column is insertable by guests unless the policy says otherwise.**
- **Admin review.** Admin Dashboard -> Notices tab (red count badge; red dot on
  the account menu in `MainBoard`). Per post: "Email to subscribers" (with a
  confirm step and the recipient count), "Remove label"
  (`admin_dismiss_flag`, button "Remove label"), or Remove. Sent posts are listed under "Already
  emailed". No cron job: an admin click sends immediately, which is what "check
  it isn't spam first" needs.
- **Sending.** `api/send-announcement.js` (Vercel function; `vercel.json` now
  excludes `/api/` from the SPA rewrite). It forwards the admin's own login
  token to Supabase, so no service-role key is needed: `admin_claim_announcement`
  (atomic "mark sent", blocks double sends) -> `admin_announcement_recipients`
  (opted in AND not suspended) -> Resend batch API, one message per person ->
  `admin_release_announcement` if Resend refuses. Sender `MeadowBrook Board
  <noreply@dgrvip.net>`. **Needs `RESEND_API_KEY` in the Vercel project env
  vars (the user adds it themselves; a send-only key is enough). Until it's set
  the Send button shows "Email sending is not set up yet".** Logic was tested
  with a mocked Supabase/Resend; no real email has been sent through it yet.
- **Settings.** The "daily digest" checkbox is gone, replaced by "Notify me
  with important announcements" (`users.notify_announcements`, default false,
  in the UPDATE grant). `notify_daily_digest` and `notify_on_reply` columns
  still exist; **nothing sends reply notifications either**, and the reply
  checkbox is still shown.
- **Suspend my account.** Link at the bottom of Settings -> confirm step with
  an optional feedback box -> `suspend_my_account(p_feedback)`: sets
  `is_suspended`, clears every notify flag, stores feedback in
  `account_feedback` (admin-readable only, shows the display name), then signs
  out. `is_muted(uid)` now also returns true for suspended users, so every
  existing RLS check blocks their posts/edits/DMs. On next login a banner
  offers "Reactivate my account" (`reactivate_my_account`). Their old posts
  stay. Admin: Members tab shows a "Suspended" tag; Feedback tab lists the notes.
  This is a pause, not deletion; a real "delete my account" is not built.
- **Running SQL as Claude.** `C:/Users/DGR/.secrets/supabase.env` holds a
  Supabase Management API token, so a session can run SQL against the live
  project (POST `/v1/projects/<ref>/database/query`) and read/patch auth
  config. Earlier notes saying "no way to run DDL" predate that. Don't print
  the token; wrap risky test SQL in a `DO` block that ends with RAISE EXCEPTION
  so it rolls back.

## Document Archives (added 2026-10-09)

`supabase_archives.sql` (run on live, verified with a rolled-back permission
test suite covering guest/member × archives/normal-post combinations). A
standing-documents page — board minutes, budgets, balance sheets, letters from
the property manager — separate from the discussion feed, reached from the
board's category-chip row via an **Archives** button (`components/Archives.jsx`,
route `/archives` in `lib/router.js`).

- **No new table.** An archive entry is an ordinary `threads` row with
  `category = 'archives'` plus two new columns: `archive_folder` (text,
  CHECK-constrained) and `doc_date` (date — the date *on* the document, not the
  upload time). This reuses attachments, likes, replies, reporting, author
  labels, and admin Remove/Restore with no new moderation path. Opening an
  entry from Archives just calls `navigate('thread', id)` — the existing
  thread view renders it; `MainBoard`'s `loadBoard` query still loads archive
  rows (so `openThread`'s `threads.find(...)` can find them), they're excluded
  from the board's own list purely at render in `filteredThreads`.
- **Folder ids** live in one place, `lib/archiveFolders.js`
  (`ARCHIVE_FOLDER_ORDER`, `ARCHIVE_FOLDERS`): `board_meetings`,
  `special_assessments`, `building_budgeting`, `balance_sheets`,
  `code_related`. They must match the SQL CHECK constraint exactly — change
  one place, change both.
- **Who can file.** Any signed-in member (not guests, not even muted members —
  `NOT is_muted` is still required). The category `<select>` on the create
  form only offers "Archives" when `currentUser` exists. **Same guest-write
  risk as `alert_type`**: `threads` INSERT is table-wide for anon/authenticated,
  so `archive_folder`/`doc_date` are guest-writable unless the `"Anyone can
  post threads"` policy's `WITH CHECK` says otherwise — it does: the guest
  branch requires `category <> 'archives' AND archive_folder IS NULL AND
  doc_date IS NULL`; the member branch requires both columns set (and
  matching the CHECK) when `category = 'archives'`, both NULL otherwise.
  Neither column is in the threads UPDATE grant — same as `alert_type`, a
  misfiled document gets removed and re-posted rather than edited.
- **Bucket (`community-files`) widened**: 10 MB → 25 MB per file, and Word/Excel
  added (`application/msword`, the Office Open XML `.docx`/`.xlsx` MIME types)
  alongside the existing images/PDF. `lib/attachments.js` mirrors this
  (`MAX_FILE_BYTES`, `ALLOWED_TYPES`) — must match the bucket's
  `allowed_mime_types` or uploads fail server-side with a confusing error.
- **`files.file_type` is now three-way**: `'image' | 'pdf' | 'document'`
  (`'document'` now means Office/other — anything pdf.js can't parse — whereas
  it used to mean "PDF", backfilled by the migration). pdf.js can only render
  PDFs, so `Attachments.jsx`'s `Thumb` and `Lightbox.jsx` both branch three
  ways: image → `<img>`, `pdf` → the existing `PdfThumb`/`PdfPages`, anything
  else → a plain icon+badge (`DocThumb`) or, in the lightbox, a "can't be
  previewed in the browser" panel pointing at the Download/Open-in-new-tab
  buttons that are already in the header. `lib/attachments.js`'s
  `fileKindLabel(file)` derives the PDF/DOCX/XLSX badge text from the
  filename extension (the MIME type isn't surfaced to these components).
- **Why the Archives list shows no PDF thumbnails.** A pdf.js thumbnail
  downloads the entire document to draw page 1. The free Supabase plan's real
  ceiling isn't storage (1 GB, ~3% used even after the owner's ~31 MB of
  documents) — it's 5 GB/month **egress**. A list of 100+ archived documents is
  exactly where repeated full-document downloads just to render thumbnails
  could burn through that, so `Archives.jsx` intentionally shows icons and
  metadata only; bytes are fetched when someone actually opens a document. The
  board list is short enough that its existing thumbnails stay as they are.

## Database (Supabase) — additive migrations already applied

The original schema (`users`, `threads`, `replies`, `likes`, `files`,
`reports`, `invite_codes`, `invite_code_redemptions`, `direct_messages`) was
provided by the user. On top of it, this session's SQL additions (all
already run successfully against the live project) added:

- `users.is_admin`, `users.show_apartment` columns
- `is_admin(uid)` SQL helper function (avoids RLS recursion)
- Admin SELECT/UPDATE policies on `threads`, `replies`, `reports`,
  `invite_codes`, full-profile SELECT/UPDATE on `users`
- RLS enabled on `likes` and `invite_code_redemptions` (previously missing)
- `member_directory` view (public username/apartment, respects
  `show_apartment` opt-in)
- `check_invite_code(p_code)` and `redeem_invite_code(p_code, p_username)`
  RPC functions (SECURITY DEFINER)
- The 56 real invite codes were **remapped** from placeholder labels
  (`Unit 1`..`Unit 56`) to real apartment numbers (`Apt 101`..`Apt 708`),
  with fresh random codes generated to match (`MB7-101-XXXX` format). This
  was done before any real resident had used a code, so it was safe.

None of this SQL is saved as a single canonical migration file — it was run
interactively via the Supabase SQL Editor over several turns.
`meadowbrook-board/supabase_additions.sql` in the repo has an earlier
(mostly but not 100% complete) snapshot; the source of truth is the live
database, not that file. If you need the exact current schema, query
Supabase directly rather than trusting that file.

**Security (2026-09-29):** `supabase_security_fix.sql` has been run on the live
project and verified with real requests. It supersedes section 3 of
`supabase_open_signup.sql`, whose column-level REVOKEs did nothing (Supabase
grants table-wide INSERT/UPDATE to `authenticated`; column REVOKEs don't
override that) — a test account really did promote itself to admin before the
fix. `users` now has only column-level grants (INSERT id/email/username; UPDATE
username/show_apartment/notify_on_reply/notify_daily_digest). Thread/reply
inserts require `user_id IS NULL OR user_id = auth.uid()` (previously a
logged-out visitor could post under any member's name); reports require
`reported_by` null-or-self and `status = 'pending'`. If you add a user-editable
column, it must also be added to the UPDATE grant or saves will 403.

**Member management (2026-09-29):** `supabase_member_admin.sql` (run on the
live project) adds `users.is_muted`, an `is_muted(uid)` helper, and three
SECURITY DEFINER RPCs used by the admin Members tab: `admin_set_muted`,
`admin_set_admin`, `admin_delete_member`. Each raises 'Admins only' for
non-admins and refuses to act on the caller's own account (no self-lockout);
EXECUTE is revoked from anon. Verified: logged-out calls get 401, a signed-in
non-admin gets 'Admins only'. Muted members are blocked from thread/reply
inserts by RLS (`NOT is_muted(auth.uid())`); guests can still post
anonymously, so mute only stops the named account. Deleting a member keeps
their posts (user_id SET NULL → shows "Anonymous"). `useCurrentUser` selects
`is_muted`, so that column must exist before any deploy of the client.

**Member features (2026-09-29):** `supabase_member_features.sql` (run on live,
verified with 24 scripted permission checks + UI walkthrough) adds:
- Private messages (`components/Messages.jsx`, `App` view `messages`): insert
  must be from self, not to self, not muted; recipients can only flip `read`;
  no admin read policy by design (admins can't read DMs).
- Attachments (`lib/attachments.js`, `components/Attachments.jsx`): photos/PDFs,
  10 MB, max 5 per post, bucket `community-files` is public. Files upload to
  `<uid>/<threadOrReplyId>/...`; `files.uploaded_by` defaults to auth.uid() and
  isn't grantable; a file row can only attach to the uploader's own thread/reply.
  Storage INSERT is limited to the uploader's own folder (the old loose
  policy "Only signed-up users can upload" was dropped; verified 2026-09-29
  that uploading into another folder is refused).
- Editing own threads/replies (no "edited" label, per user); muted members
  can't edit. threads/replies UPDATE is column-granted — admins still need
  `status` in that grant for Remove/Restore.
- Replies are members-only (guests see a sign-up prompt; RLS enforces it).
- Reply/digest notifications are NOT implemented (the notify_* columns exist but
  nothing sends email) — don't advertise them in copy. The only email feature is
  the admin-sent urgent announcement (see the section above).

`supabase_open_signup.sql` is a second, separate file (added when invite
codes were parked, see Signup section below) — unlike `supabase_additions.sql`
it has **not** been run against the live project yet; the user still needs
to paste it into the SQL Editor themselves.

**Supabase Auth settings that must stay configured**:
- "Confirm email" (Authentication → Sign In / Providers → Email): the user
  chose on 2026-09-29 to turn it ON, with a gentle flow for low-tech
  residents. The app handles both settings. With it off, signUp returns a
  session and the profile is created immediately. With it on, SignupFlow
  shows a "Check your email" step (resend button, spam hint); LoginFlow
  explains `email_not_confirmed` and offers a resend. The emailed link lands
  on App's `welcome` view (`#type=signup` in the URL). An expired link
  (`#error_code=`) lands on login with a notice.
  `supabase_email_confirmation.sql` adds trigger `on_auth_user_confirmed`,
  which creates the `users` row when `email_confirmed_at` is set, deduping
  the display name with digits. Unconfirmed signups get no profile row.
  Before turning it on, the user needs: (1) that SQL run, (2) custom SMTP. I
  believe Supabase's built-in email only delivers to project team members, at
  about 2 per hour, but that is unverified. If so, it would also break
  password resets for residents. (3) Site URL / Redirect URLs set to
  https://mbb7.us. Check with the user which of these are done. Plan
  agreed 2026-09-30 for (2): Resend SMTP (`smtp.resend.com`, port 465, user
  `resend`, password = the Resend API key) sending as `noreply@dgrvip.net`,
  since `dgrvip.net` is already verified in Resend. The user enters the key in
  Supabase themselves; `C:/Users/DGR/.secrets/resend.env` holds a
  send-only key (it can't list or add domains). Not confirmed as done.
- Redirect URLs allowlist must include every real domain the app is served
  from (see deployment section above).

## Signup — currently open, invite codes parked "for now"

The user explicitly said to forget invite codes for now and leave the board
open. What changed and what didn't:

- `SignupFlow.jsx` (renamed from `InviteSignupFlow.jsx`) no longer has an
  invite-code step. It's landing → email/username/password → success. It
  creates the `users` row itself via `supabase.from('users').insert({ id,
  email, username })` — no RPC, no apartment.
- **`supabase_open_signup.sql` has NOT been run by a Claude Code session** —
  there's no service-role key in this project, only the anon key in
  `.env.local`, and RLS/DDL changes can't be made through the anon client.
  **The user must run it themselves** in the Supabase SQL Editor before open
  signup will actually work end-to-end, or new signups will fail at the
  `users` insert (no INSERT policy exists yet, and `apartment` is currently
  NOT NULL with no value being supplied). It does two things: drops the
  NOT NULL constraint on `users.apartment`, and adds an INSERT policy
  (`auth.uid() = id`) so a freshly-authenticated user can create their own
  profile row.
- `invite_codes`, `invite_code_redemptions`, `check_invite_code()`,
  `redeem_invite_code()`, and the 56 real codes are all **untouched** —
  nothing was dropped. Invite-gated signup can be reinstated later by
  swapping `SignupFlow.jsx` back for something that calls
  `redeem_invite_code`, without any new SQL.
- `AdminDashboard.jsx`'s invite-code tracker panel and "Print Codes" button
  still work (the data's still there) but are now vestigial — nobody will
  redeem those codes through the current signup path. Left in place since
  removing it wasn't asked for; ask the user before hiding/removing it.
- New accounts have `apartment = NULL` and therefore nothing to show even if
  they opt into "Show my apartment number" in Settings — this doesn't error,
  it just displays nothing. Not fixed, since it wasn't in scope.
- Wording was swept for "invite code" / "verified account" language across
  `MainBoard.jsx`, `LoginFlow.jsx`, `SignupFlow.jsx`, `ResetPasswordFlow.jsx`
  (e.g. "New here? Enter your invite code" → "New here? Create an account").
  `AdminDashboard.jsx` copy was left as-is (admin-only, lower priority).

## Invite codes — retired (2026-09-29)

The user has dropped invite codes entirely ("we got rid of the codes"). Signup
is open email + password. Don't reinstate code-gated signup or treat the
invite-code data as something to protect. `public/print-invite-codes.html`
was deleted. `supabase_remove_invite_codes.sql` drops `invite_codes`,
`invite_code_redemptions`, `check_invite_code()` and `redeem_invite_code()`.
It also recreates `admin_delete_member` without its old
`invite_code_redemptions` cleanup line. It has been run on live (verified
2026-09-29: tables/functions return 404, admin Delete still works). Where older sections
of this file mention the "56 real codes", treat that as history, not current
guidance.

## Real accounts that exist (not test data — do not delete)

- `dgromensky@gmail.com`, Apt 205, `is_admin = true` — the site owner's real
  admin account.

All other accounts/codes created during development (various
`+meadowbrooktest*` addresses, `MB7-TEST-*` codes) were cleaned up after
each testing round. If you find stray test data, it's a mistake, not
something to preserve.

## Explicitly out of scope right now

**Voting/elections — do not touch.** The user has explicitly parked this for
a future phase. Don't add it, don't scaffold for it, don't mention it as a
"nice next step" unless asked.

## Current in-progress task (not yet implemented)

Two scoped changes were requested and are **not done yet**:

### 1. Convert to an installable PWA
- Add `manifest.json`/`manifest.webmanifest` (installable on iOS + Android,
  real home-screen icon not just a bookmark)
- App icon in 192×192 and 512×512 minimum — **no longer blocked**:
  `public/icon-192.png` and `public/icon-512.png` already exist (generated
  from the real logo, see Logo section), just not yet referenced by a
  manifest since none exists yet
- Basic service worker: reliable loading + a simple offline/reconnecting
  message instead of a blank page when there's no signal
- `theme-color` / `background-color` in the manifest matching the app's
  blue/emerald palette (avoid a jarring white splash screen) —
  `index.html` already has `<meta name="theme-color" content="#1d4ed8">`,
  reuse that value

### 2. Simplify the account-creation flow for low-tech-comfort users
- **Partly moot now**: the invite-code entry screen this item originally
  referred to no longer exists — `SignupFlow.jsx` dropped that step
  entirely when invite codes were parked (see Signup section above). If
  invite-gated signup is reinstated later, re-evaluate this item against
  whatever that flow looks like then.
- Email confirmation: **already skipped** (Confirm email is off, see above)
  — this part of the ask is already satisfied, no further work needed here
- Post-signup confirmation copy: **done** — success screen now reads
  "You're in! / Welcome to the board." (previously "You're Verified!" / "is
  now linked to your account", which referenced the invite-code apartment
  link that no longer applies)
- Bigger tap targets on buttons/inputs specifically in the signup and login
  flow (not necessarily the whole app) — **not done yet**

**Testing note from the user**: they explicitly want this verified on a
real phone (actual "Add to Home Screen" behavior, actual icon/splash
appearance, and a real timing of letter-open → "You're in" screen) — not
just a resized browser window. A Claude Code session cannot access a
physical phone; be upfront about that limitation rather than claiming a
phone test happened. Browser mobile-viewport emulation can verify most of
the functional/visual work, but the final physical-device check and timing
measurement needs the user to actually do it.

## Logo — done, generated from the real file

The user dropped the real logo at `LOGO.jpg` (repo root, 1.3MB JPEG — a
line-art tree with a "B"/"M" monogram woven into the canopy/trunk,
"The MeadowBrooks" / "MBB7 Community" wordmark below, cream background,
dark forest green line art). A Python (PIL/numpy) one-off script extracted
it into transparent PNGs, since the source is a big flat JPEG, not layered
art:
- Sampled the cream background color from the corners, then built an alpha
  channel from each pixel's color distance from that background (this is
  what makes the output transparent instead of carrying a cream box), and
  recolored the ink to a flat `rgb(45,80,55)` to remove JPEG compression
  noise around the linework.
- Cropped two ways: the tree/monogram mark alone (`public/logo-icon.png`),
  and mark+wordmark together (`public/logo-full.png`). `*-light.png`
  variants exist in cream instead of green, generated but not currently
  wired into any component — available if a dark surface ever needs a
  light-colored mark.
- Also rendered `public/favicon-32.png`, `public/apple-touch-icon.png` (180),
  `public/icon-192.png`, `public/icon-512.png` — the mark on a small solid
  cream (`#f1ece0`) square, since a transparent favicon looks wrong in most
  browser chrome. `icon-192.png`/`icon-512.png` are sized for the PWA
  manifest work below whenever that's picked back up — not wired to
  anything yet since no manifest exists.
- `index.html`'s favicon links now point at `favicon-32.png` /
  `apple-touch-icon.png` instead of the old unrelated lightning-bolt
  `favicon.svg` (that file is still in `public/`, just unreferenced).

`logo-icon.png` is used everywhere the app previously had a hand-built
Home+Leaf badge: `MainBoard.jsx`'s `TopBar` and landing hero, and the icon
circle at the top of `LoginFlow.jsx` / `SignupFlow.jsx` /
`ResetPasswordFlow.jsx`. Pattern used throughout: a small rounded box with a
flat `bg-[#f3eee1]` (matches the logo's own cream) behind the image, so it
reads correctly in both light and dark mode without a `dark:` swap. Existing
typed headings ("MeadowBrook · Building 7" / "Community Board") were left in
place next to the mark rather than replaced by the wordmark image, to avoid
redundant text — `logo-full.png` isn't wired into the UI yet, only used for
the `og:image` meta tag in `index.html`.

`public/logo-mark.svg` (the earlier hand-traced fallback, no monogram) and
`src/assets/hero.png` (Vite's default scaffold graphic) are both now unused
leftovers — safe to delete whenever, not currently referenced anywhere.

`LOGO.jpg` itself is untracked so far (new file, `git status` shows it as
`??`) — the generated PNGs above are the only files anything actually
references, so it's fine either to commit it for the record or leave it
untracked/gitignored.

## Things worth knowing about this codebase's conventions

- All five screen components are single large files with inline
  sub-components (`TopBar`, modals, etc.) defined as local consts inside the
  main function — this pattern is established throughout, keep following it
  rather than introducing a different structure.
- Every mutation goes through the shared `supabase` client directly from
  components — there's no API layer, no React Query/SWR, just
  `useState`/`useEffect` and manual refetch-after-mutation. Keep it that
  simple unless there's a real reason not to.
- Anonymous posting: guests are always `is_anonymous = true`, `user_id =
  null`; signed-in users choose anonymity via a checkbox but `user_id` stays
  set even when posting "anonymously" (needed for RLS-based edit/delete
  rights and admin visibility on reports) — display logic hides the
  username, the database never does.
