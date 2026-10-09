// The five folders a filed document can go in. `threads.archive_folder` in
// the database holds the key — these ids must match the CHECK constraint in
// supabase_archives.sql exactly.
export const ARCHIVE_FOLDER_ORDER = [
  'board_meetings',
  'special_assessments',
  'building_budgeting',
  'balance_sheets',
  'code_related',
];

export const ARCHIVE_FOLDERS = {
  board_meetings: { label: 'Board Meetings' },
  special_assessments: { label: 'Special Assessments' },
  building_budgeting: { label: 'Building Budgeting' },
  balance_sheets: { label: 'Balance Sheets' },
  code_related: { label: 'Code Related' },
};
