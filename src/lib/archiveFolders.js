// The folders a filed document can go in. `threads.archive_folder` in the
// database holds the key — these ids must match the CHECK constraint in
// supabase_archive_folders_update.sql exactly.
export const ARCHIVE_FOLDER_ORDER = [
  'board_meetings',
  'budgets_financials',
  'special_assessments',
  'inspections_safety',
  'contracts_vendors',
  'governing_documents',
  'owner_forms_letters',
];

export const ARCHIVE_FOLDERS = {
  board_meetings: { label: 'Board Meetings' },
  budgets_financials: { label: 'Budgets & Financials' },
  special_assessments: { label: 'Special Assessments' },
  inspections_safety: { label: 'Inspections & Safety' },
  contracts_vendors: { label: 'Contracts & Vendors' },
  governing_documents: { label: 'Governing Documents' },
  owner_forms_letters: { label: 'Owner Forms & Letters' },
};
