import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { useTheme } from './lib/useTheme';
import { useRoute, navigate, replaceRoute, seedRoute, goBack } from './lib/router';
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
const LINK_ERROR_NOTICE = landingHash.get('error_code')
  ? "That email link has expired or was already used. Log in below. If your email still needs confirming, we'll offer to send a fresh link."
  : null;

// An email link overrides whatever screen the URL path pointed at. seedRoute
// leaves the URL alone on purpose — the hash is where supabase-js finds the
// session, and it reads it asynchronously after this module runs.
if (landingHash.get('type') === 'signup') seedRoute('welcome');
else if (LINK_ERROR_NOTICE) seedRoute('login');

function App() {
  const route = useRoute(); // { view, id } — see src/lib/router.js
  const { theme, toggleTheme } = useTheme();

  // A password-reset email link lands back on this app with a recovery
  // session already established by supabase-js; it fires this specific
  // event so we can show a "set new password" screen instead of the
  // normal board/landing view.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('reset-password');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Which of the three to use, throughout:
  //   goBack       — the resident is done here; drop this screen off the stack
  //                  so Back doesn't walk back into it.
  //   replaceRoute — a sideways move (login <-> signup) or a one-time screen
  //                  arrived at from an email link, which there's no sense in
  //                  returning to.
  //   navigate     — a genuinely new screen they chose to open.
  if (route.view === 'welcome') {
    return <SignupFlow initialStep="success" onVerified={() => replaceRoute('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (route.view === 'signup') {
    return (
      <SignupFlow
        onContinueAsGuest={() => goBack('board')}
        onVerified={() => goBack('board')}
        onSwitchToLogin={() => replaceRoute('login')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (route.view === 'login') {
    return (
      <LoginFlow
        onLoggedIn={() => goBack('board')}
        onBack={() => goBack('board')}
        onSwitchToSignup={() => replaceRoute('signup')}
        notice={LINK_ERROR_NOTICE}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  if (route.view === 'reset-password') {
    return <ResetPasswordFlow onDone={() => replaceRoute('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (route.view === 'admin') {
    return <AdminDashboard onBack={() => goBack('board')} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (route.view === 'messages') {
    return (
      <Messages
        startWithUserId={route.id}
        onBack={() => goBack('board')}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  // landing / board / thread / create are MainBoard's own business; it reads
  // the route itself. Unknown paths fall through to here too.
  return (
    <MainBoard
      onRequestSignup={() => navigate('signup')}
      onRequestLogin={() => navigate('login')}
      onOpenAdmin={() => navigate('admin')}
      onOpenMessages={(userId) => navigate('messages', userId || null)}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;
