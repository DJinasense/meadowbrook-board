import React, { useEffect, useState } from 'react';
import { Shield, Flag, KeyRound, Users, MessageSquare, ArrowLeft, Search, CheckCircle, XCircle, Clock, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchDirectory } from '../lib/directory';
import { useCurrentUser } from '../lib/useCurrentUser';

export default function AdminDashboard({ onBack, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();

  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [inviteCodes, setInviteCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codeSearch, setCodeSearch] = useState('');

  const [residentCount, setResidentCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);

  function authorLabel(row, directory) {
    if (!row) return 'Unknown';
    if (row.is_anonymous) return row.user_id ? 'Anonymous' : (row.guest_name || 'Anonymous');
    if (row.user_id && directory[row.user_id]) return directory[row.user_id].username;
    return row.guest_name || 'Anonymous';
  }

  async function loadReports() {
    setLoadingReports(true);

    const { data: reportRows, error } = await supabase
      .from('reports')
      .select('id, thread_id, reply_id, reason, reported_by, status, created_at')
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setLoadingReports(false); return; }

    const threadIds = [...new Set(reportRows.filter((r) => r.thread_id).map((r) => r.thread_id))];
    const replyIds = [...new Set(reportRows.filter((r) => r.reply_id).map((r) => r.reply_id))];

    const [{ data: threadRows }, { data: replyRows }] = await Promise.all([
      threadIds.length
        ? supabase.from('threads').select('id, title, content, user_id, guest_name, is_anonymous').in('id', threadIds)
        : Promise.resolve({ data: [] }),
      replyIds.length
        ? supabase.from('replies').select('id, content, user_id, guest_name, is_anonymous').in('id', replyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const threadMap = {};
    (threadRows || []).forEach((t) => { threadMap[t.id] = t; });
    const replyMap = {};
    (replyRows || []).forEach((r) => { replyMap[r.id] = r; });

    const authorIds = new Set();
    Object.values(threadMap).forEach((t) => { if (t.user_id && !t.is_anonymous) authorIds.add(t.user_id); });
    Object.values(replyMap).forEach((r) => { if (r.user_id && !r.is_anonymous) authorIds.add(r.user_id); });
    const reporterIds = new Set(reportRows.filter((r) => r.reported_by).map((r) => r.reported_by));
    const directory = await fetchDirectory([...new Set([...authorIds, ...reporterIds])]);

    setReports(reportRows.map((r) => {
      const content = r.thread_id ? threadMap[r.thread_id] : replyMap[r.reply_id];
      return {
        id: r.id,
        type: r.thread_id ? 'thread' : 'reply',
        threadId: r.thread_id,
        replyId: r.reply_id,
        excerpt: content ? (r.thread_id ? content.title : content.content) : '(content no longer available)',
        reason: r.reason || 'No reason given',
        reportedBy: r.reported_by ? (directory[r.reported_by]?.username || 'Unknown') : 'Anonymous',
        contentAuthor: authorLabel(content, directory),
        createdAt: new Date(r.created_at),
        status: r.status,
      };
    }));
    setLoadingReports(false);
  }

  async function loadInviteCodes() {
    setLoadingCodes(true);
    const { data } = await supabase
      .from('invite_codes')
      .select('code, apartment, max_uses, use_count')
      .order('apartment');
    setInviteCodes(data || []);
    setLoadingCodes(false);
  }

  async function loadStats() {
    const [{ count: residents }, { count: threads }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('threads').select('id', { count: 'exact', head: true }),
    ]);
    setResidentCount(residents || 0);
    setThreadCount(threads || 0);
  }

  useEffect(() => {
    if (!currentUser?.is_admin) return;
    loadReports();
    loadInviteCodes();
    loadStats();
  }, [currentUser]);

  async function handleApprove(report) {
    const table = report.type === 'thread' ? 'threads' : 'replies';
    const contentId = report.type === 'thread' ? report.threadId : report.replyId;

    await supabase.from(table).update({ status: 'removed' }).eq('id', contentId);
    await supabase.from('reports').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', report.id);

    loadReports();
    loadStats();
  }

  async function handleDismiss(report) {
    await supabase.from('reports').update({ status: 'dismissed', reviewed_at: new Date().toISOString() }).eq('id', report.id);
    loadReports();
  }

  const pending = reports.filter((r) => r.status === 'pending');
  const resolved = reports.filter((r) => r.status !== 'pending');

  const filteredCodes = inviteCodes.filter((c) =>
    c.apartment.toLowerCase().includes(codeSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(codeSearch.toLowerCase())
  );

  const codesRedeemed = inviteCodes.filter((c) => c.use_count > 0).length;

  const statCard = (label, value, icon, tint) => (
    <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tint}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
      </div>
    </div>
  );

  const ThemeToggle = () => onToggleTheme && (
    <button
      onClick={onToggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );

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
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-4">You don't have access to this page.</p>
          <button onClick={() => onBack && onBack()} className="text-blue-700 dark:text-blue-400 font-medium text-sm hover:text-blue-800 dark:hover:text-blue-300">
            ← Back to board
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-emerald-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-blue-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-slate-800 dark:bg-slate-700 rounded-lg flex items-center justify-center relative">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Admin Dashboard</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">MeadowBrook · Building 7</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => onBack && onBack()} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <ArrowLeft className="w-4 h-4" /> Back to Board
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {statCard('Pending Reports', pending.length, <Flag className="w-5 h-5 text-rose-600" />, 'bg-rose-50 dark:bg-rose-900/30')}
          {statCard('Codes Redeemed', `${codesRedeemed} / ${inviteCodes.length}`, <KeyRound className="w-5 h-5 text-emerald-600" />, 'bg-emerald-50 dark:bg-emerald-900/30')}
          {statCard('Verified Residents', residentCount, <Users className="w-5 h-5 text-blue-600" />, 'bg-blue-50 dark:bg-blue-900/30')}
          {statCard('Total Threads', threadCount, <MessageSquare className="w-5 h-5 text-purple-600" />, 'bg-purple-50 dark:bg-purple-900/30')}
        </div>

        <div className="flex gap-2 mb-5 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'reports' ? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Report Queue {pending.length > 0 && <span className="ml-1.5 bg-rose-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pending.length}</span>}
          </button>
          <button
            onClick={() => setTab('codes')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'codes' ? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            Invite Codes
          </button>
        </div>

        {tab === 'reports' && (
          <div className="space-y-6">
            {loadingReports ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Loading reports...</p>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Pending Review</h3>
                  {pending.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">Nothing waiting on you. Nice.</p>
                  ) : (
                    <div className="space-y-3">
                      {pending.map((r) => (
                        <div key={r.id} className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                          <div className="flex items-start justify-between mb-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.type === 'thread' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                              {r.type === 'thread' ? 'Thread' : 'Reply'}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {r.createdAt.toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-200 mb-2">"{r.excerpt}"</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Reason: <span className="text-slate-600 dark:text-slate-300">{r.reason}</span></p>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Reported by <span className="text-slate-600 dark:text-slate-300">{r.reportedBy}</span> · Posted by <span className="text-slate-600 dark:text-slate-300">{r.contentAuthor}</span></p>
                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(r)} className="flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-rose-700">
                              <CheckCircle className="w-3.5 h-3.5" /> Approve Takedown
                            </button>
                            <button onClick={() => handleDismiss(r)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-600">
                              <XCircle className="w-3.5 h-3.5" /> Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {resolved.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Resolved</h3>
                    <div className="space-y-2">
                      {resolved.map((r) => (
                        <div key={r.id} className="bg-white/60 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate flex-1">"{r.excerpt}"</p>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ml-3 whitespace-nowrap ${r.status === 'approved' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                            {r.status === 'approved' ? 'Removed' : 'Dismissed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'codes' && (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="Search by unit or code..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {loadingCodes ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Loading invite codes...</p>
            ) : (
              <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Unit</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Code</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Usage</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCodes.map((c) => (
                      <tr key={c.code} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{c.apartment}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{c.code}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.use_count} / {c.max_uses}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.use_count === 0 ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : c.use_count >= c.max_uses ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                            {c.use_count === 0 ? 'Unused' : c.use_count >= c.max_uses ? 'Fully Redeemed' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
