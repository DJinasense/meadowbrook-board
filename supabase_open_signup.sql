-- ============================================
-- OPEN SIGNUP (no invite code required)
-- Paste into Supabase SQL Editor and run.
-- Safe to run more than once (idempotent).
--
-- This does NOT delete the invite_codes / invite_code_redemptions tables,
-- the check_invite_code()/redeem_invite_code() functions, or any existing
-- codes/redemptions — it just adds a path for the app to create a `users`
-- row directly, without going through an invite code. Invite-gated signup
-- can be turned back on later without re-doing this.
-- ============================================

-- 1. `apartment` was required (NOT NULL) because every account used to come
--    from a code tied to a real unit. Open signups have no apartment, so it
--    must be allowed to be NULL. (No-op if it's already nullable.)
ALTER TABLE users ALTER COLUMN apartment DROP NOT NULL;

-- 2. Let a newly-authenticated user create their OWN `public.users` profile
--    row directly (id must match their own auth uid — can't create a row for
--    someone else). There was previously no INSERT policy on `users` at all,
--    because the only way in was the redeem_invite_code() RPC.
--    `TO authenticated` scopes the policy to signed-in users (an anon request
--    has a NULL auth.uid() and would fail the check anyway, but being explicit
--    about the target role is the documented Supabase pattern). Wrapping
--    auth.uid() in a SELECT makes Postgres evaluate it once per statement
--    instead of once per row.
DROP POLICY IF EXISTS "Users insert own profile" ON users;
CREATE POLICY "Users insert own profile" ON users
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

-- ============================================
-- 3. SECURITY FIX — privilege escalation on `users` (pre-existing, unrelated
--    to open signup; found while applying the above).
--
--    The "Users update own profile" policy had a USING clause but no
--    WITH CHECK, and the `authenticated` role holds column-level UPDATE on
--    `is_admin`. Any signed-in resident could therefore run:
--
--        update users set is_admin = true where id = auth.uid();
--
--    ...and promote themselves to admin, unlocking the report queue and every
--    admin-gated policy on threads/replies/reports. `anon` held the same
--    grants (saved only by auth.uid() being NULL).
--
--    Two independent fixes, both needed:
--      (a) WITH CHECK stops a user rewriting `id` to point at someone else's
--          row. USING alone only tests the row as it existed BEFORE the update.
--      (b) REVOKE removes the ability to set the sensitive columns at all.
--          Column privileges are checked before RLS, so this is the real
--          backstop — a policy alone cannot restrict WHICH columns change.
--
--    Verified safe against the current client: the only UPDATE the app issues
--    is the Settings form (username, show_apartment, notify_on_reply,
--    notify_daily_digest). Nothing in the client updates id/email/is_admin/
--    created_at. INSERT privileges are separate from UPDATE privileges, so
--    signup's insert of (id, email, username) is unaffected by the REVOKE.
-- ============================================
DROP POLICY IF EXISTS "Users update own profile" ON users;
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

REVOKE UPDATE (is_admin, id, email, created_at) ON users FROM authenticated;
REVOKE UPDATE (is_admin, id, email, created_at) ON users FROM anon;
