import React, { useState } from 'react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/dist/index.css';
import { Shield, ArrowLeft, Sun, Moon, RotateCcw, AlertTriangle, ExternalLink, Check, FileText } from 'lucide-react';
import { puckConfig } from '../lib/puckConfig';
import { useSitePage } from '../lib/useSitePage';
import { useCurrentUser } from '../lib/useCurrentUser';

const PRESET_PAGES = [
  { id: 'landing', label: 'Landing Page', path: '/' },
  { id: 'rules', label: 'Building Rules & Bylaws', path: '/rules' },
  { id: 'resources', label: 'Contacts & Directory', path: '/resources' },
];

export default function VisualEditor({ initialPageId = 'landing', onBack, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const [customPages, setCustomPages] = useState([]);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState('');

  const { pageData, tableExists, savePage, resetPage } = useSitePage(currentPageId);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const allPages = [...PRESET_PAGES, ...customPages];
  const activePage = allPages.find((p) => p.id === currentPageId) || {
    id: currentPageId,
    label: currentPageId,
    path: `/${currentPageId}`,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm dark:bg-slate-900">
        Checking access...
      </div>
    );
  }

  if (!currentUser?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 dark:bg-slate-900">
        <div className="text-center">
          <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">Admins only</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">You don't have access to the visual editor.</p>
          <button
            onClick={() => { if (onBack) onBack(); }}
            className="text-blue-700 dark:text-blue-400 font-medium text-sm hover:underline"
          >
            ← Back to board
          </button>
        </div>
      </div>
    );
  }

  async function handlePublish(newData) {
    setSaving(true);
    setErrorMsg(null);
    try {
      await savePage(currentPageId, activePage.label, newData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to publish page:', err);
      setErrorMsg(err.message || 'Failed to save page to database');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefault() {
    if (!window.confirm(`Reset "${activePage.label}" back to the original default blocks?`)) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await resetPage(currentPageId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Reset failed:', err);
      setErrorMsg(err.message || 'Failed to reset page');
    } finally {
      setSaving(false);
    }
  }

  function handleCreatePage(e) {
    e.preventDefault();
    const clean = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!clean) return;
    if (!allPages.some((p) => p.id === clean)) {
      setCustomPages((prev) => [...prev, { id: clean, label: clean, path: `/${clean}` }]);
    }
    setCurrentPageId(clean);
    setNewPageSlug('');
    setShowNewPageModal(false);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Top Bar for Visual Studio */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (onBack) onBack(); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Exit
          </button>

          <div className="h-4 w-px bg-slate-700" />

          {/* Page Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold hidden sm:inline">
              Page:
            </span>
            <select
              value={currentPageId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewPageModal(true);
                } else {
                  setCurrentPageId(e.target.value);
                }
              }}
              className="bg-slate-800 text-xs font-semibold text-white px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {allPages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.path})
                </option>
              ))}
              <option value="__new__">+ Create New Page...</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800">
              <Check className="w-3.5 h-3.5" /> Published live!
            </span>
          )}
          {errorMsg && (
            <span className="text-xs text-rose-400 font-medium bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-800">
              {errorMsg}
            </span>
          )}

          <button
            onClick={handleResetDefault}
            disabled={saving}
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            title="Revert back to default layout"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle dark/light theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Database Warning if table missing */}
      {!tableExists && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Database notice:</strong> Run <code>supabase_site_pages.sql</code> in the Supabase SQL editor to persist your visual layout changes.
            </span>
          </div>
          <a
            href="https://supabase.com/dashboard/project/kjsnaibbhjxkaglfsowd/sql"
            target="_blank"
            rel="noreferrer"
            className="underline flex items-center gap-1 font-semibold"
          >
            Open SQL Editor <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Puck Visual Canvas */}
      <div key={currentPageId} className="flex-1 overflow-hidden relative">
        <Puck
          config={puckConfig}
          data={pageData}
          onPublish={handlePublish}
        />
      </div>

      {/* Modal for creating a new page */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-700 shadow-xl">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Create Custom Page
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter a URL slug for your new page (e.g. <code>bylaws</code> or <code>parking</code>).
            </p>
            <form onSubmit={handleCreatePage} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Page Slug</label>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                  <span>/</span>
                  <input
                    type="text"
                    value={newPageSlug}
                    onChange={(e) => setNewPageSlug(e.target.value)}
                    placeholder="e.g. move-in-guide"
                    autoFocus
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPageModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPageSlug.trim()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
