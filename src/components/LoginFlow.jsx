import React, { useState } from 'react';
import { Home, Mail, Lock, XCircle, KeyRound, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function LoginFlow({ onLoggedIn, onBack, onSwitchToSignup, theme, onToggleTheme }) {
  const [step, setStep] = useState('login'); // login | forgot | forgot-sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      // Deliberately generic: Supabase itself does not distinguish "wrong password"
      // from "no account with that email" to avoid revealing which emails are registered.
      setError('Incorrect email or password.');
      return;
    }

    onLoggedIn && onLoggedIn();
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above, then click "Forgot password?"');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    setSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setStep('forgot-sent');
  }

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

        {step === 'login' && (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-full mb-4">
                <Home className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Welcome back</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Log in with your verified account</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mt-4">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors mt-6 disabled:opacity-50"
            >
              {submitting ? 'Logging in...' : 'Log In'}
            </button>

            <button
              onClick={() => { setStep('forgot'); setError(null); }}
              className="w-full text-indigo-600 dark:text-indigo-400 text-sm mt-4 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              Forgot password?
            </button>

            <div className="border-t border-gray-100 dark:border-slate-700 mt-6 pt-4 flex items-center justify-between text-sm">
              <button onClick={() => onBack && onBack()} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                ← Back
              </button>
              <button onClick={() => onSwitchToSignup && onSwitchToSignup()} className="text-emerald-700 dark:text-emerald-400 font-medium hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" /> New here? Sign up
              </button>
            </div>
          </div>
        )}

        {step === 'forgot' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">Reset your password</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">We'll email you a link to set a new one.</p>

            <div className="relative mb-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mt-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleForgotPassword}
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors mt-4 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              onClick={() => { setStep('login'); setError(null); }}
              className="w-full text-gray-500 dark:text-slate-400 text-sm mt-4 hover:text-gray-700 dark:hover:text-slate-200"
            >
              ← Back to login
            </button>
          </div>
        )}

        {step === 'forgot-sent' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full mb-4">
              <Mail className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">Check your email</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              If an account exists for {email}, a password reset link is on its way.
            </p>
            <button
              onClick={() => setStep('login')}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Back to Log In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
