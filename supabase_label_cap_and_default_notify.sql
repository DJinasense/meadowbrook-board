-- Two owner decisions (2026-10-13), run once in the Supabase SQL Editor:
--
-- 1. Labeled-post cap counts only Urgent posts, limit 3 per rolling 24h.
--    Building work and Heads up are no longer capped, and older tests/removed
--    labeled posts of other kinds no longer block a member's Urgent post.
-- 2. New signups default to "Notify me with important announcements" ON.
--    Existing members keep whatever they already have. Members can still
--    untick it in Settings. The signup path inserts only id/email/username,
--    so the column default is what new accounts get.
--
-- Safe to re-run. Wrap in a transaction so a failure changes nothing.

BEGIN;

-- 1a. Count only urgent labeled posts.
CREATE OR REPLACE FUNCTION public.labeled_posts_last_day(uid uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM threads
  WHERE user_id = uid
    AND alert_type = 'urgent'
    AND created_at > now() - interval '24 hours';
$$;

-- 1b. Same INSERT policy as supabase_two_boards.sql, with the cap changed.
--     Only the labeled-post clause differs; everything else is unchanged.
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads FOR INSERT TO public
WITH CHECK (
  announced_at IS NULL
  AND (category <> 'archives' OR board = 'members')
  AND (
    (
      user_id IS NULL
      AND board = 'general'
      AND alert_type IS NULL
      AND category <> 'archives'
      AND archive_folder IS NULL
      AND doc_date IS NULL
    )
    OR (
      user_id = (SELECT auth.uid())
      AND NOT is_muted((SELECT auth.uid()))
      AND public.is_board_member((SELECT auth.uid()))
      AND (
        alert_type IS DISTINCT FROM 'urgent'
        OR public.labeled_posts_last_day((SELECT auth.uid())) < 3
      )
      AND (
        (category = 'archives' AND archive_folder IS NOT NULL AND doc_date IS NOT NULL)
        OR (category <> 'archives' AND archive_folder IS NULL AND doc_date IS NULL)
      )
    )
  )
);

-- 2. New accounts start with member emails on. Existing rows are not touched.
ALTER TABLE users ALTER COLUMN notify_announcements SET DEFAULT true;

COMMIT;

-- VERIFY (read-only):
--   SELECT column_default FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'notify_announcements';
--     -> true
--   SELECT count(*) FROM pg_policies
--    WHERE tablename = 'threads' AND policyname = 'Anyone can post threads';
--     -> 1
