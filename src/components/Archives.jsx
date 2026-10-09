import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Archive, Search, Plus, FileText, Image as ImageIcon, Download, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useCurrentUser } from '../lib/useCurrentUser';
import { fetchDirectory } from '../lib/directory';
import { fetchAttachments, downloadUrl, fileKindLabel } from '../lib/attachments';
import { ARCHIVE_FOLDER_ORDER, ARCHIVE_FOLDERS } from '../lib/archiveFolders';
import { navigate } from '../lib/router';

function authorLabel(row, directory) {
  if (row.is_anonymous) {
    return row.user_id ? 'Anonymous' : (row.guest_name || 'Anonymous');
  }
  if (row.user_id && directory[row.user_id]) return directory[row.user_id].username;
  return row.guest_name || 'Anonymous';
}

function formatDocDate(value) {
  if (!value) return '';
  // doc_date is a plain date (no time component) — parse it as local, not UTC,
  // so "2026-01-05" doesn't display as the day before in western timezones.
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// This page intentionally shows icons and metadata only, never a PDF thumbnail
// — a pdf.js thumbnail downloads the whole document to draw page 1, and a long
// list of archived documents is exactly where that could burn through the free
// Supabase plan's 5 GB/month egress. Bytes are only fetched once someone opens
// a document (the thread view, or a direct Save).
function FileBadge({ file }) {
  const Icon = file.file_type === 'image' ? ImageIcon : FileText;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5">
      <Icon className="w-3 h-3" /> {fileKindLabel(file)}
    </span>
  );
}

export default function Archives({ onBack, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();
  const [entries, setEntries] = useState([]);
  const [attachments, setAttachments] = useState({ byThread: {} });
  const [loaded, setLoaded] = useState(false);
  const [folder, setFolder] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error } = await supabase
        .from('threads')
        .select('id, user_id, guest_name, title, content, is_anonymous, archive_folder, doc_date, created_at')
        .eq('status', 'visible')
        .eq('category', 'archives')
        .order('doc_date', { ascending: false });

      if (error || cancelled) { setLoaded(true); return; }

      const threadIds = rows.map((r) => r.id);
      const authorIds = [...new Set(rows.filter((t) => t.user_id && !t.is_anonymous).map((t) => t.user_id))];
      const [directory, atts] = await Promise.all([fetchDirectory(authorIds), fetchAttachments({ threadIds })]);
      if (cancelled) return;

      setEntries(rows.map((r) => ({ ...r, authorLabel: authorLabel(r, directory) })));
      setAttachments(atts);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => folder === 'all' || e.archive_folder === folder)
      .filter((e) => q === '' || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q));
  }, [entries, folder, query]);

  // Newest year first, newest document first within each year — reads as a
  // chronological filing system rather than an upload log.
  const groupedByYear = useMemo(() => {
    const groups = {};
    filtered.forEach((e) => {
      const year = e.doc_date ? e.doc_date.slice(0, 4) : 'Undated';
      (groups[year] ||= []).push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-blue-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
              <Archive className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Archives</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Board minutes, budgets, and other standing documents</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <button onClick={() => { if (onBack) onBack(); }} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <ArrowLeft className="w-4 h-4" /> Board
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto p-4">{children}</div>
    </div>
  );

  return shell(
    <div>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {!authLoading && currentUser && (
          <button
            onClick={() => navigate('create')}
            className="flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> File a document
          </button>
        )}
      </div>

      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFolder('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            folder === 'all' ? 'bg-teal-600 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {ARCHIVE_FOLDER_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => setFolder(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              folder === id ? 'bg-teal-600 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            {ARCHIVE_FOLDERS[id].label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading archives...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10 bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
          No documents here yet.
        </p>
      ) : (
        <div className="space-y-6">
          {groupedByYear.map(([year, rows]) => (
            <div key={year}>
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{year}</h2>
              <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {rows.map((entry) => {
                  const files = attachments.byThread[entry.id] || [];
                  return (
                    // The Save link is a sibling of the row button, not inside
                    // it: an <a> nested in a <button> is invalid and doesn't
                    // reliably activate.
                    <div key={entry.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <button
                        onClick={() => navigate('thread', entry.id)}
                        className="w-full text-left flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="inline-block text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/40 rounded px-1.5 py-0.5 mb-1">
                            {ARCHIVE_FOLDERS[entry.archive_folder]?.label || entry.archive_folder}
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{entry.title}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {formatDocDate(entry.doc_date)} · filed by {entry.authorLabel}
                          </p>
                        </div>
                        {files.length > 0 && (
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <FileBadge file={files[0]} />
                            {files.length > 1 && (
                              <span className="text-[11px] text-slate-400">+{files.length - 1} more</span>
                            )}
                          </div>
                        )}
                      </button>
                      {files.length > 0 && (
                        <a
                          href={downloadUrl(files[0])}
                          download={files[0].file_name}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          <Download className="w-3 h-3" /> Save
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
