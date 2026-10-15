import React, { useState } from 'react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/dist/index.css';
import { Shield, ArrowLeft, Sun, Moon, RotateCcw, AlertTriangle, ExternalLink, Check } from 'lucide-react';
import { puckConfig } from '../lib/puckConfig';
import { useSitePage } from '../lib/useSitePage';
import { useCurrentUser } from '../lib/useCurrentUser';

export default function VisualEditor({ onBack, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();
  const { pageData, tableExists, savePage, resetPage } = useSitePage('landing');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

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
      await savePage('landing', 'Landing Page', newData);
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
    if (!window.confirm('Reset this page layout back to the original default blocks?')) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await resetPage('landing');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Reset failed:', err);
      setErrorMsg(err.message || 'Failed to reset page');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-950">
      {/* Top Bar for Visual Studio */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (onBack) onBack(); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Exit Editor
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Puck Visual Builder</span>
            <span className="text-xs text-slate-400">· MeadowBrook Landing Page</span>
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
            className="text-xs flex items-center gap-1 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="Revert back to default layout"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
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
      <div className="flex-1 overflow-hidden relative">
        <Puck
          config={puckConfig}
          data={pageData}
          onPublish={handlePublish}
        />
      </div>
    </div>
  );
}
