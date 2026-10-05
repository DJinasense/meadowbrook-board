import { supabase } from './supabaseClient';

const PROFILE_COLUMNS =
  'id, username, apartment, is_admin, is_muted, is_suspended, show_apartment, notify_on_reply, notify_announcements';

export async function fetchProfile(uid) {
  const { data } = await supabase.from('users').select(PROFILE_COLUMNS).eq('id', uid).maybeSingle();
  return data;
}

// Creates the public.users row for a signed-in auth user when it's missing.
// Happens when a signup created the login but the profile insert failed (the
// site was down, or RLS rejected it) — without this, that person can log in
// but the app treats them as a guest forever, and signing up again fails
// because the email is already registered.
//
// preferredName: the display name the person typed at signup. If it's taken
// we tell them rather than silently changing it. With no preferred name
// (repairing an old account at login), fall back to their signup metadata or
// email prefix, adding digits if that name is taken.
export async function ensureProfile(authUser, preferredName) {
  const existing = await fetchProfile(authUser.id);
  if (existing) return { profile: existing };

  const base = (preferredName || authUser.user_metadata?.username || authUser.email.split('@')[0]).trim();

  for (let attempt = 0; attempt < 4; attempt++) {
    const username = attempt === 0 ? base : `${base}${Math.floor(100 + Math.random() * 900)}`;
    const { error } = await supabase.from('users').insert({ id: authUser.id, email: authUser.email, username });
    if (!error) return { profile: await fetchProfile(authUser.id) };

    const usernameTaken = error.code === '23505' && error.message.includes('username');
    if (usernameTaken && !preferredName) continue;
    if (usernameTaken) return { error: { message: 'That display name is already taken — please choose another.' } };

    // Another tab/listener may have created the row between our check and insert.
    const profile = await fetchProfile(authUser.id);
    return profile ? { profile } : { error };
  }
  return { error: { message: 'Could not pick a free display name — please try again.' } };
}
