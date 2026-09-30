import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { useTheme } from './lib/useTheme';
import SignupFlow from './components/SignupFlow';
import LoginFlow from './components/LoginFlow';
import ResetPasswordFlow from './components/ResetPasswordFlow';
import MainBoard from './components/MainBoard';
import AdminDashboard from './components/AdminDashboard';
import Messages from './components/Messages';

// Read the URL before supabase-js clears it. A confirmation email link lands
// here with "#...type=signup" (supabase-js signs them in from the same hash);
// an expired or already-used link lands with "#error_code=...".
const landingHash = new URLSearchParams(window.location.hash.slice(1));
const INITIAL_VIEW =
  landingHash.get('type') === 'signup' ? 'welcome'
  : landingHash.get('error_code') ? 'login'
  : 'board';
const LINK_ERROR_NOTICE = landingHash.get('error_code')
  ? "That email link has expired or was already used. Log in below. If your email still needs confirming, we'll offer to send a fresh link."
  : null;
if (LINK_ERROR_NOTICE) window.history.replaceState(null, '', window.location.pathname + window.location.search);

function App() {
  const [view, setView] = useState(INITIAL_VIEW); // 'board' | 'welcome' | 'signup' | 'login' | 'reset-password' | 'admin' | 'messages'
  const [messageTarget, setMessageTarget] = useState(null);
  const { theme, toggleTheme } = useTheme();

  // A password-reset email link lands back on this app with a recovery
  // session already established by supabase-js; it fires this specific
  // event so we can show a "set new password" screen instead of the
  // normal board/landing view.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset-password');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (view === 'welcome') {
    return <SignupFlow initialStep="success" onVerified={() => setView('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (view === 'signup') {
    return (
      <SignupFlow
        onContinueAsGuest={() => setView('board')}
        onVerified={() => setView('board')}
        onSwitchToLogin={() => setView('login')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (view === 'login') {
    return (
      <LoginFlow
        onLoggedIn={() => setView('board')}
        onBack={() => setView('board')}
        onSwitchToSignup={() => setView('signup')}
        notice={LINK_ERROR_NOTICE}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (view === 'reset-password') {
    return <ResetPasswordFlow onDone={() => setView('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (view === 'admin') {
    return <AdminDashboard onBack={() => setView('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (view === 'messages') {
    return (
      <Messages
        startWithUserId={messageTarget}
        onBack={() => { setMessageTarget(null); setView('board'); }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <MainBoard
      onRequestSignup={() => setView('signup')}
      onRequestLogin={() => setView('login')}
      onOpenAdmin={() => setView('admin')}
      onOpenMessages={(userId) => { setMessageTarget(userId || null); setView('messages'); }}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;
