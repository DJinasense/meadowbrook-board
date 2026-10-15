import React, { useState, useEffect } from 'react';
import {
  Globe,
  Users,
  Check,
  RotateCcw,
  AlertTriangle,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Save,
  RefreshCw,
} from 'lucide-react';
import {
  useSiteCopy,
  SITE_COPY_SECTIONS,
  SITE_COPY_DEFAULTS,
} from '../lib/siteCopy';

export default function AdminSiteTextEditor({ theme }) {
  const {
    copyMap,
    tableExists,
    saveCopy,
    resetCopy,
    refresh,
  } = useSiteCopy();

  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [successKey, setSuccessKey] = useState(null);
  const [errorInfo, setErrorInfo] = useState({ key: null, message: null });
  const [showPreview, setShowPreview] = useState(true);
  const [previewTheme, setPreviewTheme] = useState(theme === 'dark' ? 'dark' : 'light');
  const [refreshingDb, setRefreshingDb] = useState(false);

  // Initialize and sync drafts when copyMap loads or changes
  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      Object.keys(SITE_COPY_DEFAULTS).forEach((k) => {
        // Only set if not already edited by user in this session
        if (next[k] === undefined) {
          next[k] = copyMap[k] !== undefined ? copyMap[k] : SITE_COPY_DEFAULTS[k];
        }
      });
      return next;
    });
  }, [copyMap]);

  function getDraft(key) {
    if (drafts[key] !== undefined) return drafts[key];
    if (copyMap[key] !== undefined) return copyMap[key];
    return SITE_COPY_DEFAULTS[key] || '';
  }

  function handleDraftChange(key, value) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    if (errorInfo.key === key) {
      setErrorInfo({ key: null, message: null });
    }
  }

  async function handleSave(key) {
    const value = getDraft(key).trim();
    if (value.length > 500) {
      setErrorInfo({ key, message: 'Keep each line under 500 characters' });
      return;
    }

    setBusyKey(key);
    setErrorInfo({ key: null, message: null });
    try {
      await saveCopy(key, value);
      setSuccessKey(key);
      setTimeout(() => {
        setSuccessKey((cur) => (cur === key ? null : cur));
      }, 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setErrorInfo({ key, message: err.message || 'Failed to save copy' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleReset(key) {
    const defaultVal = SITE_COPY_DEFAULTS[key] || '';
    setBusyKey(key);
    setErrorInfo({ key: null, message: null });
    try {
      if (copyMap[key] !== undefined) {
        await resetCopy(key);
      }
      setDrafts((prev) => ({ ...prev, [key]: defaultVal }));
      setSuccessKey(key);
      setTimeout(() => {
        setSuccessKey((cur) => (cur === key ? null : cur));
      }, 3000);
    } catch (err) {
      console.error('Reset failed:', err);
      setErrorInfo({ key, message: err.message || 'Failed to reset copy' });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRefreshDbCheck() {
    setRefreshingDb(true);
    await refresh();
    setRefreshingDb(false);
  }

  return (
    <div className="space-y-6">
      {/* Introduction / Instruction header */}
      <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Site Text Editor
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Customize headline lines, card copy, and public text on the landing page without code changes or redeploying.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Hide Preview' : 'Show Live Preview'}
            </button>
          </div>
        </div>

        {/* Database Migration Warning if table does not exist */}
        {!tableExists && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1">Database Setup Required</p>
                <p className="leading-relaxed">
                  The <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded font-mono text-[11px]">site_copy</code> table has not been created in Supabase yet.
                  To enable live editing and database saves, run <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded font-mono text-[11px]">supabase_site_copy.sql</code> in your{' '}
                  <a
                    href="https://supabase.com/dashboard/project/kjsnaibbhjxkaglfsowd/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100"
                  >
                    Supabase SQL Editor
                  </a>.
                </p>
                <p className="mt-2 text-amber-800 dark:text-amber-300">
                  While awaiting the SQL migration, the landing page is safely rendering all original built-in defaults.
                </p>
                <button
                  onClick={handleRefreshDbCheck}
                  disabled={refreshingDb}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingDb ? 'animate-spin' : ''}`} />
                  {refreshingDb ? 'Checking database...' : 'Re-check Supabase Table'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${showPreview ? 'lg:grid-cols-12' : ''} gap-6 items-start`}>
        {/* Editor Form Columns */}
        <div className={showPreview ? 'lg:col-span-7 space-y-6' : 'space-y-6'}>
          {SITE_COPY_SECTIONS.map((section) => (
            <div
              key={section.id}
              className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{section.title}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{section.description}</p>
              </div>

              <div className="space-y-4 pt-1">
                {section.items.map((item) => {
                  const draftVal = getDraft(item.key);
                  const savedVal = copyMap[item.key] !== undefined ? copyMap[item.key] : item.default;
                  const isModifiedFromSaved = draftVal !== savedVal;
                  const isCustomizedInDb = copyMap[item.key] !== undefined && copyMap[item.key] !== item.default;
                  const isOverLimit = draftVal.length > 500;
                  const isBusy = busyKey === item.key;
                  const isSuccess = successKey === item.key;
                  const itemError = errorInfo.key === item.key ? errorInfo.message : null;

                  return (
                    <div
                      key={item.key}
                      className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.label}
                          </label>
                          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {item.key}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isCustomizedInDb ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Custom
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Default
                            </span>
                          )}
                          {isModifiedFromSaved && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                              Unsaved
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Text Input */}
                      <div>
                        {draftVal.length > 80 ? (
                          <textarea
                            rows={3}
                            value={draftVal}
                            onChange={(e) => handleDraftChange(item.key, e.target.value)}
                            placeholder={item.default}
                            className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                          />
                        ) : (
                          <input
                            type="text"
                            value={draftVal}
                            onChange={(e) => handleDraftChange(item.key, e.target.value)}
                            placeholder={item.default}
                            className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </div>

                      {/* Default reference & character counter */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 gap-2">
                        <div className="flex-1 min-w-[180px] truncate" title={`Default: ${item.default}`}>
                          <span className="italic">Default:</span> "{item.default}"
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span className={isOverLimit ? 'text-rose-600 font-bold' : ''}>
                            {draftVal.length}
                          </span>
                          <span>/500</span>
                        </div>
                      </div>

                      {/* Error or Success notification */}
                      {itemError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                          {itemError}
                        </p>
                      )}
                      {isSuccess && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Saved successfully to live site!
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                        {(isCustomizedInDb || draftVal !== item.default) && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleReset(item.key)}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                            title="Revert back to the original hardcoded default"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Reset to default
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusy || !isModifiedFromSaved || isOverLimit || !draftVal.trim()}
                          onClick={() => handleSave(item.key)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            isModifiedFromSaved && !isOverLimit && draftVal.trim()
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isBusy ? 'Saving...' : 'Save line'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Live Landing Preview Panel */}
        {showPreview && (
          <div className="lg:col-span-5 sticky top-20">
            <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    Live Landing Preview
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewTheme(previewTheme === 'dark' ? 'light' : 'dark')}
                    title="Toggle preview theme"
                    className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs flex items-center gap-1"
                  >
                    {previewTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                    <span className="text-[11px] font-medium capitalize">{previewTheme}</span>
                  </button>
                </div>
              </div>

              {/* Preview Window Container */}
              <div
                className={`rounded-xl border overflow-hidden p-5 transition-colors ${
                  previewTheme === 'dark'
                    ? 'bg-slate-900 border-slate-800 text-slate-100'
                    : 'bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 border-slate-200 text-slate-800'
                }`}
              >
                {/* Simulated Landing Content */}
                <div className="text-center max-w-sm mx-auto">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl border mb-3 p-2 shadow-sm ${
                      previewTheme === 'dark'
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <img
                      src="/logo-icon.png"
                      alt="MeadowBrook"
                      className={`w-full h-full object-contain ${previewTheme === 'dark' ? 'hidden' : 'block'}`}
                    />
                    <img
                      src="/logo-icon-white.png"
                      alt="MeadowBrook"
                      className={`w-full h-full object-contain ${previewTheme === 'dark' ? 'block' : 'hidden'}`}
                    />
                  </div>

                  <h3
                    className={`text-lg font-bold mb-1.5 ${
                      previewTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'
                    }`}
                  >
                    MeadowBrook · Building 7
                  </h3>

                  {/* Hero lines */}
                  <div
                    className={`text-xs mb-5 italic leading-relaxed ${
                      previewTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                    style={{ fontFamily: "'Lora', Georgia, serif" }}
                  >
                    <span className="block">{getDraft('landing.hero.1')}</span>
                    <span className="block">{getDraft('landing.hero.2')}</span>
                    <span className="block font-semibold">{getDraft('landing.hero.3')}</span>
                  </div>

                  {/* Simulated Cards */}
                  <div className="space-y-3 text-left">
                    {/* General Board card */}
                    <div
                      className={`border rounded-xl p-3.5 shadow-xs ${
                        previewTheme === 'dark'
                          ? 'bg-slate-800/90 border-slate-700'
                          : 'bg-white/90 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4
                          className={`text-xs font-bold ${
                            previewTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'
                          }`}
                        >
                          General Board
                        </h4>
                      </div>
                      <p
                        className={`text-[11px] leading-relaxed mb-3 text-center ${
                          previewTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        <span className="block">{getDraft('landing.general.1')}</span>
                        <span className="block">{getDraft('landing.general.2')}</span>
                        <span className="block">{getDraft('landing.general.3')}</span>
                        <span className="block">{getDraft('landing.general.4')}</span>
                      </p>
                      <div className="w-full bg-blue-700 text-white text-center py-1.5 rounded-lg text-[11px] font-semibold">
                        Enter the General Board
                      </div>
                    </div>

                    {/* Members Board card */}
                    <div
                      className={`border rounded-xl p-3.5 shadow-xs ${
                        previewTheme === 'dark'
                          ? 'bg-slate-800/90 border-emerald-800/60'
                          : 'bg-white/90 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4
                          className={`text-xs font-bold ${
                            previewTheme === 'dark' ? 'text-slate-100' : 'text-slate-800'
                          }`}
                        >
                          Members Board
                        </h4>
                      </div>
                      <p
                        className={`text-[11px] leading-relaxed mb-2.5 ${
                          previewTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {getDraft('landing.members.intro')}
                      </p>
                      <p
                        className={`text-[11px] font-semibold rounded-lg px-2.5 py-1.5 border mb-3 ${
                          previewTheme === 'dark'
                            ? 'text-emerald-300 bg-emerald-900/30 border-emerald-800/60'
                            : 'text-emerald-800 bg-emerald-50 border-emerald-100'
                        }`}
                      >
                        {getDraft('landing.members.posting')}
                      </p>
                      <div className="w-full bg-emerald-600 text-white text-center py-1.5 rounded-lg text-[11px] font-semibold">
                        Enter the Members Board
                      </div>
                    </div>
                  </div>

                  {/* Footer line */}
                  <p
                    className={`text-[10px] mt-4 ${
                      previewTheme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {getDraft('landing.footer')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
