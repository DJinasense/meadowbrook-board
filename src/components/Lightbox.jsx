import React, { useEffect, useRef, useState } from 'react';
import { X, Download, ExternalLink, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { loadPdf, renderPageToCanvas } from '../lib/pdfRender';
import { downloadUrl } from '../lib/attachments';

// Every page of a PDF, drawn one after another into a scrollable column.
function PdfPages({ url }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.replaceChildren();
    setStatus('loading');
    setPageCount(0);

    (async () => {
      try {
        const pdf = await loadPdf(url);
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setStatus('ready');
        // Pages are drawn in order rather than all at once: a long scan stays
        // responsive, and the first page shows up immediately.
        const width = Math.min(container.clientWidth || 800, 1000);
        for (let page = 1; page <= pdf.numPages; page++) {
          if (cancelled) return;
          const canvas = document.createElement('canvas');
          canvas.className = 'bg-white rounded shadow-lg mx-auto block';
          container.appendChild(canvas);
          await renderPageToCanvas(pdf, page, canvas, width);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div className="w-full h-full overflow-y-auto overscroll-contain px-2 py-3 sm:px-4">
      <div ref={containerRef} className="space-y-3 max-w-3xl mx-auto" />
      {status === 'loading' && <p className="text-center text-sm text-slate-300 py-10">Opening document…</p>}
      {status === 'error' && (
        <div className="text-center text-sm text-slate-300 py-10 space-y-3">
          <p>This document couldn't be shown here.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline">
            <ExternalLink className="w-4 h-4" /> Open it in a new tab instead
          </a>
        </div>
      )}
      {status === 'ready' && pageCount > 1 && (
        <p className="text-center text-xs text-slate-400 pt-3 pb-1">{pageCount} pages</p>
      )}
    </div>
  );
}

// Full-screen viewer for an attachment: photos fit to the screen, PDFs render
// page by page. Opened from a thumbnail on the board or inside a thread, so a
// resident never has to leave the board to look at what a neighbour posted.
// `files` is the whole post's attachment list, so they can swipe through.
export default function Lightbox({ files, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const file = files[index];

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i > 0 ? i - 1 : i));
      if (e.key === 'ArrowRight') setIndex((i) => (i < files.length - 1 ? i + 1 : i));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [files.length, onClose]);

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{file.file_name}</p>
          {files.length > 1 && <p className="text-xs text-slate-400">{index + 1} of {files.length}</p>}
        </div>
        <a
          href={downloadUrl(file)}
          download={file.file_name}
          title="Download"
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2"
        >
          <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download</span>
        </a>
        <a
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in a new tab"
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={onClose}
          title="Close"
          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {file.file_type === 'image' ? (
          <img src={file.file_url} alt={file.file_name} className="max-h-full max-w-full object-contain" />
        ) : (
          <PdfPages url={file.file_url} />
        )}
      </div>

      {files.length > 1 && (
        <div
          className="flex items-center justify-between px-3 py-2.5 border-t border-white/10 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-30 px-3 py-2"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(files.length - 1, i + 1))}
            disabled={index === files.length - 1}
            className="flex items-center gap-1 text-sm text-slate-300 hover:text-white disabled:opacity-30 px-3 py-2"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
