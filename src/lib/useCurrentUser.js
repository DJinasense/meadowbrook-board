import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadProfile(uid) {
      const { data } = await supabase
        .from('users')
        .select('id, username, apartment, is_admin, show_apartment, notify_on_reply, notify_daily_digest')
        .eq('id', uid)
        .single();
      if (active) {
        setCurrentUser(data || null);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user.id);
      } else if (active) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user.id);
      } else {
        setUserId(null);
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    if (!userId) return;
    const { data } = await supabase
      .from('users')
      .select('id, username, apartment, is_admin, show_apartment, notify_on_reply, notify_daily_digest')
      .eq('id', userId)
      .single();
    if (data) setCurrentUser(data);
  }

  return { currentUser, loading, refresh };
}
