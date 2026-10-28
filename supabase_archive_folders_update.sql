-- Archive folders: new list, and move existing posts to the new folders.
-- Run in the Supabase SQL Editor. Only threads.archive_folder changes; posts,
-- attachments, replies and likes are untouched.
--
-- 1. Preview (read-only): every archive post that will move, and where to.
--    Run this first and check the list.
--
--   SELECT id, title, archive_folder AS old_folder,
--          CASE archive_folder
--            WHEN 'building_budgeting' THEN 'budgets_financials'
--            WHEN 'balance_sheets'     THEN 'budgets_financials'
--            WHEN 'code_related'       THEN 'inspections_safety'
--            ELSE archive_folder
--          END AS new_folder,
--          created_at
--     FROM threads
--    WHERE category = 'archives'
--      AND archive_folder IN ('building_budgeting', 'balance_sheets', 'code_related')
--    ORDER BY archive_folder, created_at;
--
-- 2. Migration. Runs in one transaction: it either all applies or none does.

BEGIN;

-- Allow both old and new keys while the rows are moved.
ALTER TABLE threads DROP CONSTRAINT IF EXISTS threads_archive_folder_check;
ALTER TABLE threads ADD CONSTRAINT threads_archive_folder_check
  CHECK (archive_folder IS NULL OR archive_folder IN (
    'board_meetings', 'special_assessments', 'building_budgeting', 'balance_sheets', 'code_related',
    'budgets_financials', 'inspections_safety', 'contracts_vendors', 'governing_documents', 'owner_forms_letters'
  ));

UPDATE threads SET archive_folder = 'budgets_financials'
 WHERE archive_folder IN ('building_budgeting', 'balance_sheets');

UPDATE threads SET archive_folder = 'inspections_safety'
 WHERE archive_folder = 'code_related';

-- Only the new keys remain allowed.
ALTER TABLE threads DROP CONSTRAINT threads_archive_folder_check;
ALTER TABLE threads ADD CONSTRAINT threads_archive_folder_check
  CHECK (archive_folder IS NULL OR archive_folder IN (
    'board_meetings', 'budgets_financials', 'special_assessments', 'inspections_safety',
    'contracts_vendors', 'governing_documents', 'owner_forms_letters'
  ));

COMMIT;

-- 3. Verify (should return zero rows):
--   SELECT id, archive_folder FROM threads
--    WHERE archive_folder IN ('building_budgeting', 'balance_sheets', 'code_related');
