-- ============================================
-- ADDITIONS TO SUPPORT THE APP
-- Paste into Supabase SQL Editor and run
-- Safe to run more than once (idempotent).
-- ============================================

-- 1. Admin flag + apartment-visibility opt-in on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_apartment BOOLEAN DEFAULT FALSE;

-- 2. Helper function: checks admin status WITHOUT causing recursive RLS checks
--    (SECURITY DEFINER = runs with elevated privilege, bypassing RLS internally)
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM users WHERE id = uid), false);
$$;

-- 3. Lock down the real `users` table:
--    - you can always read your OWN full row
--    - admins can read everyone's full row (needed for admin dashboard)
--    - nobody else gets direct access to this table
DROP POLICY IF EXISTS "Users read own full profile" ON users;
CREATE POLICY "Users read own full profile" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins read all profiles" ON users;
CREATE POLICY "Admins read all profiles" ON users
  FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users update own profile" ON users;
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- 4. Public "member directory" view — this is what the app queries to show
--    "posted by <username>" (and apartment number, only if the member opted in).
--    Views created this way run with the owner's privileges, so they can expose
--    exactly these columns without exposing email or opening up the base table.
CREATE OR REPLACE VIEW member_directory AS
SELECT id, username, is_admin,
       CASE WHEN show_apartment THEN apartment ELSE NULL END AS apartment
FROM users;

GRANT SELECT ON member_directory TO anon, authenticated;

-- 5. Turn on security for the two tables that were missing it
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read likes" ON likes;
CREATE POLICY "Public read likes" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Signed-up users like" ON likes;
CREATE POLICY "Signed-up users like" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users remove own like" ON likes;
CREATE POLICY "Users remove own like" ON likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE invite_code_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read redemptions" ON invite_code_redemptions;
CREATE POLICY "Admins read redemptions" ON invite_code_redemptions
  FOR SELECT USING (is_admin(auth.uid()));

-- 6. Let admins actually see reports + the invite code tracker
--    (previously nobody could SELECT these at all)
DROP POLICY IF EXISTS "Admins read reports" ON reports;
CREATE POLICY "Admins read reports" ON reports
  FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update reports" ON reports;
CREATE POLICY "Admins update reports" ON reports
  FOR UPDATE USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read invite codes" ON invite_codes;
CREATE POLICY "Admins read invite codes" ON invite_codes
  FOR SELECT USING (is_admin(auth.uid()));

-- 7. Invite-code signup, split into two server-side functions:
--
--    check_invite_code(code)   -> read-only, tells the signup form if a code
--                                 is valid BEFORE the person creates an account
--
--    redeem_invite_code(code, username) -> called right after
--                                 supabase.auth.signUp() succeeds. Re-checks the
--                                 code, creates the `users` profile row tied to
--                                 the new login (auth.uid()), records the
--                                 redemption, and increments use_count — all in
--                                 one atomic step to avoid a code being used more
--                                 times than allowed by simultaneous signups.

CREATE OR REPLACE FUNCTION public.check_invite_code(p_code TEXT)
RETURNS TABLE (is_valid BOOLEAN, apartment TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT (use_count < max_uses), apartment
  FROM invite_codes
  WHERE code = p_code;
$$;

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT, p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_apartment TEXT;
  v_use_count INTEGER;
  v_max_uses INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT apartment, use_count, max_uses INTO v_apartment, v_use_count, v_max_uses
  FROM invite_codes
  WHERE code = p_code
  FOR UPDATE;

  IF v_apartment IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF v_use_count >= v_max_uses THEN
    RAISE EXCEPTION 'Invite code has no uses remaining';
  END IF;

  INSERT INTO users (id, email, username, apartment)
  VALUES (auth.uid(), auth.email(), p_username, v_apartment);

  INSERT INTO invite_code_redemptions (code, used_by)
  VALUES (p_code, auth.uid());

  UPDATE invite_codes SET use_count = use_count + 1 WHERE code = p_code;

  RETURN v_apartment;
END;
$$;
