-- ============================================
-- MEMBER MANAGEMENT (mute / admin toggle / delete) — paste into Supabase
-- SQL Editor and run. Safe to run more than once.
--
-- Requires supabase_security_fix.sql to have been run first (it removed
-- table-wide UPDATE on users, which is why these actions go through
-- SECURITY DEFINER functions that check is_admin() themselves).
-- ============================================

-- 1. Muted flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_muted(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_muted FROM users WHERE id = uid), false);
$$;

-- 2. Muted members can't post threads or replies under their account.
--    (Guest posting stays open, so a muted person could still log out and
--    post as an anonymous guest — mute stops their named account, not
--    anonymous posting.)
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads
  FOR INSERT WITH CHECK (
    user_id IS NULL
    OR (user_id = (select auth.uid()) AND NOT is_muted((select auth.uid())))
  );

DROP POLICY IF EXISTS "Anyone can post replies" ON replies;
CREATE POLICY "Anyone can post replies" ON replies
  FOR INSERT WITH CHECK (
    user_id IS NULL
    OR (user_id = (select auth.uid()) AND NOT is_muted((select auth.uid())))
  );

-- 3. Admin actions. Each checks the caller is an admin and refuses to act on
--    the caller's own account (so an admin can't lock themselves out).
CREATE OR REPLACE FUNCTION public.admin_set_muted(target UUID, muted BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'You can''t mute your own account'; END IF;
  UPDATE users SET is_muted = muted WHERE id = target;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_admin(target UUID, make_admin BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'You can''t change your own admin access'; END IF;
  UPDATE users SET is_admin = make_admin WHERE id = target;
END;
$$;

-- Deleting keeps the member's posts (threads/replies.user_id is
-- ON DELETE SET NULL, so they display as "Anonymous"). likes and
-- direct_messages cascade. reports.reported_by and
-- invite_code_redemptions.used_by have no ON DELETE rule, so they're
-- cleared first or the delete would be blocked.
CREATE OR REPLACE FUNCTION public.admin_delete_member(target UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'You can''t delete your own account here'; END IF;
  UPDATE reports SET reported_by = NULL WHERE reported_by = target;
  UPDATE invite_code_redemptions SET used_by = NULL WHERE used_by = target;
  DELETE FROM users WHERE id = target;
  DELETE FROM auth.users WHERE id = target;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_muted(UUID, BOOLEAN) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_admin(UUID, BOOLEAN) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_member(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_muted(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_admin(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_member(UUID) TO authenticated;
