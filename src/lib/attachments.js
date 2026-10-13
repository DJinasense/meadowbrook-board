import { supabase } from './supabaseClient';

const BUCKET = 'community-files';
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 5;
// Must match allowed_mime_types on the bucket (supabase_archives.sql).
export const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateFiles(files) {
  if (files.length > MAX_FILES) return `You can attach up to ${MAX_FILES} files.`;
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type)) return `"${f.name}" isn't a photo, PDF, Word, or Excel file.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" is over 25 MB.`;
  }
  return null;
}

// files.file_type is 'image' | 'pdf' | 'document' (document = Office/other —
// anything pdf.js can't parse, so it never goes through PdfThumb/PdfPages).
function fileTypeFromMime(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'document';
}

// A short badge for a non-PDF document tile, derived from the filename since
// the stored MIME type isn't surfaced to these components. Unrecognized
// extensions fall back to "FILE" rather than guessing.
export function fileKindLabel(file) {
  const ext = (file.file_name || '').split('.').pop()?.toUpperCase();
  if (file.file_type === 'pdf') return 'PDF';
  if (['DOC', 'DOCX'].includes(ext)) return 'DOCX';
  if (['XLS', 'XLSX'].includes(ext)) return 'XLSX';
  return ext || 'FILE';
}

// Uploads into <userId>/<postId>/..., the folder layout the storage policy
// requires, then records each file against the thread or reply. Returns the
// names of any files that failed, so the post itself isn't lost over one bad file.
export async function uploadAttachments(files, userId, { threadId = null, replyId = null }) {
  const failed = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${threadId || replyId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (uploadError) { failed.push(file.name); continue; }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { error: rowError } = await supabase.from('files').insert({
      thread_id: threadId,
      reply_id: replyId,
      file_url: data.publicUrl,
      file_name: file.name,
      file_type: fileTypeFromMime(file.type),
      file_size: file.size,
    });
    if (rowError) failed.push(file.name);
  }
  return failed;
}

// Supabase serves public files with Content-Disposition: attachment when the
// URL carries ?download=<name>, which is the only way to get a real download
// (the HTML `download` attribute is ignored across origins).
export function downloadUrl(file) {
  const separator = file.file_url.includes('?') ? '&' : '?';
  return `${file.file_url}${separator}download=${encodeURIComponent(file.file_name)}`;
}

// Archive previews: a small JPEG of the first page (or the photo itself),
// made in the browser at filing time and stored beside the document as
// preview.jpg. The Archives list then downloads only this small image, never
// the whole PDF, which keeps the free plan's download allowance safe.
export const ARCHIVE_PREVIEW_WIDTH = 360;

export function archivePreviewUrl(userId, threadId) {
  return supabase.storage.from(BUCKET).getPublicUrl(`${userId}/${threadId}/preview.jpg`).data.publicUrl;
}

async function renderArchivePreview(file) {
  const canvas = document.createElement('canvas');
  if (file.type === 'application/pdf') {
    const { loadPdf, renderPageToCanvas } = await import('./pdfRender');
    const objectUrl = URL.createObjectURL(file);
    try {
      const pdf = await loadPdf(objectUrl);
      await renderPageToCanvas(pdf, 1, canvas, ARCHIVE_PREVIEW_WIDTH);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return canvas;
  }
  const bitmap = await createImageBitmap(file);
  canvas.width = ARCHIVE_PREVIEW_WIDTH;
  canvas.height = Math.round((bitmap.height * ARCHIVE_PREVIEW_WIDTH) / bitmap.width);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

// Never fails the post: if the preview can't be made, the Archives list just
// shows the file-type badge instead.
export async function saveArchivePreview(file, userId, threadId) {
  try {
    const canvas = await renderArchivePreview(file);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (!blob) return false;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${userId}/${threadId}/preview.jpg`, blob, { contentType: 'image/jpeg' });
    return !error;
  } catch (err) {
    console.error('archive preview failed', err);
    return false;
  }
}

export async function fetchAttachments({ threadIds = [], replyIds = [] }) {
  const byThread = {};
  const byReply = {};
  const queries = [];
  if (threadIds.length) queries.push(supabase.from('files').select('id, thread_id, file_url, file_name, file_type, file_size').in('thread_id', threadIds));
  if (replyIds.length) queries.push(supabase.from('files').select('id, reply_id, file_url, file_name, file_type, file_size').in('reply_id', replyIds));
  const results = await Promise.all(queries);
  for (const { data } of results) {
    for (const f of data || []) {
      if (f.thread_id) (byThread[f.thread_id] ||= []).push(f);
      if (f.reply_id) (byReply[f.reply_id] ||= []).push(f);
    }
  }
  return { byThread, byReply };
}
