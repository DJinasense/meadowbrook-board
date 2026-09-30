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
- **Vercel**: live at `https://mbb7.dgrvip.net` (auto-deploys on push to `main`). The old `meadowbrook-board.vercel.app` alias returns DEPLOYMENT_NOT_FOUND as of 2026-09-29 — don't use it to check deploys. Vite build preset,
  env vars set in Vercel project settings (must match `.env.local` exactly —
  we already hit a bug once where the key got truncated to `ITE_SUPABASE_URL`
  in Vercel's UI; double-check the full var name if anything breaks there).
- **Domain**: `mbb7.dgrvip.net` (a subdomain of a domain the user already
  owns) — this is now the app's real domain, referenced in `index.html`
  (canonical/OG tags). **DNS/Vercel/Supabase wiring not verified by a Claude
  Code session** — a Claude Code session has no access to the Vercel or
  Supabase dashboards, so before assuming the domain is actually live, the
  user needs to confirm: (1) CNAME record `mbb7` → `cname.vercel-dns.com`,
  (2) the domain added under Vercel → Project → Domains, (3)
  `https://mbb7.dgrvip.net` added to Supabase → Authentication → URL
  Configuration → Redirect URLs (see note below — auth silently breaks on
  any domain not in that list).
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
  KNOWN GAP: an older, looser INSERT policy on storage.objects (predates this
  work, name unknown) still lets a member upload into another member's folder.
  Overwrite/delete of others' files IS blocked and stray uploads can't be
  attached to anyone's post. Find it with `select policyname, cmd, with_check
  from pg_policies where schemaname='storage' and tablename='objects';`.
- Editing own threads/replies (no "edited" label, per user); muted members
  can't edit. threads/replies UPDATE is column-granted — admins still need
  `status` in that grant for Remove/Restore.
- Replies are members-only (guests see a sign-up prompt; RLS enforces it).
- Notifications are NOT implemented (the notify_* columns exist but nothing
  sends email) — don't advertise them in copy.

`supabase_open_signup.sql` is a second, separate file (added when invite
codes were parked, see Signup section below) — unlike `supabase_additions.sql`
it has **not** been run against the live project yet; the user still needs
to paste it into the SQL Editor themselves.

**Supabase Auth settings that must stay configured**:
- "Confirm email" is turned OFF (Authentication → Sign In / Providers →
  Email) — required for `SignupFlow.jsx` to work at all: it expects a live
  session back from `auth.signUp()` immediately, with no email-click step in
  between.
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
`invite_code_redemptions` cleanup line. The user runs it in the SQL Editor;
until they confirm they have, the tables may still exist. Where older sections
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
