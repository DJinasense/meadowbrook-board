-- ============================================
-- MEMBER FEATURES: private messages, photo/PDF attachments, editing own posts.
-- Paste into Supabase SQL Editor and run. Safe to run more than once.
-- Requires supabase_security_fix.sql and supabase_member_admin.sql (is_muted).
--
-- Pattern used throughout (see supabase_security_fix.sql for why): Supabase
-- grants table-wide INSERT/UPDATE to `authenticated`, and column-level
-- REVOKEs don't override that, so each table below revokes table-wide write
-- access and re-grants only the columns the app actually writes.
-- ============================================

-- 1. PRIVATE MESSAGES -------------------------------------------------------
--    Existing "Users see own DMs" (SELECT: sender or recipient) stays as-is.
--    There is deliberately no admin policy: admins cannot read messages.
DROP POLICY IF EXISTS "Users send DMs" ON direct_messages;
CREATE POLICY "Users send DMs" ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND recipient_id <> sender_id
    AND NOT is_muted((select auth.uid()))
  );

-- Recipients can mark their messages read (and nothing else — see grant).
DROP POLICY IF EXISTS "Recipients mark DMs read" ON direct_messages;
CREATE POLICY "Recipients mark DMs read" ON direct_messages FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()))
  WITH CHECK (recipient_id = (select auth.uid()));

REVOKE INSERT, UPDATE ON direct_messages FROM anon, authenticated;
GRANT INSERT (sender_id, recipient_id, content) ON direct_messages TO authenticated;
GRANT UPDATE (read) ON direct_messages TO authenticated;

-- 2. ATTACHMENTS ------------------------------------------------------------
--    uploaded_by defaults to the caller and isn't in the INSERT grant, so it
--    can't be spoofed. An attachment can only be added to your own thread or
--    reply. Deleting a member keeps their posts, so keep their files too.
ALTER TABLE files ADD COLUMN IF NOT EXISTS uploaded_by UUID
  REFERENCES users(id) ON DELETE SET NULL DEFAULT auth.uid();

DROP POLICY IF EXISTS "Only signed-up users upload files" ON files;
DROP POLICY IF EXISTS "Members attach files to own posts" ON files;
CREATE POLICY "Members attach files to own posts" ON files FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (select auth.uid())
    AND NOT is_muted((select auth.uid()))
    AND (
      (thread_id IS NOT NULL AND reply_id IS NULL
        AND EXISTS (SELECT 1 FROM threads t WHERE t.id = thread_id AND t.user_id = (select auth.uid())))
      OR
      (reply_id IS NOT NULL AND thread_id IS NULL
        AND EXISTS (SELECT 1 FROM replies r WHERE r.id = reply_id AND r.user_id = (select auth.uid())))
    )
  );

REVOKE INSERT, UPDATE ON files FROM anon, authenticated;
GRANT INSERT (thread_id, reply_id, file_url, file_name, file_type, file_size) ON files TO authenticated;

-- Storage bucket: public (so everyone sees previews), 10 MB, photos + PDFs only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-files', 'community-files', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members may only upload into a folder named after their own user id.
DROP POLICY IF EXISTS "Members upload to own folder" ON storage.objects;
CREATE POLICY "Members upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'community-files'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
    AND NOT public.is_muted((select auth.uid()))
  );

-- 3. EDITING YOUR OWN POSTS ------------------------------------------------
--    Muted members can't edit (otherwise editing would be a way around mute).
--    Admin UPDATE policies on threads/replies are separate and unaffected;
--    admins still need `status` in the grant for Remove/Restore.
DROP POLICY IF EXISTS "Authors edit own threads" ON threads;
CREATE POLICY "Authors edit own threads" ON threads FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND NOT is_muted((select auth.uid())))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors edit own replies" ON replies;
CREATE POLICY "Authors edit own replies" ON replies FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) AND NOT is_muted((select auth.uid())))
  WITH CHECK (user_id = (select auth.uid()));

REVOKE UPDATE ON threads FROM anon, authenticated;
GRANT UPDATE (title, content, category, status, updated_at) ON threads TO authenticated;
REVOKE UPDATE ON replies FROM anon, authenticated;
GRANT UPDATE (content, status) ON replies TO authenticated;
