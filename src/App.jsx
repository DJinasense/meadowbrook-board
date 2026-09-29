import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { useTheme } from './lib/useTheme';
import SignupFlow from './components/SignupFlow';
import LoginFlow from './components/LoginFlow';
import ResetPasswordFlow from './components/ResetPasswordFlow';
import MainBoard from './components/MainBoard';
import AdminDashboard from './components/AdminDashboard';
import Messages from './components/Messages';

function App() {
  const [view, setView] = useState('board'); // 'board' | 'signup' | 'login' | 'reset-password' | 'admin' | 'messages'
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
