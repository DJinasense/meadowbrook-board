import React, { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Plus, ArrowLeft, Send, ThumbsUp, Filter, Leaf, Lock, Flag, Search, X, UserPlus, Shield, LogIn, ChevronDown, Settings, LogOut, Sun, Moon, Mail, Pencil, Paperclip, Heart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchDirectory } from '../lib/directory';
import { useCurrentUser } from '../lib/useCurrentUser';
import { validateFiles, uploadAttachments, fetchAttachments } from '../lib/attachments';
import { useRoute, useBackToClose, navigate, replaceRoute, goBack } from '../lib/router';
import { FilePicker, AttachmentList, AttachmentThumbs } from './Attachments';
import Lightbox from './Lightbox';

// Defined at module scope on purpose: a component declared inside MainBoard
// gets a new identity every render, which remounts every input it wraps and
// drops focus after each keystroke.
function PageBG({ children }) {
  return (
    <div className="min-h-screen relative bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-200">
      {children}
    </div>
  );
}

// PayPal hosted donate button (donation page set up in the owner's PayPal account).
const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=62QBNJL452VKE';

const MUTED_NOTICE = 'An admin has paused posting on your account. You can still read the board.';

export default function MainBoard({ onRequestSignup, onRequestLogin, onOpenAdmin, onOpenMessages, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading, refresh: refreshCurrentUser } = useCurrentUser(); // null = anonymous visitor, else { id, username, apartment, is_admin, show_apartment, notify_on_reply, notify_daily_digest }
  // The current screen comes from the URL/history rather than local state, so
  // the browser's Back button walks back through the board instead of leaving
  // the site. See src/lib/router.js.
  const route = useRoute();
  const currentView = route.view; // 'landing' | 'board' | 'thread' | 'create'
  const selectedThreadId = route.view === 'thread' ? route.id : null;
  const [initialRouteDecided, setInitialRouteDecided] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [openReplies, setOpenReplies] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [toast, setToast] = useState(null);

  const [threads, setThreads] = useState([]);

  const [guestName, setGuestName] = useState('');
  const [newThread, setNewThread] = useState({ title: '', content: '', category: 'general', isAnonymous: false });
  const [newReply, setNewReply] = useState({ content: '', isAnonymous: false });
  const [threadFormError, setThreadFormError] = useState(null);
  const [replyFormError, setReplyFormError] = useState(null);
  const [submittingThread, setSubmittingThread] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  const [reportTarget, setReportTarget] = useState(null); // { threadId } | { replyId }
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState(null); // { type: 'thread' } | { type: 'reply', reply }

  const [newThreadFiles, setNewThreadFiles] = useState([]);
  const [newReplyFiles, setNewReplyFiles] = useState([]);
  const [attachments, setAttachments] = useState({ byThread: {}, byReply: {} });
  const [editingThread, setEditingThread] = useState(null); // { title, content } while editing the open thread
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editReplyText, setEditReplyText] = useState('');
  const [editError, setEditError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lightbox, setLightbox] = useState(null); // { files, index } while an attachment is open full size

  useEffect(() => {
    if (!currentUser) { setUnreadCount(0); return; }
    supabase.from('direct_messages').select('id', { count: 'exact', head: true })
      .eq('recipient_id', currentUser.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [currentUser]);

  const categories = [
    { id: 'all', name: 'All Posts', color: 'bg-slate-500' },
    { id: 'general', name: 'General', color: 'bg-blue-600' },
    { id: 'building', name: 'Building Matters', color: 'bg-amber-600' },
    { id: 'complaints', name: 'Complaints & Concerns', color: 'bg-rose-600' },
    { id: 'board', name: 'Board & Management', color: 'bg-purple-600' }
  ];


  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  // A returning signed-in resident with a live session should land straight on
  // the board, not the guest landing screen. Only applies once, right after
  // the initial session check resolves — it must not override navigation the
  // user does later in the session (e.g. clicking the logo to go back), and it
  // must not hijack a shared link that already points at a specific thread.
  // replaceRoute, not navigate: Back shouldn't return to a screen never shown.
  useEffect(() => {
    if (!authLoading && !initialRouteDecided) {
      if (currentUser && route.view === 'landing') replaceRoute('board');
      setInitialRouteDecided(true);
    }
  }, [authLoading, currentUser, initialRouteDecided, route.view]);

  // ---------- data loading ----------

  function authorLabel(row, directory) {
    if (row.is_anonymous) {
      return row.user_id ? 'Anonymous' : (row.guest_name || 'Anonymous');
    }
    if (row.user_id && directory[row.user_id]) return directory[row.user_id].username;
    return row.guest_name || 'Anonymous';
  }

  const loadBoard = useCallback(async () => {
    setLoadingBoard(true);

    const { data: threadRows, error } = await supabase
      .from('threads')
      .select('id, user_id, guest_name, title, content, category, is_anonymous, created_at')
      .eq('status', 'visible')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setLoadingBoard(false);
      return;
    }

    const threadIds = threadRows.map((t) => t.id);

    const [{ data: replyRows }, { data: likeRows }] = await Promise.all([
      threadIds.length
        ? supabase.from('replies').select('id, thread_id').eq('status', 'visible').in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
      threadIds.length
        ? supabase.from('likes').select('thread_id').is('reply_id', null).in('thread_id', threadIds)
        : Promise.resolve({ data: [] }),
    ]);

    const replyCounts = {};
    (replyRows || []).forEach((r) => { replyCounts[r.thread_id] = (replyCounts[r.thread_id] || 0) + 1; });

    const likeCounts = {};
    (likeRows || []).forEach((l) => { likeCounts[l.thread_id] = (likeCounts[l.thread_id] || 0) + 1; });

    const authorIds = [...new Set(threadRows.filter((t) => t.user_id && !t.is_anonymous).map((t) => t.user_id))];
    const [directory, { byThread }] = await Promise.all([fetchDirectory(authorIds), fetchAttachments({ threadIds })]);

    let likedThreadIds = new Set();
    if (currentUser) {
      const { data: myLikes } = await supabase
        .from('likes')
        .select('thread_id')
        .eq('user_id', currentUser.id)
        .is('reply_id', null);
      likedThreadIds = new Set((myLikes || []).map((l) => l.thread_id));
    }

    setThreads(threadRows.map((t) => ({
      ...t,
      replyCount: replyCounts[t.id] || 0,
      likeCount: likeCounts[t.id] || 0,
      likedByMe: likedThreadIds.has(t.id),
      authorLabel: authorLabel(t, directory),
      attachments: byThread[t.id] || [],
    })));
    setLoadingBoard(false);
  }, [currentUser]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  async function loadThreadDetail(threadId) {
    const { data: replyRows, error } = await supabase
      .from('replies')
      .select('id, thread_id, user_id, guest_name, content, is_anonymous, created_at')
      .eq('thread_id', threadId)
      .eq('status', 'visible')
      .order('created_at', { ascending: true });

    if (error) { console.error(error); return; }

    const replyIds = replyRows.map((r) => r.id);

    const { data: likeRows } = replyIds.length
      ? await supabase.from('likes').select('reply_id').in('reply_id', replyIds)
      : { data: [] };

    const likeCounts = {};
    (likeRows || []).forEach((l) => { likeCounts[l.reply_id] = (likeCounts[l.reply_id] || 0) + 1; });

    const authorIds = [...new Set(replyRows.filter((r) => r.user_id && !r.is_anonymous).map((r) => r.user_id))];
    const directory = await fetchDirectory(authorIds);

    let likedReplyIds = new Set();
    if (currentUser && replyIds.length) {
      const { data: myLikes } = await supabase
        .from('likes')
        .select('reply_id')
        .eq('user_id', currentUser.id)
        .in('reply_id', replyIds);
      likedReplyIds = new Set((myLikes || []).map((l) => l.reply_id));
    }

    setAttachments(await fetchAttachments({ threadIds: [threadId], replyIds }));

    setOpenReplies(replyRows.map((r) => ({
      ...r,
      likeCount: likeCounts[r.id] || 0,
      likedByMe: likedReplyIds.has(r.id),
      authorLabel: authorLabel(r, directory),
    })));
  }

  const openThread = threads.find((t) => t.id === selectedThreadId) || null;

  function resetEditing() {
    setEditingThread(null);
    setEditingReplyId(null);
    setEditError(null);
  }

  // Replies load off the route rather than off the click, so opening a thread,
  // returning to it with the Back button, and following a shared /thread/<id>
  // link all end up in the same place.
  useEffect(() => {
    resetEditing();
    setNewReplyFiles([]);
    setReplyFormError(null);
    setAttachments({ byThread: {}, byReply: {} });
    if (!selectedThreadId) { setOpenReplies([]); return; }
    setOpenReplies([]);
    loadThreadDetail(selectedThreadId);
    // loadThreadDetail is redeclared every render; listing it here would make
    // this effect re-run forever. The two values it actually depends on are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, currentUser?.id]);

  function goToThread(thread) {
    navigate('thread', thread.id);
  }

  function backToBoard() {
    goBack('board');
  }

  // ---------- mutations ----------

  async function handleCreateThread() {
    if (currentUser?.is_muted) { setThreadFormError(MUTED_NOTICE); return; }
    if (!newThread.title || !newThread.content) {
      setThreadFormError('Please fill in a title and message');
      return;
    }
    const fileProblem = currentUser ? validateFiles(newThreadFiles) : null;
    if (fileProblem) { setThreadFormError(fileProblem); return; }
    setSubmittingThread(true);
    setThreadFormError(null);

    const payload = currentUser
      ? {
          user_id: currentUser.id,
          title: newThread.title,
          content: newThread.content,
          category: newThread.category,
          is_anonymous: newThread.isAnonymous,
        }
      : {
          user_id: null,
          guest_name: guestName.trim() || 'Anonymous',
          title: newThread.title,
          content: newThread.content,
          category: newThread.category,
          is_anonymous: true,
        };

    const { data: created, error } = await supabase.from('threads').insert(payload).select('id').single();

    if (error) { setSubmittingThread(false); setThreadFormError(error.message); return; }

    if (currentUser && newThreadFiles.length) {
      const failed = await uploadAttachments(newThreadFiles, currentUser.id, { threadId: created.id });
      if (failed.length) showToast(`Posted, but these files didn't upload: ${failed.join(', ')}`);
    }
    setSubmittingThread(false);

    setNewThreadFiles([]);
    setNewThread({ title: '', content: '', category: 'general', isAnonymous: false });
    goBack('board');
    loadBoard();
  }

  async function handleReply() {
    if (!currentUser) { setShowSignupPrompt(true); return; }
    if (currentUser.is_muted) { setReplyFormError(MUTED_NOTICE); return; }
    if (!newReply.content) { setReplyFormError('Please enter a reply'); return; }
    const fileProblem = validateFiles(newReplyFiles);
    if (fileProblem) { setReplyFormError(fileProblem); return; }
    setSubmittingReply(true);
    setReplyFormError(null);

    const payload = {
      thread_id: selectedThreadId,
      user_id: currentUser.id,
      content: newReply.content,
      is_anonymous: newReply.isAnonymous,
    };

    const { data: created, error } = await supabase.from('replies').insert(payload).select('id').single();

    if (error) { setSubmittingReply(false); setReplyFormError(error.message); return; }

    if (newReplyFiles.length) {
      const failed = await uploadAttachments(newReplyFiles, currentUser.id, { replyId: created.id });
      if (failed.length) showToast(`Replied, but these files didn't upload: ${failed.join(', ')}`);
    }
    setSubmittingReply(false);

    setNewReplyFiles([]);
    setNewReply({ content: '', isAnonymous: false });
    await loadThreadDetail(selectedThreadId);
    loadBoard();
  }

  async function toggleThreadLike(threadId) {
    if (!currentUser) { setShowSignupPrompt(true); return; }

    const { data: existing } = await supabase
      .from('likes').select('id').eq('user_id', currentUser.id).eq('thread_id', threadId).is('reply_id', null).maybeSingle();

    if (existing) await supabase.from('likes').delete().eq('id', existing.id);
    else await supabase.from('likes').insert({ user_id: currentUser.id, thread_id: threadId });

    loadBoard();
  }

  async function toggleReplyLike(replyId) {
    if (!currentUser) { setShowSignupPrompt(true); return; }

    const { data: existing } = await supabase
      .from('likes').select('id').eq('user_id', currentUser.id).eq('reply_id', replyId).maybeSingle();

    if (existing) await supabase.from('likes').delete().eq('id', existing.id);
    else await supabase.from('likes').insert({ user_id: currentUser.id, reply_id: replyId });

    loadThreadDetail(selectedThreadId);
  }

  async function submitReport() {
    setReportSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      thread_id: reportTarget.threadId ?? null,
      reply_id: reportTarget.replyId ?? null,
      reason: reportReason.trim() || null,
      reported_by: currentUser?.id ?? null,
    });
    setReportSubmitting(false);
    setReportTarget(null);
    setReportReason('');
    showToast(error ? error.message : 'Thanks — this has been reported for review.');
  }

  function requestDeleteThread() {
    if (!openThread || !currentUser || openThread.user_id !== currentUser.id) return;
    setConfirmTarget({ type: 'thread' });
  }

  async function saveThreadEdit() {
    const title = editingThread.title.trim();
    const content = editingThread.content.trim();
    if (!title || !content) { setEditError('Title and message can\'t be empty.'); return; }
    const { error } = await supabase
      .from('threads')
      .update({ title, content, updated_at: new Date().toISOString() })
      .eq('id', openThread.id);
    if (error) { setEditError(error.message); return; }
    resetEditing();
    loadBoard();
  }

  async function saveReplyEdit(reply) {
    const content = editReplyText.trim();
    if (!content) { setEditError('A reply can\'t be empty.'); return; }
    const { error } = await supabase.from('replies').update({ content }).eq('id', reply.id);
    if (error) { setEditError(error.message); return; }
    resetEditing();
    loadThreadDetail(selectedThreadId);
  }

  // A member's name links to a private message, unless it's them, they posted
  // anonymously, or the viewer is a guest.
  function canMessage(row) {
    return currentUser && row.user_id && !row.is_anonymous && row.user_id !== currentUser.id && onOpenMessages;
  }

  function requestDeleteReply(reply) {
    if (!currentUser || reply.user_id !== currentUser.id) return;
    setConfirmTarget({ type: 'reply', reply });
  }

  async function confirmDelete() {
    if (!confirmTarget) return;

    if (confirmTarget.type === 'thread') {
      const { error } = await supabase.from('threads').delete().eq('id', openThread.id);
      setConfirmTarget(null);
      if (error) { showToast(error.message); return; }
      backToBoard();
      loadBoard();
    } else {
      const { error } = await supabase.from('replies').delete().eq('id', confirmTarget.reply.id);
      setConfirmTarget(null);
      if (error) { showToast(error.message); return; }
      loadThreadDetail(selectedThreadId);
      loadBoard();
    }
  }

  function openSettings() {
    setSettingsForm({
      username: currentUser.username,
      show_apartment: currentUser.show_apartment,
      notify_on_reply: currentUser.notify_on_reply,
      notify_daily_digest: currentUser.notify_daily_digest,
    });
    setSettingsError(null);
    setShowSettings(true);
    setShowAccountMenu(false);
  }

  async function handleSaveSettings() {
    if (!settingsForm.username.trim()) {
      setSettingsError('Display name cannot be empty');
      return;
    }

    setSettingsSubmitting(true);
    setSettingsError(null);

    const { error } = await supabase
      .from('users')
      .update({
        username: settingsForm.username.trim(),
        show_apartment: settingsForm.show_apartment,
        notify_on_reply: settingsForm.notify_on_reply,
        notify_daily_digest: settingsForm.notify_daily_digest,
      })
      .eq('id', currentUser.id);

    setSettingsSubmitting(false);

    if (error) {
      setSettingsError(error.message);
      return;
    }

    await refreshCurrentUser();
    setShowSettings(false);
    showToast('Settings saved');
    loadBoard();
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    const diff = new Date() - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  const filteredThreads = threads
    .filter((t) => filter === 'all' || t.category === filter)
    .filter((t) =>
      searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.authorLabel.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // ---------- navigation safety ----------

  // While anything is open on top of the screen, Back closes that rather than
  // leaving the screen under it — what a phone's Back button does everywhere
  // else. Topmost first.
  useBackToClose(
    lightbox ? () => setLightbox(null)
    : confirmTarget ? () => setConfirmTarget(null)
    : reportTarget ? () => { setReportTarget(null); setReportReason(''); }
    : showSettings ? () => setShowSettings(false)
    : showSignupPrompt ? () => setShowSignupPrompt(false)
    : null
  );

  // Moving around inside the board keeps a half-written post in memory, so the
  // only way to really lose one is leaving the site or closing the tab. Warn
  // first when that happens.
  const draftTitle = newThread.title.trim();
  const draftBody = newThread.content.trim();
  const hasUnsavedPost = !!(draftTitle || draftBody || newThreadFiles.length);
  const hasUnsavedWork = hasUnsavedPost || !!newReply.content.trim() || newReplyFiles.length > 0;

  useEffect(() => {
    if (!hasUnsavedWork) return;
    function warn(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork]);

  function openLightbox(files, index, event) {
    // Thumbnails sit inside the board card, which is itself clickable.
    if (event) { event.preventDefault(); event.stopPropagation(); }
    setLightbox({ files, index });
  }

  // ---------- shared pieces ----------

  const ThemeToggle = () => onToggleTheme && (
    <button
      onClick={onToggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );

  const SignupPrompt = () => showSignupPrompt && (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={() => setShowSignupPrompt(false)} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          <X className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mb-4">
          <UserPlus className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">This one needs an account</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          A member account lets you reply to posts, like posts, attach photos and PDFs, send private messages to neighbors, and edit or delete your own posts.
        </p>
        <button
          onClick={() => { setShowSignupPrompt(false); if (onRequestSignup) onRequestSignup(); }}
          className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
        >
          Create an Account
        </button>
      </div>
    </div>
  );

  const ReportModal = () => reportTarget && (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={() => { setReportTarget(null); setReportReason(''); }} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          <X className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/40 rounded-full flex items-center justify-center mb-4">
          <Flag className="w-6 h-6 text-rose-600 dark:text-rose-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Report this {reportTarget.replyId ? 'reply' : 'post'}</h3>
        <textarea
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="What's wrong with it? (optional)"
          rows="3"
          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 focus:border-transparent mb-4"
        />
        <button
          onClick={submitReport}
          disabled={reportSubmitting}
          className="w-full bg-rose-600 text-white py-2.5 rounded-lg font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50"
        >
          {reportSubmitting ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );

  const ConfirmModal = () => confirmTarget && (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Delete this {confirmTarget.type === 'thread' ? 'post' : 'reply'}?</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmTarget(null)} className="flex-1 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 py-2.5 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  const Toast = () => toast && (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 max-w-xs text-center">
      {toast}
    </div>
  );

  const SettingsModal = () => showSettings && settingsForm && (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">Account Settings</h3>

        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Display name</label>
        <input
          type="text"
          value={settingsForm.username}
          onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })}
          className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm mb-4 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="space-y-3 mb-4">
          <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            Show my apartment number to other residents
            <input
              type="checkbox"
              checked={settingsForm.show_apartment}
              onChange={(e) => setSettingsForm({ ...settingsForm, show_apartment: e.target.checked })}
              className="ml-3"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            Notify me when someone replies to my posts
            <input
              type="checkbox"
              checked={settingsForm.notify_on_reply}
              onChange={(e) => setSettingsForm({ ...settingsForm, notify_on_reply: e.target.checked })}
              className="ml-3"
            />
          </label>
          <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            Send me a daily digest email
            <input
              type="checkbox"
              checked={settingsForm.notify_daily_digest}
              onChange={(e) => setSettingsForm({ ...settingsForm, notify_daily_digest: e.target.checked })}
              className="ml-3"
            />
          </label>
        </div>

        {settingsError && (
          <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mb-4">
            <X className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{settingsError}</span>
          </div>
        )}

        <button
          onClick={handleSaveSettings}
          disabled={settingsSubmitting}
          className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
        >
          {settingsSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );

  const Overlays = () => (
    <>
      {SignupPrompt()}
      {ReportModal()}
      {ConfirmModal()}
      {SettingsModal()}
      {lightbox && (
        <Lightbox
          files={lightbox.files}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
      {Toast()}
    </>
  );

  const DonateLink = () => (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Support the board with a donation (opens PayPal)"
      className="flex items-center gap-1 text-xs font-medium text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-full px-2.5 py-1 mr-1 shrink-0"
    >
      <Heart className="w-3.5 h-3.5" /> Donate
    </a>
  );

  const TopBar = () => (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-blue-100 dark:border-slate-700 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate('landing')} className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-center p-1.5 shrink-0 transition-transform group-hover:scale-105">
            <img src="/logo-icon.png" alt="MeadowBrook Logo" className="w-full h-full object-contain dark:hidden" />
            <img src="/logo-icon-white.png" alt="MeadowBrook Logo" className="w-full h-full object-contain hidden dark:block" />
          </div>
          <div className="text-left">
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">MeadowBrook · Building 7</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Community Board</p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 relative">
          {DonateLink()}
          {currentUser ? (
            <>
              <button
                onClick={() => { if (onOpenMessages) onOpenMessages(); }}
                title="Messages"
                className="relative w-9 h-9 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Mail className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {ThemeToggle()}
              <button
                onClick={() => setShowAccountMenu((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white pl-1.5"
              >
                <span className="hidden sm:inline">{currentUser.username}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 top-10 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1.5 z-30">
                    <button
                      onClick={openSettings}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    {currentUser.is_admin && (
                      <button
                        onClick={() => { setShowAccountMenu(false); if (onOpenAdmin) onOpenAdmin(); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Shield className="w-4 h-4" /> Admin Dashboard
                      </button>
                    )}
                    <button
                      onClick={() => { setShowAccountMenu(false); supabase.auth.signOut(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {ThemeToggle()}
              <button
                onClick={() => { if (onRequestSignup) onRequestSignup(); }}
                className="text-sm text-emerald-700 dark:text-emerald-400 font-medium hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 ml-1"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">New here? Create an account</span>
              </button>
              <button
                onClick={() => { if (onRequestLogin) onRequestLogin(); }}
                className="text-sm text-blue-700 dark:text-blue-400 font-medium hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Already have an account? Log in</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );

  // ---------- views ----------

  if (!initialRouteDecided) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm dark:bg-slate-900">
        Loading...
      </div>
    );
  }

  if (currentView === 'landing') {
    return (
      <PageBG>
        {Overlays()}
        {onToggleTheme && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
            {DonateLink()}
            {ThemeToggle()}
          </div>
        )}
        <div className="flex-1 flex items-center justify-center px-6 py-16 min-h-screen">
          <div className="max-w-lg w-full text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 mb-6 p-3.5 shadow-xl shadow-slate-200/50 dark:shadow-none">
              <img src="/logo-icon.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain dark:hidden" />
              <img src="/logo-icon-white.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain hidden dark:block" />
            </div>

            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">MeadowBrook · Building 7</h1>
            <p className="text-base text-slate-500 dark:text-slate-400 mb-8">A neighbor-run community board — finally here.</p>

            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm p-6 mb-6 text-left">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                A place to swap ideas, ask questions, and raise concerns with the people who live here.
                Anyone can read the board and start a thread — no account required.
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4 mb-2">With a verified member account, you can:</p>
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
                <li className="flex gap-2"><MessageSquare className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" /> Reply to posts and join the conversation</li>
                <li className="flex gap-2"><Paperclip className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" /> Attach photos and PDFs — notices, letters, or a photo of that leaky pipe</li>
                <li className="flex gap-2"><Mail className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" /> Send private messages to other members</li>
                <li className="flex gap-2"><Pencil className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" /> Edit or delete your own posts</li>
                <li className="flex gap-2"><ThumbsUp className="w-4 h-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" /> Like posts you agree with</li>
              </ul>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 italic">
                Your building. Your voice.
              </p>
            </div>

            <button
              onClick={() => navigate('board')}
              className="w-full bg-blue-700 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors shadow-md shadow-blue-100 dark:shadow-none mb-3"
            >
              Browse the Board
            </button>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => { if (onRequestSignup) onRequestSignup(); }}
                className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 font-medium py-2 hover:text-emerald-800 dark:hover:text-emerald-300"
              >
                <UserPlus className="w-4 h-4" /> New here? Create an account
              </button>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <button
                onClick={() => { if (onRequestLogin) onRequestLogin(); }}
                className="flex items-center justify-center gap-2 text-sm text-blue-700 dark:text-blue-400 font-medium py-2 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <LogIn className="w-4 h-4" /> Already have an account? Log in
              </button>
            </div>

            <p className="text-xs text-slate-300 dark:text-slate-600 mt-8">Building 7 unit owners only · If you see something, say something</p>
          </div>
        </div>
      </PageBG>
    );
  }

  if (currentView === 'thread' && openThread) {
    return (
      <PageBG>
        {TopBar()}
        {Overlays()}
        <div className="max-w-3xl mx-auto p-4">
          <button onClick={backToBoard} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to board
          </button>

          <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-5">
            <span className={`${categories.find((c) => c.id === openThread.category)?.color} text-white px-2.5 py-1 rounded-full text-xs font-semibold`}>
              {categories.find((c) => c.id === openThread.category)?.name}
            </span>
            {editingThread ? (
              <div className="mt-3 mb-4 space-y-3">
                <input
                  value={editingThread.title}
                  onChange={(e) => setEditingThread({ ...editingThread, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-base font-semibold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <textarea
                  value={editingThread.content}
                  onChange={(e) => setEditingThread({ ...editingThread, content: e.target.value })}
                  rows="6"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {editError && <p className="text-xs text-red-500 dark:text-red-400">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={saveThreadEdit} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800">Save changes</button>
                  <button onClick={resetEditing} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-3 mb-2">{openThread.title}</h1>
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-3 mb-4">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{openThread.authorLabel}</span>
                  <span>{formatTimestamp(openThread.created_at)}</span>
                  {canMessage(openThread) && (
                    <button onClick={() => onOpenMessages(openThread.user_id)} className="flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline">
                      <Mail className="w-3.5 h-3.5" /> Message
                    </button>
                  )}
                </div>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{openThread.content}</p>
                <AttachmentList files={attachments.byThread[openThread.id]} onOpen={openLightbox} />
                <div className="mb-4" />
              </>
            )}

            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button onClick={() => toggleThreadLike(openThread.id)} className={`flex items-center gap-1.5 text-sm ${openThread.likedByMe ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400'}`}>
                <ThumbsUp className="w-4 h-4" /> {openThread.likeCount}
              </button>
              <button onClick={() => setReportTarget({ threadId: openThread.id })} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-sm">
                <Flag className="w-4 h-4" /> Report
              </button>
              {currentUser && openThread.user_id === currentUser.id && (
                <div className="flex items-center gap-4 ml-auto">
                  {!currentUser.is_muted && !editingThread && (
                    <button onClick={() => { resetEditing(); setEditingThread({ title: openThread.title, content: openThread.content }); }} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 text-sm">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                  <button onClick={requestDeleteThread} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-sm">
                    Delete my post
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">Add a Reply</h3>
            {!currentUser ? (
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">Replying is for members. Creating an account takes about a minute.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { if (onRequestSignup) onRequestSignup(); }} className="bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800">
                    Create an account
                  </button>
                  <button onClick={() => { if (onRequestLogin) onRequestLogin(); }} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-blue-700 dark:text-blue-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">
                    Log in
                  </button>
                </div>
              </div>
            ) : (
              <>
            {currentUser.is_muted && (
              <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
                {MUTED_NOTICE}
              </p>
            )}
            <textarea
              value={newReply.content}
              onChange={(e) => setNewReply({ ...newReply, content: e.target.value })}
              placeholder="Share your thoughts..."
              rows="3"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-2">
              <FilePicker files={newReplyFiles} onChange={setNewReplyFiles} disabled={submittingReply || currentUser.is_muted} />
            </div>
            {replyFormError && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{replyFormError}</p>}
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={newReply.isAnonymous} onChange={(e) => setNewReply({ ...newReply, isAnonymous: e.target.checked })} className="mr-2" />
                Reply anonymously
              </label>
              <button onClick={handleReply} disabled={submittingReply || currentUser.is_muted} className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> {submittingReply ? 'Sending...' : 'Reply'}
              </button>
            </div>
              </>
            )}
          </div>

          <div className="space-y-3">
            {openReplies.map((reply) => (
              <div key={reply.id} className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-3 mb-2">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{reply.authorLabel}</span>
                  <span>{formatTimestamp(reply.created_at)}</span>
                  {canMessage(reply) && (
                    <button onClick={() => onOpenMessages(reply.user_id)} className="flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline">
                      <Mail className="w-3 h-3" /> Message
                    </button>
                  )}
                </div>
                {editingReplyId === reply.id ? (
                  <div className="mb-2 space-y-2">
                    <textarea
                      value={editReplyText}
                      onChange={(e) => setEditReplyText(e.target.value)}
                      rows="3"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {editError && <p className="text-xs text-red-500 dark:text-red-400">{editError}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => saveReplyEdit(reply)} className="bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-800">Save</button>
                      <button onClick={resetEditing} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    <p className="text-slate-700 dark:text-slate-200 text-sm whitespace-pre-wrap">{reply.content}</p>
                    <AttachmentList files={attachments.byReply[reply.id]} onOpen={openLightbox} />
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleReplyLike(reply.id)} className={`flex items-center gap-1.5 text-xs ${reply.likedByMe ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400'}`}>
                    <ThumbsUp className="w-3.5 h-3.5" /> {reply.likeCount}
                  </button>
                  <button onClick={() => setReportTarget({ replyId: reply.id })} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-xs">
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                  {currentUser && reply.user_id === currentUser.id && (
                    <div className="flex items-center gap-4 ml-auto">
                      {!currentUser.is_muted && editingReplyId !== reply.id && (
                        <button onClick={() => { resetEditing(); setEditingReplyId(reply.id); setEditReplyText(reply.content); }} className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 text-xs">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <button onClick={() => requestDeleteReply(reply)} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-xs">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageBG>
    );
  }

  // A thread URL that was shared, bookmarked or refreshed: the thread list
  // hasn't arrived yet, or that post is gone. Without this the screen would
  // fall through to the board, which looks like the link was simply wrong.
  if (currentView === 'thread') {
    return (
      <PageBG>
        {TopBar()}
        {Overlays()}
        <div className="max-w-3xl mx-auto p-4">
          <button onClick={backToBoard} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4 text-sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to board
          </button>
          {loadingBoard ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Opening post...</div>
          ) : (
            <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-6 text-center">
              <MessageSquare className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">This post isn't available.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">It may have been deleted, or the link may be out of date.</p>
              <button onClick={() => navigate('board')} className="bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800">
                Go to the board
              </button>
            </div>
          )}
        </div>
      </PageBG>
    );
  }

  if (currentView === 'create') {
    return (
      <PageBG>
        {TopBar()}
        {Overlays()}
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <button onClick={() => goBack('board')} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-5 text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </button>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">Start a New Thread</h2>
            {currentUser?.is_muted && (
              <p className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-5">
                {MUTED_NOTICE}
              </p>
            )}
            <div className="space-y-4">
              {!currentUser && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Display Name (optional)</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Leave blank to stay Anonymous"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Title</label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  placeholder="What's this about?"
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Category</label>
                <select
                  value={newThread.category}
                  onChange={(e) => setNewThread({ ...newThread, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {categories.filter((c) => c.id !== 'all').map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Message</label>
                <textarea
                  value={newThread.content}
                  onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  rows="6"
                  placeholder="Share your thoughts, concerns, or updates..."
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between">
                {currentUser ? (
                  <label className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={newThread.isAnonymous} onChange={(e) => setNewThread({ ...newThread, isAnonymous: e.target.checked })} className="mr-2" />
                    Post anonymously
                  </label>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Attaching photos & PDFs requires a member account
                  </span>
                )}
              </div>

              {currentUser && (
                <FilePicker files={newThreadFiles} onChange={setNewThreadFiles} disabled={submittingThread || currentUser.is_muted} />
              )}

              {threadFormError && <p className="text-xs text-red-500 dark:text-red-400">{threadFormError}</p>}

              <button onClick={handleCreateThread} disabled={submittingThread || currentUser?.is_muted} className="w-full bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-800 transition-colors disabled:opacity-50">
                {submittingThread ? 'Posting...' : 'Post Thread'}
              </button>
            </div>
          </div>
        </div>
      </PageBG>
    );
  }

  return (
    <PageBG>
      {TopBar()}
      {Overlays()}

      <div className="max-w-5xl mx-auto p-4">
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 dark:from-blue-800 dark:to-blue-900 rounded-xl p-5 mb-5 text-white relative overflow-hidden">
          <Leaf className="w-24 h-24 absolute -right-4 -bottom-6 text-emerald-400/20 rotate-12" />
          <h2 className="text-lg font-bold mb-1 relative">Welcome to the neighborhood</h2>
          <p className="text-sm text-blue-100 relative">Browse and post freely — no account needed. A member account lets you reply, attach photos & PDFs, message neighbors privately, and edit your own posts.</p>
        </div>

        {/* A thread started and then left behind is still sitting in memory.
            Say so plainly, with the way back to it, instead of letting someone
            assume it's gone. */}
        {hasUnsavedPost && (
          <button
            onClick={() => navigate('create')}
            className="w-full flex items-center gap-2 text-left text-sm text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 mb-4 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            <Pencil className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">
              You have an unfinished post{draftTitle ? `: “${draftTitle}”` : ''}
            </span>
            <span className="font-semibold shrink-0">Continue</span>
          </button>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threads, replies, or names..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white/95 dark:bg-slate-800/95 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Browse by category</span>
          <button
            onClick={() => navigate('create')}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> New Thread
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === cat.id ? 'bg-blue-700 text-white' : 'bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loadingBoard ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Loading threads...</div>
        ) : (
          <div className="space-y-3">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => goToThread(thread)}
                className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all cursor-pointer p-5"
              >
                <span className={`${categories.find((c) => c.id === thread.category)?.color} text-white px-2.5 py-1 rounded-full text-xs font-semibold`}>
                  {categories.find((c) => c.id === thread.category)?.name}
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mt-2.5 mb-1.5">{thread.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{thread.content}</p>
                {/* Photos and documents both get a preview here, so a notice
                    can be looked at (full size, with a download) without
                    opening the thread first. */}
                <AttachmentThumbs files={thread.attachments} onOpen={openLightbox} />
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-4">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{thread.authorLabel}</span>
                  <span>{formatTimestamp(thread.created_at)}</span>
                  <span className="flex items-center gap-1 ml-auto"><ThumbsUp className="w-3.5 h-3.5" /> {thread.likeCount}</span>
                  {thread.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> {thread.attachments.length}</span>}
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> {thread.replyCount}</span>
                </div>
              </div>
            ))}

            {filteredThreads.length === 0 && (
              <div className="text-center py-16">
                <MessageSquare className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">No threads match yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageBG>
  );
}
