-- Replaces the single "urgent" checkbox with three post flags:
--   urgent        red star           (safety / needs everyone's attention now)
--   construction  orange traffic cone (building work, water shutoff, repairs)
--   attention     yellow star        ("Heads up" — good to know, not an emergency)
-- Applied 2026-10-04 in two steps. Safe to re-run.
--
-- STEP 1 (additive; the previously deployed client keeps working): add
-- threads.alert_type and move the policy + admin RPCs onto it.
-- STEP 2 (run after the new client is live): drop the old is_urgent column.

-- ---------------------------------------------------------------------------
-- STEP 1
-- ---------------------------------------------------------------------------
ALTER TABLE threads ADD COLUMN IF NOT EXISTS alert_type text;
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_alert_type_check;
ALTER TABLE threads ADD CONSTRAINT threads_alert_type_check
  CHECK (alert_type IS NULL OR alert_type IN ('urgent', 'construction', 'attention'));

UPDATE threads SET alert_type = 'urgent' WHERE is_urgent AND alert_type IS NULL;

-- Same rules as before, keyed on alert_type: guests can't flag, nobody can
-- pre-set announced_at, and a member gets at most 2 flagged posts per rolling
-- 24 hours (the admin still reviews each one before any email goes out).
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads FOR INSERT TO public
WITH CHECK (
  announced_at IS NULL
  AND (
    (user_id IS NULL AND alert_type IS NULL)
    OR (
      user_id = (SELECT auth.uid())
      AND NOT is_muted((SELECT auth.uid()))
      AND (
        alert_type IS NULL
        OR (
          SELECT count(*) FROM threads t
          WHERE t.user_id = (SELECT auth.uid())
            AND t.alert_type IS NOT NULL
            AND t.created_at > now() - interval '24 hours'
        ) < 2
      )
    )
  )
);

DROP FUNCTION IF EXISTS public.admin_dismiss_urgent(uuid);
CREATE OR REPLACE FUNCTION public.admin_dismiss_flag(p_thread uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE threads SET alert_type = NULL WHERE id = p_thread;
END;
$function$;

-- Return type changes (adds alert_type), so drop and recreate.
DROP FUNCTION IF EXISTS public.admin_claim_announcement(uuid);
CREATE FUNCTION public.admin_claim_announcement(p_thread uuid)
 RETURNS TABLE (id uuid, title text, content text, alert_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    UPDATE threads t SET announced_at = now()
     WHERE t.id = p_thread AND t.alert_type IS NOT NULL AND t.announced_at IS NULL AND t.status = 'visible'
    RETURNING t.id, t.title, t.content, t.alert_type;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_dismiss_flag(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_claim_announcement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_flag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_announcement(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- STEP 2 (run only after the client using alert_type is deployed)
-- ---------------------------------------------------------------------------
-- ALTER TABLE threads DROP COLUMN is_urgent;
