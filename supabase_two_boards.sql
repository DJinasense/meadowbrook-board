-- ============================================
-- TWO BOARDS: a public General board (no account) and a Members board.
-- Paste into the Supabase SQL Editor and run. Safe to run more than once.
--
-- What this does
--   * threads.board = 'general' | 'members'. EVERY EXISTING THREAD BECOMES
--     'members' (column default), so the General board starts empty and nothing
--     old is public any more.
--   * Guests (no login) can read and post on General only. Reading the Members
--     board needs a signed-in member (a row in `users`). This is enforced by
--     RLS on threads, replies, likes and files, not just hidden in the UI.
--   * Members pick a unit at signup (users.apartment, "Apt 101".."Apt 708").
--     It is self-declared; admins confirm it later (users.unit_reviewed).
--     Existing accounts keep their access and are asked to add a unit.
--   * Posting anonymously is unchanged: user_id is always stored, the UI hides
--     the name.
--
-- Requires the earlier migrations (is_admin, is_muted, post_flags, archives).
-- Run this BEFORE deploying the matching frontend. Until the new frontend is
-- live, logged-out visitors on the old site can't post (the old client doesn't
-- send `board`).
-- ============================================

BEGIN;

-- 1. threads.board -----------------------------------------------------------
ALTER TABLE threads ADD COLUMN IF NOT EXISTS board text NOT NULL DEFAULT 'members';

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_board_check;
ALTER TABLE threads ADD CONSTRAINT threads_board_check CHECK (board IN ('general', 'members'));

-- Archives are a member benefit, so an archive entry can never sit on General.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_archives_members_only;
ALTER TABLE threads ADD CONSTRAINT threads_archives_members_only
  CHECK (category <> 'archives' OR board = 'members');

-- `board` is deliberately NOT in the threads UPDATE grant: a post can't be
-- moved between boards by its author.

-- 2. Units on users ----------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_reviewed_at timestamptz;

