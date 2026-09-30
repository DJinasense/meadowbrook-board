import React, { useState } from 'react';
import { Mail, User, Lock, CheckCircle, XCircle, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ensureProfile } from '../lib/ensureProfile';

export default function SignupFlow({ onContinueAsGuest, onVerified, onSwitchToLogin, theme, onToggleTheme }) {
  const [step, setStep] = useState('landing'); // landing | signup | success
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState(null);

  const handleCreateAccount = async () => {
    if (!form.email || !form.username || !form.password) {
      setSignupError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setSignupError(null);

    const email = form.email.trim();
    const username = form.username.trim();

    let { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: { data: { username } },
    });

    // Email already has a login (e.g. an earlier signup that didn't finish).
    // If the password matches, it's the same person — log them in and finish
    // setting up their profile instead of leaving them stuck.
    if (authError && /already registered/i.test(authError.message)) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: form.password });
      if (signInError) {
        setSignupError('An account with this email already exists. Please log in instead, or use "Forgot password?" on the login screen.');
        setSubmitting(false);
        return;
      }
      authData = signInData;
      authError = null;
    }

    if (authError) {
      setSignupError(authError.message);
      setSubmitting(false);
      return;
    }

    if (!authData.session) {
      setSignupError(
        'Account created, but no active session was returned. In Supabase, go to Authentication → Sign In / Providers → Email, and turn off "Confirm email".'
      );
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await ensureProfile(authData.user, username);

    if (profileError) {
      setSignupError(profileError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setStep('success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4 relative">
      {onToggleTheme && (
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8">

        {/* LANDING: choose path */}
        {step === 'landing' && (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 mb-4 p-3 shadow-xs">
                <img src="/logo-icon.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain dark:hidden" />
                <img src="/logo-icon-white.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain hidden dark:block" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Community Board</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Browse freely, or create an account for extra features</p>
            </div>

            <button
              onClick={() => { if (onContinueAsGuest) onContinueAsGuest(); }}
              className="w-full border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 py-3 rounded-lg font-medium hover:border-gray-300 dark:hover:border-slate-500 transition-colors mb-3"
            >
              Continue Browsing Anonymously
            </button>

            <button
              onClick={() => setStep('signup')}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              Create an Account
            </button>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-6">
              A member account lets you reply, attach photos & PDFs,<br/>message neighbors privately, and edit your own posts.
            </p>

            <button
              onClick={() => { if (onSwitchToLogin) onSwitchToLogin(); }}
              className="w-full text-blue-700 dark:text-blue-400 text-sm font-medium mt-4 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Already have an account? Log in
            </button>
          </div>
        )}

        {/* STEP: create account */}
        {step === 'signup' && (
          <form onSubmit={(e) => { e.preventDefault(); handleCreateAccount(); }}>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">Create Your Account</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Takes less than a minute</p>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  autoComplete="nickname"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Display name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {signupError && (
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mt-4">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{signupError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors mt-6 disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              type="button"
              onClick={() => setStep('landing')}
              className="w-full text-gray-500 dark:text-slate-400 text-sm mt-4 hover:text-gray-700 dark:hover:text-slate-200"
            >
              ← Back
            </button>
          </form>
        )}

        {/* SUCCESS */}
        {step === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">You're in!</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              Welcome to the board.<br/>
              You can now reply, attach photos & PDFs,<br/>and message other members privately.
            </p>
            <button
              onClick={() => { if (onVerified) onVerified(); }}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              Go to the Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
