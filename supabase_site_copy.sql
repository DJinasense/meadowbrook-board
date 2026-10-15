-- Site Copy: editable landing page and site strings
-- Run once in the Supabase SQL Editor (https://supabase.com/dashboard/project/kjsnaibbhjxkaglfsowd/sql)
--
-- Lets admins edit landing-page lines and public card copy from the Admin Dashboard.
-- Defaults remain hardcoded in the frontend as fallbacks.
--
-- Safe to re-run. Wrapped in a transaction.

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_copy (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_copy ENABLE ROW LEVEL SECURITY;

-- Anyone (guests included) can read; the landing page is public.
DROP POLICY IF EXISTS "Anyone can read site copy" ON public.site_copy;
CREATE POLICY "Anyone can read site copy" ON public.site_copy
  FOR SELECT TO anon, authenticated USING (true);

-- No direct insert/update/delete from clients. Writes go through the admin RPCs below.
REVOKE INSERT, UPDATE, DELETE ON public.site_copy FROM anon, authenticated;

-- Function for admins to set or update a copy line
CREATE OR REPLACE FUNCTION public.admin_set_copy(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF length(p_value) > 500 THEN
    RAISE EXCEPTION 'Keep each line under 500 characters';
  END IF;

  INSERT INTO public.site_copy (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_copy(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_copy(TEXT, TEXT) TO authenticated;

-- Function for admins to reset a copy line back to default (deletes row)
CREATE OR REPLACE FUNCTION public.admin_reset_copy(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  DELETE FROM public.site_copy WHERE key = p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_copy(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_copy(TEXT) TO authenticated;

COMMIT;

-- VERIFY:
-- Run these after the above block commits:
-- 1. Table exists and is readable:
--    SELECT * FROM public.site_copy;
-- 2. Functions exist:
--    SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('admin_set_copy', 'admin_reset_copy');
