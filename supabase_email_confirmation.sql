-- ============================================
-- EMAIL CONFIRMATION — paste into Supabase SQL Editor and run.
-- Safe to run more than once. Run this BEFORE turning on "Confirm email".
--
-- With confirmation on, signUp() returns no session, so the browser can't
-- create the member's profile row itself. This trigger creates it the moment
-- the email is confirmed (or at signup, if confirmation is off), using the
-- display name they typed. Unconfirmed signups get no profile, so they don't
-- appear in member lists or the message picker.
-- ============================================

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

  -- Two people can pick the same name while both are unconfirmed; the second
  -- to confirm gets digits added rather than being locked out.
  LOOP
    BEGIN
      INSERT INTO users (id, email, username) VALUES (NEW.id, NEW.email, candidate);
      RETURN NEW;
    EXCEPTION WHEN unique_violation THEN
      IF EXISTS (SELECT 1 FROM users WHERE id = NEW.id) THEN RETURN NEW; END IF;
      attempt := attempt + 1;
      IF attempt > 5 THEN RETURN NEW; END IF;
      candidate := base || (100 + floor(random() * 900))::INT;
    END;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Never block the confirmation itself. If this fails, the app creates the
  -- profile on first login (lib/ensureProfile.js).
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_confirmed_user();
