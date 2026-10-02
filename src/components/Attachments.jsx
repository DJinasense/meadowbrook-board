import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileText, X, Download, Maximize2 } from 'lucide-react';
import { ALLOWED_TYPES, MAX_FILES, downloadUrl } from '../lib/attachments';
import { loadPdf, renderPageToCanvas } from '../lib/pdfRender';

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

// The first page of a PDF, drawn small. Rendering only starts once the tile
// scrolls into view: a board full of threads shouldn't fetch and parse every
// attached document the moment it loads.
function PdfThumb({ url, width }) {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await loadPdf(url);
        if (cancelled || !canvasRef.current) return;
        await renderPageToCanvas(pdf, 1, canvasRef.current, width);
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [visible, url, width]);

  // The tile is always white, never a dark-mode surface: a page that doesn't
  // fill it should look like the rest of the sheet, not like a gap.
  return (
    <div ref={boxRef} className="w-full h-full bg-white overflow-hidden relative">
      <canvas ref={canvasRef} className={`block ${status === 'ready' ? '' : 'invisible'}`} />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
          <FileText className="w-7 h-7 text-rose-600" />
          <span className="text-[10px] font-semibold tracking-wide">PDF</span>
        </div>
      )}
    </div>
  );
}

// Tiles are portrait rather than square, at roughly the proportions of a sheet
// of paper: at these widths pdf.js draws very nearly the whole first page, so a
// notice is actually readable in the list instead of being a postage stamp.
// Photos are cropped to the same shape so a row of mixed attachments lines up.
const THUMB_SIZES = {
  sm: { width: 120, height: 150 }, // under a post in the board list
  md: { width: 168, height: 210 }, // inside an open thread
};

// One attachment as a preview tile. The expand badge stays faintly visible
// rather than appearing on hover — on a phone there is no hover, and nothing
// would otherwise say the preview opens.
function Thumb({ file, size, onOpen }) {
  const { width, height } = THUMB_SIZES[size];
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${file.file_name} — tap to open full size`}
      style={{ width, height }}
      className="group relative shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {file.file_type === 'image' ? (
        <img src={file.file_url} alt={file.file_name} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <PdfThumb url={file.file_url} width={width} />
      )}
      <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/15 transition-colors" />
      <span className="absolute top-1.5 right-1.5 bg-slate-900/60 group-hover:bg-slate-900/80 rounded-md p-1 transition-colors">
        <Maximize2 className="w-3.5 h-3.5 text-white" />
      </span>
      {file.file_type !== 'image' && (
        <span className="absolute bottom-0 left-0 right-0 bg-slate-900/75 text-white text-[10px] px-1.5 py-1 truncate text-left">
          {file.file_name}
        </span>
      )}
    </button>
  );
}

// The row of previews that hangs under a post in the board list, so a notice or
// photo can be seen — and opened full size — without first opening the thread.
// Several attachments sit side by side in one strip that scrolls sideways if it
// runs past the card, rather than wrapping into a block that pushes the post's
// own details off the screen. onOpen is called as (files, index, event).
export function AttachmentThumbs({ files, onOpen, limit = MAX_FILES }) {
  if (!files || files.length === 0) return null;
  const shown = files.slice(0, limit);
  const extra = files.length - shown.length;
  return (
    <div className="flex items-stretch gap-2 mb-3 overflow-x-auto pb-1 -mx-0.5 px-0.5">
      {shown.map((file, i) => (
        <Thumb key={file.id} file={file} size="sm" onOpen={(e) => onOpen(files, i, e)} />
      ))}
      {extra > 0 && (
        <button
          type="button"
          onClick={(e) => onOpen(files, limit, e)}
          style={{ width: THUMB_SIZES.sm.width, height: THUMB_SIZES.sm.height }}
          className="shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-700 dark:hover:text-blue-400"
        >
          +{extra} more
        </button>
      )}
    </div>
  );
}

// Attachments on an open thread or reply: bigger previews, each with its own
// download link, and a tap opens the full-size viewer. Shown to everyone,
// guests included. There is room to wrap here, unlike the board list.
// onOpen is called as (files, index, event).
export function AttachmentList({ files, onOpen }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {files.map((file, i) => (
        <div key={file.id} style={{ width: THUMB_SIZES.md.width }}>
          <Thumb file={file} size="md" onOpen={(e) => onOpen(files, i, e)} />
          <div className="mt-1 text-xs">
            <p className="truncate text-slate-600 dark:text-slate-300" title={file.file_name}>{file.file_name}</p>
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <span>{formatSize(file.file_size)}</span>
              <a
                href={downloadUrl(file)}
                download={file.file_name}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 text-blue-700 dark:text-blue-400 hover:underline"
              >
                <Download className="w-3 h-3" /> Save
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
