import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, X } from 'lucide-react';
import { ALLOWED_TYPES, MAX_FILES } from '../lib/attachments';

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Files chosen for a post that hasn't been submitted yet, with local previews.
export function FilePicker({ files, onChange, disabled }) {
  const inputRef = useRef(null);
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const urls = files.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          onChange([...files, ...Array.from(e.target.files || [])]);
          e.target.value = '';
        }}
      />
      {files.length < MAX_FILES && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
        >
          <Paperclip className="w-4 h-4" /> Attach photos or PDFs
        </button>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((f, i) => (
            <div key={i} className="relative flex items-center gap-2 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 pr-7 bg-slate-50 dark:bg-slate-900">
              {previews[i] ? (
                <img src={previews[i]} alt="" className="w-10 h-10 object-cover rounded" />
              ) : (
                <FileText className="w-6 h-6 text-rose-600 dark:text-rose-400 mx-2" />
              )}
              <div className="text-xs max-w-[9rem]">
                <p className="truncate text-slate-700 dark:text-slate-200">{f.name}</p>
                <p className="text-slate-400">{formatSize(f.size)}</p>
              </div>
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Attachments already saved on a thread or reply: small image previews that
// open full size, and PDFs as named links. Shown to everyone, guests included.
export function AttachmentList({ files }) {
  if (!files || files.length === 0) return null;
  const images = files.filter((f) => f.file_type === 'image');
  const docs = files.filter((f) => f.file_type !== 'image');
  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((f) => (
            <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" title={f.file_name}>
              <img src={f.file_url} alt={f.file_name} loading="lazy" className="w-24 h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-600 hover:opacity-90" />
            </a>
          ))}
        </div>
      )}
      {docs.map((f) => (
        <a
          key={f.id}
          href={f.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 w-fit max-w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
          <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="truncate">{f.file_name}</span>
          <span className="text-xs text-slate-400 shrink-0">{formatSize(f.file_size)}</span>
        </a>
      ))}
    </div>
  );
}
