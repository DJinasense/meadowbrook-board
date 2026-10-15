-- Site Settings: global platform settings (branding, banners, policies, donation)
-- Run once in the Supabase SQL Editor (https://supabase.com/dashboard/project/kjsnaibbhjxkaglfsowd/sql)

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key         TEXT PRIMARY KEY,              -- 'branding', 'donation', 'banners', 'policies', 'categories'
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (guests included) can read site settings
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT TO anon, authenticated USING (true);

-- No direct writes from anon or regular users
REVOKE INSERT, UPDATE, DELETE ON public.site_settings FROM anon, authenticated;

-- Function for admins to save/update a site setting
CREATE OR REPLACE FUNCTION public.admin_save_setting(p_key TEXT, p_value JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  INSERT INTO public.site_settings (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_save_setting(TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_save_setting(TEXT, JSONB) TO authenticated;

-- Function for admins to reset a setting
CREATE OR REPLACE FUNCTION public.admin_reset_setting(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  DELETE FROM public.site_settings WHERE key = p_key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_setting(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_setting(TEXT) TO authenticated;

COMMIT;

-- VERIFY:
-- SELECT * FROM public.site_settings;
