import React, { useEffect, useState } from 'react';
import { Shield, Flag, Users, MessageSquare, ArrowLeft, CheckCircle, XCircle, Clock, Sun, Moon, Search, EyeOff, Eye } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { FLAGS, FlagIcon } from './PostFlag';
import { fetchDirectory } from '../lib/directory';
import { useCurrentUser } from '../lib/useCurrentUser';

export default function AdminDashboard({ onBack, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [residentCount, setResidentCount] = useState(0);
  const [threadCount, setThreadCount] = useState(0);

  const [tab, setTab] = useState('reports'); // 'reports' | 'notices' | 'members' | 'posts' | 'feedback'

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberError, setMemberError] = useState(null);
  const [busyMemberId, setBusyMemberId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postFilter, setPostFilter] = useState('all'); // 'all' | 'visible' | 'removed'
  const [actionError, setActionError] = useState(null);

  // Labeled posts (urgent / building work / heads up): review, then email the neighbors who opted in
  const [subscriberCount, setSubscriberCount] = useState(null);
  const [confirmSendId, setConfirmSendId] = useState(null);
  const [busyUrgentId, setBusyUrgentId] = useState(null);
  const [urgentError, setUrgentError] = useState(null);
  const [urgentNotice, setUrgentNotice] = useState(null);

  // Feedback left by members who suspended their account
  const [feedback, setFeedback] = useState([]);

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

  async function loadStats() {
    const [{ count: residents }, { count: threads }] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('threads').select('id', { count: 'exact', head: true }),
    ]);
    setResidentCount(residents || 0);
    setThreadCount(threads || 0);
  }

  async function loadMembers() {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, apartment, is_admin, is_muted, is_suspended, notify_announcements, created_at')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setMembers(data || []);
    setLoadingMembers(false);
  }

  async function runMemberAction(member, fn, args) {
    setMemberError(null);
    setBusyMemberId(member.id);
    const { error } = await supabase.rpc(fn, args);
    setBusyMemberId(null);
    setPendingDeleteId(null);
    if (error) { setMemberError(`${member.username}: ${error.message}`); return; }
    loadMembers();
    loadStats();
  }

  async function loadPosts() {
    setLoadingPosts(true);
    const { data: threadRows, error } = await supabase
      .from('threads')
      .select('id, title, content, category, user_id, guest_name, is_anonymous, alert_type, announced_at, status, created_at')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); setLoadingPosts(false); return; }

    const threadIds = threadRows.map((t) => t.id);
    const authorIds = [...new Set(threadRows.filter((t) => t.user_id && !t.is_anonymous).map((t) => t.user_id))];
    const [{ data: replyRows }, directory] = await Promise.all([
      threadIds.length
        ? supabase.from('replies').select('thread_id').in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
      fetchDirectory(authorIds),
    ]);

    const replyCounts = {};
    (replyRows || []).forEach((r) => { replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1; });

    setPosts(threadRows.map((t) => ({
      ...t,
      authorLabel: authorLabel(t, directory),
      replyCount: replyCounts[t.id] || 0,
    })));
    setLoadingPosts(false);
  }

  async function setPostStatus(post, status) {
    setActionError(null);
    const { error } = await supabase.from('threads').update({ status }).eq('id', post.id);
    if (error) { setActionError(error.message); return; }
    loadPosts();
    loadStats();
  }

  async function loadSubscriberCount() {
    const { data, error } = await supabase.rpc('admin_announcement_recipients');
    setSubscriberCount(error ? null : (data || []).length);
  }

  async function loadFeedback() {
    const { data, error } = await supabase
      .from('account_feedback')
      .select('id, username, message, created_at')
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setFeedback(data || []);
  }

  async function dismissUrgent(post) {
    setUrgentError(null);
    setBusyUrgentId(post.id);
    const { error } = await supabase.rpc('admin_dismiss_flag', { p_thread: post.id });
    setBusyUrgentId(null);
    if (error) { setUrgentError(error.message); return; }
    loadPosts();
  }

  // The email is sent by a Vercel function (api/send-announcement.js) so the
  // Resend key and members' addresses never reach the browser.
  async function sendAnnouncement(post) {
    setUrgentError(null);
    setUrgentNotice(null);
    setBusyUrgentId(post.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ threadId: post.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Could not send (error ${res.status})`);
      setUrgentNotice(body.sent === 0 ? (body.note || 'Nothing was sent.') : `"${post.title}" was emailed to ${body.sent} ${body.sent === 1 ? 'neighbor' : 'neighbors'}.`);
    } catch (err) {
      setUrgentError(err.message);
    }
    setBusyUrgentId(null);
    setConfirmSendId(null);
    loadPosts();
    loadSubscriberCount();
  }

  useEffect(() => {
    if (!currentUser?.is_admin) return;
    loadSubscriberCount();
    loadFeedback();
    loadReports();
    loadStats();
    loadMembers();
    loadPosts();
  }, [currentUser]);

  async function handleApprove(report) {
    const table = report.type === 'thread' ? 'threads' : 'replies';
    const contentId = report.type === 'thread' ? report.threadId : report.replyId;

    await supabase.from(table).update({ status: 'removed' }).eq('id', contentId);
    await supabase.from('reports').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', report.id);

    loadReports();
    loadStats();
    loadPosts();
  }

  async function handleDismiss(report) {
    await supabase.from('reports').update({ status: 'dismissed', reviewed_at: new Date().toISOString() }).eq('id', report.id);
    loadReports();
  }

  const pending = reports.filter((r) => r.status === 'pending');
  const resolved = reports.filter((r) => r.status !== 'pending');

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return true;
    return [m.username, m.email, m.apartment].some((v) => v && v.toLowerCase().includes(q));
  });

  const filteredPosts = posts.filter((p) =>
    postFilter === 'all' ? true : postFilter === 'removed' ? p.status === 'removed' : p.status !== 'removed'
  );

  const urgentToReview = posts.filter((p) => p.alert_type && !p.announced_at && p.status === 'visible');
  const urgentSent = posts.filter((p) => p.announced_at);
  const memberName = (id) => members.find((m) => m.id === id)?.username;

  const tabButton = (id, label, badge) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        tab === id
          ? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400'
          : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
    >
      {label}
      {badge > 0 && <span className="bg-rose-600 text-white text-xs px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
  );

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
          <button onClick={() => { if (onBack) onBack(); }} className="text-blue-700 dark:text-blue-400 font-medium text-sm hover:text-blue-800 dark:hover:text-blue-300">
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
            {ThemeToggle()}
            <button onClick={() => { if (onBack) onBack(); }} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              <ArrowLeft className="w-4 h-4" /> Back to Board
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {statCard('Pending Reports', pending.length, <Flag className="w-5 h-5 text-rose-600" />, 'bg-rose-50 dark:bg-rose-900/30')}
          {statCard('Members', residentCount, <Users className="w-5 h-5 text-blue-600" />, 'bg-blue-50 dark:bg-blue-900/30')}
          {statCard('Total Threads', threadCount, <MessageSquare className="w-5 h-5 text-purple-600" />, 'bg-purple-50 dark:bg-purple-900/30')}
        </div>

        <div className="flex items-center gap-1 mb-5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabButton('reports', 'Reports', pending.length)}
          {tabButton('notices', 'Notices', urgentToReview.length)}
          {tabButton('members', `Members (${members.length})`, 0)}
          {tabButton('posts', `Posts (${posts.length})`, 0)}
          {tabButton('feedback', `Feedback (${feedback.length})`, 0)}
        </div>

        {tab === 'notices' && (
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Members can label a post Urgent, Building work, or Heads up. Check that each one is real, then email it to the{' '}
              <strong className="text-slate-700 dark:text-slate-200">{subscriberCount ?? '…'}</strong>{' '}
              {subscriberCount === 1 ? 'neighbor' : 'neighbors'} who chose "Notify me with important announcements."
            </p>
            {urgentNotice && <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">{urgentNotice}</p>}
            {urgentError && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{urgentError}</p>}
            {loadingPosts ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Loading...</p>
            ) : urgentToReview.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">Nothing waiting for review.</p>
            ) : (
              <div className="space-y-3">
                {urgentToReview.map((p) => (
                  <div key={p.id} className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-red-200 dark:border-red-900/60 p-4">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <FlagIcon type={p.alert_type} /> {p.title}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500">· {FLAGS[p.alert_type]?.label}</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line mt-1.5 line-clamp-6">{p.content}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      Posted by {p.user_id ? (memberName(p.user_id) || 'a member') : (p.guest_name || 'a guest')}
                      {p.is_anonymous && p.user_id ? ' (shown as Anonymous)' : ''} · {new Date(p.created_at).toLocaleString()}
                    </p>
                    {confirmSendId === p.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          Email this to {subscriberCount ?? 'everyone who opted in'} {subscriberCount === 1 ? 'neighbor' : 'neighbors'}? This can't be undone.
                        </span>
                        <button disabled={busyUrgentId === p.id} onClick={() => sendAnnouncement(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                          {busyUrgentId === p.id ? 'Sending...' : 'Send now'}
                        </button>
                        <button disabled={busyUrgentId === p.id} onClick={() => setConfirmSendId(null)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button disabled={busyUrgentId === p.id || subscriberCount === 0} onClick={() => { setUrgentNotice(null); setConfirmSendId(p.id); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                          Email to subscribers
                        </button>
                        <button disabled={busyUrgentId === p.id} onClick={() => dismissUrgent(p)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                          Remove label
                        </button>
                        <button disabled={busyUrgentId === p.id} onClick={() => setPostStatus(p, 'removed')} className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700">
                          <EyeOff className="w-3.5 h-3.5" /> Remove post
                        </button>
                        {subscriberCount === 0 && <span className="text-xs text-slate-400 dark:text-slate-500">No one has opted in yet.</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {urgentSent.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Already emailed</p>
                <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                  {urgentSent.map((p) => (
                    <p key={p.id} className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {p.title} <span className="text-slate-400 dark:text-slate-500">· {FLAGS[p.alert_type]?.label || 'Notice'} · sent {new Date(p.announced_at).toLocaleString()}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'feedback' && (
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">What members wrote when they suspended their account.</p>
            {feedback.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">No feedback yet.</p>
            ) : (
              <div className="space-y-3">
                {feedback.map((f) => (
                  <div key={f.id} className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{f.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{f.username || 'Former member'} · {new Date(f.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name, email, or apartment..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {memberError && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{memberError}</p>}
            {loadingMembers ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Loading members...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
                {members.length === 0 ? 'No one has signed up yet.' : 'No members match that search.'}
              </p>
            ) : (
              <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {filteredMembers.map((m) => (
                  <div key={m.id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                          {m.username}
                          {m.id === currentUser.id && <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(you)</span>}
                          {m.is_admin && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-white dark:bg-slate-600">Admin</span>}
                          {m.is_muted && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Muted</span>}
                          {m.is_suspended && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200">Suspended</span>}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-600 dark:text-slate-300">{m.apartment || 'No apartment'}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Joined {new Date(m.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {m.id !== currentUser.id && (
                      pendingDeleteId === m.id ? (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-rose-600 dark:text-rose-400">Delete {m.username}'s account? This can't be undone. Their posts stay up as "Anonymous".</span>
                          <button disabled={busyMemberId === m.id} onClick={() => runMemberAction(m, 'admin_delete_member', { target: m.id })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
                            Yes, delete
                          </button>
                          <button onClick={() => setPendingDeleteId(null)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          <button disabled={busyMemberId === m.id} onClick={() => runMemberAction(m, 'admin_set_muted', { target: m.id, muted: !m.is_muted })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                            {m.is_muted ? 'Unmute' : 'Mute'}
                          </button>
                          <button disabled={busyMemberId === m.id} onClick={() => runMemberAction(m, 'admin_set_admin', { target: m.id, make_admin: !m.is_admin })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                            {m.is_admin ? 'Remove admin' : 'Make admin'}
                          </button>
                          <button disabled={busyMemberId === m.id} onClick={() => setPendingDeleteId(m.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50">
                            Delete
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'posts' && (
          <div>
            <div className="flex gap-2 mb-4">
              {[['all', 'All'], ['visible', 'Live'], ['removed', 'Removed']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPostFilter(id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    postFilter === id ? 'bg-blue-700 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {actionError && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{actionError}</p>}
            {loadingPosts ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Loading posts...</p>
            ) : filteredPosts.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">No posts here.</p>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((p) => (
                  <div key={p.id} className={`bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${p.status === 'removed' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{p.content}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                          {p.authorLabel} · {new Date(p.created_at).toLocaleDateString()} · {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === 'removed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                          {p.status === 'removed' ? 'Removed' : 'Live'}
                        </span>
                        {p.status === 'removed' ? (
                          <button onClick={() => setPostStatus(p, 'visible')} className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white">
                            <Eye className="w-3.5 h-3.5" /> Restore
                          </button>
                        ) : (
                          <button onClick={() => setPostStatus(p, 'removed')} className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700">
                            <EyeOff className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
      </div>
    </div>
  );
}
