-- Site Pages: stores JSON block trees for Puck visual editor
-- Run once in the Supabase SQL Editor (https://supabase.com/dashboard/project/kjsnaibbhjxkaglfsowd/sql)

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_pages (
  id          TEXT PRIMARY KEY,              -- e.g. 'landing', 'rules', 'contact'
  title       TEXT NOT NULL DEFAULT 'Untitled Page',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- Anyone (guests included) can read published site page layouts
DROP POLICY IF EXISTS "Anyone can read site pages" ON public.site_pages;
CREATE POLICY "Anyone can read site pages" ON public.site_pages
  FOR SELECT TO anon, authenticated USING (true);

-- No direct writes from anon or unprivileged users
REVOKE INSERT, UPDATE, DELETE ON public.site_pages FROM anon, authenticated;

-- Function for admins to save/publish a page layout
CREATE OR REPLACE FUNCTION public.admin_save_page(p_id TEXT, p_title TEXT, p_data JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  INSERT INTO public.site_pages (id, title, data, updated_at, updated_by)
  VALUES (p_id, p_title, p_data, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET title = EXCLUDED.title,
        data = EXCLUDED.data,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_save_page(TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_save_page(TEXT, TEXT, JSONB) TO authenticated;

-- Function for admins to reset a page back to default
CREATE OR REPLACE FUNCTION public.admin_reset_page(p_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  DELETE FROM public.site_pages WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_page(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_page(TEXT) TO authenticated;

COMMIT;

-- VERIFY:
-- Run these after the above block commits:
-- 1. Table exists and is readable:
--    SELECT * FROM public.site_pages;
-- 2. Functions exist:
--    SELECT proname FROM pg_proc WHERE proname IN ('admin_save_page', 'admin_reset_page');