-- Valid units are 101-108 ... 701-708. Returns 'Apt 205' or NULL when invalid.
CREATE OR REPLACE FUNCTION public.normalize_unit(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p ~* '^\s*(apt\.?\s*)?[1-7]0[1-8]\s*$'
    THEN 'Apt ' || substring(p from '([1-7]0[1-8])')
  END;
$$;

-- Tidy any existing value that is just a valid unit written another way
-- ("205", "apt 205"). Anything else is left alone for the admin to look at.
UPDATE users
SET apartment = public.normalize_unit(apartment)
WHERE apartment IS NOT NULL
  AND public.normalize_unit(apartment) IS NOT NULL
  AND apartment <> public.normalize_unit(apartment);

-- The owner's own account is already known to be right.
UPDATE users SET unit_reviewed = true, unit_reviewed_at = COALESCE(unit_reviewed_at, now())
WHERE is_admin AND apartment IS NOT NULL AND NOT unit_reviewed;

-- 3. Who counts as a member --------------------------------------------------
-- A signed-in person with a profile row. Unconfirmed signups have no row (the
-- profile is created when the email is confirmed), so they stay out.
-- SECURITY DEFINER so RLS policies can call it without recursing into `users`.
CREATE OR REPLACE FUNCTION public.is_board_member(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT uid IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = uid); $$;

-- A member sets (or changes) their own unit. Changing it puts it back in the
-- admin's "unreviewed" list. users UPDATE stays column-granted, so this RPC is
-- the only way a member can write `apartment`.
CREATE OR REPLACE FUNCTION public.set_my_unit(p_unit text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u text := public.normalize_unit(p_unit);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please log in first'; END IF;
  IF u IS NULL THEN RAISE EXCEPTION 'Please choose a unit from Apt 101 to Apt 708'; END IF;
  UPDATE users
  SET apartment = u, unit_reviewed = false, unit_reviewed_at = NULL
  WHERE id = auth.uid() AND apartment IS DISTINCT FROM u;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_my_unit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_unit(text) TO authenticated;

-- Admin: mark a member's declared unit as checked (or un-check it).
CREATE OR REPLACE FUNCTION public.admin_set_unit_reviewed(target uuid, reviewed boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE users
  SET unit_reviewed = reviewed,
      unit_reviewed_at = CASE WHEN reviewed THEN now() END
  WHERE id = target;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_unit_reviewed(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_unit_reviewed(uuid, boolean) TO authenticated;

-- Profile creation on email confirmation now also copies the unit the person
-- picked at signup (sent as signup metadata). Same function as
-- supabase_email_confirmation.sql plus the `apartment` column.
CREATE OR REPLACE FUNCTION public.handle_confirmed_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  attempt INT := 0;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = NEW.id) THEN RETURN NEW; END IF;

  base := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1));
  candidate := base;

  LOOP
    BEGIN
      INSERT INTO users (id, email, username, apartment)
      VALUES (NEW.id, NEW.email, candidate, public.normalize_unit(NEW.raw_user_meta_data->>'unit'));
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      IF EXISTS (SELECT 1 FROM users WHERE id = NEW.id) THEN RETURN NEW; END IF;
      attempt := attempt + 1;
      IF attempt > 5 THEN RETURN NEW; END IF;
      candidate := base || (100 + floor(random() * 900))::INT;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- 4. READ access: the Members board is closed to guests ----------------------
-- We don't have the original SELECT policy names in the repo, and permissive
-- policies OR together, so a single forgotten "anyone can read" policy would
-- leave the Members board public. Drop every existing SELECT policy on these
-- four tables and replace them with the ones below.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('threads', 'replies', 'likes', 'files')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Threads: admins see everything (Removed posts included); everyone else sees
-- live posts on General, and members also see live posts on Members.
CREATE POLICY "Read threads by board" ON threads FOR SELECT TO public
USING (
  public.is_admin((SELECT auth.uid()))
  OR (
    status = 'visible'
    AND (board = 'general' OR public.is_board_member((SELECT auth.uid())))
  )
);

-- Replies, likes and attachments inherit from their thread: the sub-select on
-- `threads` runs under the reader's own RLS, so if you can't see the thread you
-- can't see anything attached to it.
CREATE POLICY "Read replies of visible threads" ON replies FOR SELECT TO public
USING (
  public.is_admin((SELECT auth.uid()))
  OR (
    status = 'visible'
    AND EXISTS (SELECT 1 FROM threads t WHERE t.id = replies.thread_id)
  )
);

CREATE POLICY "Read likes of visible posts" ON likes FOR SELECT TO public
USING (
  EXISTS (SELECT 1 FROM threads t WHERE t.id = likes.thread_id)
  OR EXISTS (SELECT 1 FROM replies r WHERE r.id = likes.reply_id)
);

CREATE POLICY "Read files of visible posts" ON files FOR SELECT TO public
USING (
  EXISTS (SELECT 1 FROM threads t WHERE t.id = files.thread_id)
  OR EXISTS (SELECT 1 FROM replies r WHERE r.id = files.reply_id)
);

-- 5. WRITE access ------------------------------------------------------------
-- The "max 2 labeled posts per rolling 24h" count used to be a sub-select on
-- `threads` inside the threads INSERT policy. Now that threads also has a
-- board-aware SELECT policy, Postgres rejects that as "infinite recursion
-- detected in policy for relation threads", so the count moves into a
-- SECURITY DEFINER function (which reads the table without re-entering RLS).
CREATE OR REPLACE FUNCTION public.labeled_posts_last_day(uid uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int FROM threads
  WHERE user_id = uid
    AND alert_type IS NOT NULL
    AND created_at > now() - interval '24 hours';
$$;

-- Keeps every condition from supabase_archives.sql and adds the board rules:
--   guest  -> General only, no labels, no archives
--   member -> either board; archives only on Members (also a CHECK above)
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
        alert_type IS NULL
        OR public.labeled_posts_last_day((SELECT auth.uid())) < 2
      )
      AND (
        (category = 'archives' AND archive_folder IS NOT NULL AND doc_date IS NOT NULL)
        OR (category <> 'archives' AND archive_folder IS NULL AND doc_date IS NULL)
      )
    )
  )
);

-- Replies stay members-only (supabase_members_only_replies.sql); a reply can
-- only go on a thread the replier can actually see.
DROP POLICY IF EXISTS "Members can post replies" ON replies;
CREATE POLICY "Members can post replies" ON replies FOR INSERT WITH CHECK (
  user_id = (SELECT auth.uid())
  AND NOT is_muted((SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM threads t WHERE t.id = replies.thread_id)
);

-- 6. Safety net --------------------------------------------------------------
-- A FOR ALL policy would also grant reads and our SELECT policies couldn't
-- override it. If one exists, stop and roll the whole script back so it can be
-- looked at, rather than silently leaving the Members board open.
DO $$
DECLARE leftover text;
BEGIN
  SELECT string_agg(tablename || ': ' || policyname, ', ') INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('threads', 'replies', 'likes', 'files')
    AND cmd = 'ALL';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Found FOR ALL policies that would bypass the board rules: %. Nothing was changed.', leftover;
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFY (run these after, one at a time, in the SQL Editor):
--
--   -- As a logged-out visitor: expect 0 rows from the Members board.
--   BEGIN; SET LOCAL ROLE anon;
--   SELECT count(*) FROM threads WHERE board = 'members';   -- 0
--   SELECT count(*) FROM replies;                           -- 0 until General has replies
--   SELECT count(*) FROM files;                             -- 0
--   ROLLBACK;
--
--   -- And your old threads moved over:
--   SELECT board, count(*) FROM threads GROUP BY board;     -- all 'members'
-- ---------------------------------------------------------------------------
