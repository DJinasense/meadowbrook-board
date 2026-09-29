-- ============================================
-- SECURITY FIX — paste into Supabase SQL Editor and run.
-- Safe to run more than once.
--
-- Supersedes section 3 of supabase_open_signup.sql, which did not work:
-- Supabase grants `authenticated` table-wide INSERT/UPDATE on every table,
-- and revoking privileges on individual columns has no effect while a
-- table-wide privilege is still held. Verified by a signed-in test account
-- setting its own is_admin = true after that file had been run.
-- ============================================

-- 1. users: replace table-wide write access with an explicit column list.
--    Signup may only set its own id/email/username; everything else
--    (is_admin, apartment, created_at, ...) comes from column defaults.
--    Settings may only change the four fields the Settings form exposes.
REVOKE INSERT, UPDATE ON users FROM anon, authenticated;
GRANT INSERT (id, email, username) ON users TO authenticated;
GRANT UPDATE (username, show_apartment, notify_on_reply, notify_daily_digest) ON users TO authenticated;

-- 2. threads/replies: a post may only be credited to whoever is creating it.
--    Before, WITH CHECK (true) let a logged-out visitor set user_id to any
--    member's id and have the post display under that member's name.
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Anyone can post replies" ON replies;
CREATE POLICY "Anyone can post replies" ON replies
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = (select auth.uid()));

-- 3. reports: same idea — a report can't claim to come from someone else,
--    and can't be filed already marked as reviewed.
DROP POLICY IF EXISTS "Anyone can file a report" ON reports;
CREATE POLICY "Anyone can file a report" ON reports
  FOR INSERT WITH CHECK (
    (reported_by IS NULL OR reported_by = (select auth.uid()))
    AND status = 'pending'
  );
