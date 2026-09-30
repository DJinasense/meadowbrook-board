-- ============================================
-- REMOVE INVITE CODES — paste into Supabase SQL Editor and run.
-- Safe to run more than once.
--
-- Invite codes were retired (signup is open). Nothing in the app reads these
-- anymore. admin_delete_member is recreated first because the old version
-- cleared invite_code_redemptions and would error once that table is gone.
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_delete_member(target UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'You can''t delete your own account here'; END IF;
  UPDATE reports SET reported_by = NULL WHERE reported_by = target;
  DELETE FROM users WHERE id = target;
  DELETE FROM auth.users WHERE id = target;
END;
$$;

DROP FUNCTION IF EXISTS public.redeem_invite_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.check_invite_code(TEXT);
DROP TABLE IF EXISTS invite_code_redemptions;
DROP TABLE IF EXISTS invite_codes;
