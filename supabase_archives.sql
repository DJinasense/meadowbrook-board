-- ============================================
-- DOCUMENT ARCHIVES: files the board, not a conversation, as ordinary threads
-- with category = 'archives' plus two new columns. Paste into Supabase SQL
-- Editor and run. Safe to run more than once (idempotent).
--
-- Any signed-in member (not guests) can file a document. Guests can still
-- post every other category exactly as before; they are explicitly barred
-- from archives and from setting the two new columns at all.
-- ============================================

-- 1. New columns -------------------------------------------------------------
ALTER TABLE threads ADD COLUMN IF NOT EXISTS archive_folder text;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS doc_date date;

ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_archive_folder_check;
ALTER TABLE threads ADD CONSTRAINT threads_archive_folder_check
  CHECK (archive_folder IS NULL OR archive_folder IN (
    'board_meetings', 'special_assessments', 'building_budgeting',
    'balance_sheets', 'code_related'
  ));

-- 2. INSERT policy -------------------------------------------------------------
-- threads INSERT is table-wide for anon/authenticated (Supabase grants it and
-- column-level REVOKEs don't narrow INSERT), so archive_folder/doc_date are
-- guest-writable unless this policy says otherwise. Keeps every existing
-- condition from supabase_post_flags.sql and adds the archives rule to both
-- branches.
DROP POLICY IF EXISTS "Anyone can post threads" ON threads;
CREATE POLICY "Anyone can post threads" ON threads FOR INSERT TO public
WITH CHECK (
  announced_at IS NULL
  AND (
    (
      user_id IS NULL
      AND alert_type IS NULL
      AND category <> 'archives'
      AND archive_folder IS NULL
      AND doc_date IS NULL
    )
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
      AND (
        (category = 'archives' AND archive_folder IS NOT NULL AND doc_date IS NOT NULL)
        OR (category <> 'archives' AND archive_folder IS NULL AND doc_date IS NULL)
      )
    )
  )
);

-- Deliberately NOT added to the threads UPDATE grant (supabase_member_features.sql
-- line ~91): archive_folder/doc_date stay admin-only to change, same as
-- alert_type. A misfiled document gets removed and re-posted rather than edited.

-- 3. Storage bucket: 25 MB, photos + PDFs + Word/Excel -----------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-files', 'community-files', true, 26214400, ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. files.file_type backfill: 'document' meant PDF (the bucket has never
-- accepted anything else); the three-way client reads 'pdf' for that now.
-- Safe in either deploy order: the currently-deployed client treats any
-- non-'image' file_type as a PDF, which 'pdf' still is.
UPDATE files SET file_type = 'pdf' WHERE file_type = 'document';
