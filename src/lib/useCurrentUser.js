import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ensureProfile, fetchProfile } from './ensureProfile';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadProfile(authUser) {
      const { profile } = await ensureProfile(authUser);
      if (active) {
        setCurrentUser(profile || null);
        setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user);
      } else if (active) {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user);
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
    const data = await fetchProfile(userId);
    if (data) setCurrentUser(data);
  }

  return { currentUser, loading, refresh };
}
