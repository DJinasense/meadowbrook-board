-- Urgent posts + announcement emails + "Suspend my account".
-- Run on the live project 2026-10-04 (via the Management API). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Urgent posts
-- ---------------------------------------------------------------------------
-- is_urgent: set by the author at post time (members only, see the policy).
-- announced_at: set only by admin_claim_announcement(), i.e. when an admin sent
-- the email. Neither column is user-updatable (threads UPDATE is column-granted
-- and these are not in that grant); only the admin RPCs below change them.
ALTER TABLE threads ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS announced_at timestamptz;

-- threads INSERT is table-wide for anon + authenticated, so the policy has to
-- be the gate: guests can't flag urgent, nobody can pre-set announced_at, and a
-- member gets at most 2 urgent posts per rolling 24 hours (spam brake — the
-- admin still reviews each one before any email goes out).
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads FOR INSERT TO public
WITH CHECK (
  announced_at IS NULL
  AND (
    (user_id IS NULL AND NOT is_urgent)
    OR (
      user_id = (SELECT auth.uid())
      AND NOT is_muted((SELECT auth.uid()))
      AND (
        NOT is_urgent
        OR (
          SELECT count(*) FROM threads t
          WHERE t.user_id = (SELECT auth.uid())
            AND t.is_urgent
            AND t.created_at > now() - interval '24 hours'
        ) < 2
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Member settings: announcements opt-in + suspension flag
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_announcements boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Only the opt-in is user-editable; is_suspended changes through the RPCs.
GRANT UPDATE (notify_announcements) ON users TO authenticated;

-- A suspended account is treated like a muted one by every existing RLS check
-- (thread/reply insert + edit, direct messages), without touching those policies.
CREATE OR REPLACE FUNCTION public.is_muted(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT COALESCE((SELECT is_muted OR is_suspended FROM users WHERE id = uid), false); $function$;

-- ---------------------------------------------------------------------------
-- 3. Feedback left when someone suspends their account (admin-readable only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  username text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE account_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_feedback FROM anon, authenticated;
GRANT SELECT ON account_feedback TO authenticated;
DROP POLICY IF EXISTS "Admins read feedback" ON account_feedback;
CREATE POLICY "Admins read feedback" ON account_feedback FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. RPCs (all SECURITY DEFINER; EXECUTE limited to signed-in users)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suspend_my_account(p_feedback text DEFAULT '')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE users
     SET is_suspended = true, suspended_at = now(),
         notify_announcements = false, notify_on_reply = false, notify_daily_digest = false
   WHERE id = me
   RETURNING username INTO name;
  IF name IS NULL THEN RAISE EXCEPTION 'No profile found'; END IF;
  IF length(btrim(coalesce(p_feedback, ''))) > 0 THEN
    INSERT INTO account_feedback (user_id, username, message)
    VALUES (me, name, left(btrim(p_feedback), 1000));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reactivate_my_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE users SET is_suspended = false, suspended_at = NULL WHERE id = auth.uid();
END;
$function$;

-- Admin removes the urgent flag (not urgent / spam). The post itself stays.
CREATE OR REPLACE FUNCTION public.admin_dismiss_urgent(p_thread uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE threads SET is_urgent = false WHERE id = p_thread;
END;
$function$;

-- Step 1 of sending: atomically mark the post announced so a double click (or
-- two admins) can't email everyone twice. Returns the post, or no row if it
-- was already announced / isn't an urgent visible post.
CREATE OR REPLACE FUNCTION public.admin_claim_announcement(p_thread uuid)
 RETURNS TABLE (id uuid, title text, content text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    UPDATE threads t SET announced_at = now()
     WHERE t.id = p_thread AND t.is_urgent AND t.announced_at IS NULL AND t.status = 'visible'
    RETURNING t.id, t.title, t.content;
END;
$function$;

-- Undo the claim if the email provider rejected the send.
CREATE OR REPLACE FUNCTION public.admin_release_announcement(p_thread uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE threads SET announced_at = NULL WHERE id = p_thread;
END;
$function$;

-- Who gets the email: opted in, not suspended. Admin-only (it exposes emails).
CREATE OR REPLACE FUNCTION public.admin_announcement_recipients()
 RETURNS TABLE (email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT u.email FROM users u
     WHERE u.notify_announcements AND NOT u.is_suspended AND u.email IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.suspend_my_account(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_my_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dismiss_urgent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_claim_announcement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_release_announcement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_announcement_recipients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_my_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_urgent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_claim_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_release_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_announcement_recipients() TO authenticated;
