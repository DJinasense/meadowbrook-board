import { supabase } from './supabaseClient';

const BUCKET = 'community-files';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;
// Must match allowed_mime_types on the bucket (supabase_member_features.sql).
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

export function validateFiles(files) {
  if (files.length > MAX_FILES) return `You can attach up to ${MAX_FILES} files.`;
  for (const f of files) {
    if (!ALLOWED_TYPES.includes(f.type)) return `"${f.name}" isn't a photo or PDF.`;
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" is over 10 MB.`;
  }
  return null;
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
      file_type: file.type.startsWith('image/') ? 'image' : 'document',
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
