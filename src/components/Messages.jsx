import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Send, Search, Sun, Moon, PenSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useCurrentUser } from '../lib/useCurrentUser';

const MUTED_NOTICE = 'An admin has paused posting on your account, including sending messages.';

function formatTime(value) {
  const d = new Date(value);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString();
}

export default function Messages({ onBack, startWithUserId, theme, onToggleTheme }) {
  const { currentUser, loading: authLoading } = useCurrentUser();

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState(startWithUserId || null);
  const [choosing, setChoosing] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const me = currentUser?.id;

  async function loadAll() {
    const [{ data: msgRows }, { data: memberRows }] = await Promise.all([
      supabase.from('direct_messages').select('id, sender_id, recipient_id, content, read, created_at').order('created_at'),
      supabase.from('member_directory').select('id, username').order('username'),
    ]);
    setMessages(msgRows || []);
    setMembers(memberRows || []);
    setLoaded(true);
  }

  useEffect(() => {
    if (!me) return;
    loadAll();
    const timer = setInterval(loadAll, 15000);
    return () => clearInterval(timer);
  }, [me]);

  const nameOf = (id) => members.find((m) => m.id === id)?.username || 'Former member';

  // Mark a conversation read whenever it's open and has unread messages to me.
  const unreadInActive = messages.some((m) => m.recipient_id === me && m.sender_id === activeId && !m.read);
  useEffect(() => {
    if (!me || !activeId || !unreadInActive) return;
    supabase.from('direct_messages').update({ read: true })
      .eq('recipient_id', me).eq('sender_id', activeId).eq('read', false)
      .then(() => setMessages((prev) => prev.map((m) => (m.recipient_id === me && m.sender_id === activeId ? { ...m, read: true } : m))));
  }, [me, activeId, unreadInActive]);

  const thread = messages.filter(
    (m) => (m.sender_id === me && m.recipient_id === activeId) || (m.sender_id === activeId && m.recipient_id === me)
  );

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [activeId, thread.length]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !activeId) return;
    if (currentUser.is_muted) { setError(MUTED_NOTICE); return; }
    setSending(true);
    setError(null);
    const { data, error: sendError } = await supabase
      .from('direct_messages')
      .insert({ sender_id: me, recipient_id: activeId, content })
      .select('id, sender_id, recipient_id, content, read, created_at')
      .single();
    setSending(false);
    if (sendError) { setError(sendError.message); return; }
    setMessages((prev) => [...prev, data]);
    setDraft('');
  }

  // One entry per person I've messaged with, most recent first.
  const conversations = Object.values(
    messages.reduce((acc, m) => {
      const other = m.sender_id === me ? m.recipient_id : m.sender_id;
      const entry = acc[other] || { otherId: other, last: m, unread: 0 };
      entry.last = m;
      if (m.recipient_id === me && !m.read) entry.unread += 1;
      acc[other] = entry;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

  const pickable = members.filter(
    (m) => m.id !== me && m.username.toLowerCase().includes(memberQuery.trim().toLowerCase())
  );

  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-blue-100 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-700 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Messages</h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Private — only you and the other person can read these</p>
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

  if (authLoading) return shell(<p className="text-sm text-slate-400 text-center py-10">Loading...</p>);
  if (!currentUser) return shell(<p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">Log in to use private messages.</p>);

  // --- choosing someone to message ---
  if (choosing) {
    return shell(
      <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <button onClick={() => setChoosing(false)} className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">Who do you want to message?</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            autoFocus
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder="Search by name"
            className="w-full pl-9 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg text-base bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {pickable.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No members match that name.</p>}
          {pickable.map((m) => (
            <button
              key={m.id}
              onClick={() => { setActiveId(m.id); setChoosing(false); setMemberQuery(''); }}
              className="w-full text-left py-3 px-1 text-base text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded"
            >
              {m.username}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- one conversation ---
  if (activeId) {
    return shell(
      <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
          <button onClick={() => { setActiveId(null); setError(null); }} className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> All messages
          </button>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{nameOf(activeId)}</span>
        </div>

        <div className="px-5 py-4 space-y-3 min-h-[16rem] max-h-[60vh] overflow-y-auto">
          {loaded && thread.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No messages yet. Say hello!</p>
          )}
          {thread.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${mine ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                  <p className={`text-[11px] mt-1 ${mine ? 'text-blue-100' : 'text-slate-400'}`}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="border-t border-slate-100 dark:border-slate-700 p-4"
        >
          {currentUser.is_muted && <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">{MUTED_NOTICE}</p>}
          {error && <p className="text-sm text-red-500 dark:text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2 items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              rows={2}
              placeholder={`Message ${nameOf(activeId)}...`}
              disabled={currentUser.is_muted}
              className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-base resize-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || currentUser.is_muted}
              className="flex items-center gap-1.5 bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- conversation list ---
  return shell(
    <div>
      <button
        onClick={() => setChoosing(true)}
        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold hover:bg-blue-800 mb-4"
      >
        <PenSquare className="w-4 h-4" /> New message
      </button>
      {!loaded ? (
        <p className="text-sm text-slate-400 text-center py-10">Loading messages...</p>
      ) : conversations.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10 bg-white/70 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700">
          No messages yet. Tap "New message" to write to a neighbor.
        </p>
      ) : (
        <div className="bg-white/95 dark:bg-slate-800/95 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {conversations.map((c) => (
            <button
              key={c.otherId}
              onClick={() => setActiveId(c.otherId)}
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div className="min-w-0">
                <p className={`text-base ${c.unread ? 'font-bold' : 'font-medium'} text-slate-800 dark:text-slate-100`}>{nameOf(c.otherId)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                  {c.last.sender_id === me ? 'You: ' : ''}{c.last.content}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-400">{formatTime(c.last.created_at)}</p>
                {c.unread > 0 && <span className="inline-block mt-1 bg-rose-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">{c.unread}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
