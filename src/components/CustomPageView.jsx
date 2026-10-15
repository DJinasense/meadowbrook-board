import React from 'react';
import { Render } from '@puckeditor/core';
import { ArrowLeft, Sparkles, Sun, Moon } from 'lucide-react';
import { puckConfig } from '../lib/puckConfig';
import { useSitePage } from '../lib/useSitePage';
import { useCurrentUser } from '../lib/useCurrentUser';
import { navigate, goBack } from '../lib/router';

export default function CustomPageView({ pageId = 'rules', theme, onToggleTheme }) {
  const { currentUser } = useCurrentUser();
  const { pageData, loading } = useSitePage(pageId);

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => goBack('board')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Board
          </button>

          <div className="flex items-center gap-2">
            {currentUser?.is_admin && (
              <button
                onClick={() => navigate('editor')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold text-xs hover:bg-blue-100 transition-colors cursor-pointer"
                title="Edit this page visually with Puck"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Edit Page
              </button>
            )}

            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400 dark:text-slate-500">
            Loading document...
          </div>
        ) : (
          <Render config={puckConfig} data={pageData} />
        )}
      </main>
    </div>
  );
}
