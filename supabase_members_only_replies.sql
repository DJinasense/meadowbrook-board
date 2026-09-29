-- Replies are a member benefit: guests (no login) can no longer reply.
-- Requires supabase_member_admin.sql (for is_muted). Safe to run more than once.
DROP POLICY IF EXISTS "Anyone can post replies" ON replies;
DROP POLICY IF EXISTS "Members can post replies" ON replies;
CREATE POLICY "Members can post replies" ON replies FOR INSERT WITH CHECK (
  user_id = (select auth.uid()) AND NOT is_muted((select auth.uid()))
);
