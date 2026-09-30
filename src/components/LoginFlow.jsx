import React, { useState } from 'react';
import { Mail, Lock, XCircle, UserPlus, Sun, Moon, MailWarning, Info } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CONFIRM_REDIRECT, friendlyResendError } from '../lib/authEmail';

// notice: shown above the form, e.g. when an expired email link sent them here.
export default function LoginFlow({ onLoggedIn, onBack, onSwitchToSignup, theme, onToggleTheme, notice }) {
  const [step, setStep] = useState('login'); // login | forgot | forgot-sent
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendState, setResendState] = useState(null); // null | 'sending' | 'sent' | error message

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNeedsConfirm(false);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    // Supabase only says this when the password was right, so it doesn't
    // reveal anything about accounts the person doesn't control.
    if (signInError?.code === 'email_not_confirmed' || /not confirmed/i.test(signInError?.message || '')) {
      setNeedsConfirm(true);
      setResendState(null);
      return;
    }

    if (signInError) {
      // Deliberately generic: Supabase itself does not distinguish "wrong password"
      // from "no account with that email" to avoid revealing which emails are registered.
      setError('Incorrect email or password.');
      return;
    }

    if (onLoggedIn) onLoggedIn();
  }

  async function handleResendConfirmation() {
    setResendState('sending');
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: CONFIRM_REDIRECT },
    });
    setResendState(resendError ? friendlyResendError(resendError) : 'sent');
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
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 mb-4 p-3 shadow-xs">
                <img src="/logo-icon.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain dark:hidden" />
                <img src="/logo-icon-white.png" alt="MeadowBrook Building 7" className="w-full h-full object-contain hidden dark:block" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Welcome back</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Log in to your account</p>
            </div>

            {notice && (
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-slate-900/60 border border-blue-200 dark:border-slate-600 text-blue-900 dark:text-slate-200 text-sm rounded-lg p-3 mb-5">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mt-4">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {needsConfirm && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mt-4 text-left">
                <p className="flex items-start gap-2 text-base font-semibold text-amber-900 dark:text-amber-200">
                  <MailWarning className="w-5 h-5 mt-0.5 shrink-0" /> Please confirm your email first
                </p>
                <p className="text-sm text-amber-900/80 dark:text-amber-100/80 mt-2">
                  We emailed a confirmation link to <strong className="break-words">{email.trim()}</strong>. Tap the link in that email and you'll be logged in. Check your Spam or Junk folder if you can't find it.
                </p>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendState === 'sending'}
                  className="w-full mt-3 border-2 border-amber-700 dark:border-amber-400 text-amber-800 dark:text-amber-200 py-3 rounded-lg text-base font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50"
                >
                  {resendState === 'sending' ? 'Sending…' : 'Send the email again'}
                </button>
                {resendState === 'sent' && <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-2">Sent! Check your inbox.</p>}
                {resendState && resendState !== 'sending' && resendState !== 'sent' && (
                  <p className="text-sm text-red-500 dark:text-red-400 mt-2">{resendState}</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors mt-6 disabled:opacity-50"
            >
              {submitting ? 'Logging in...' : 'Log In'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('forgot'); setError(null); }}
              className="w-full text-blue-700 dark:text-blue-400 text-sm mt-4 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Forgot password?
            </button>

            <div className="border-t border-gray-100 dark:border-slate-700 mt-6 pt-4 flex items-center justify-between text-sm">
              <button type="button" onClick={() => { if (onBack) onBack(); }} className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                ← Back
              </button>
              <button type="button" onClick={() => { if (onSwitchToSignup) onSwitchToSignup(); }} className="text-emerald-700 dark:text-emerald-400 font-medium hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5" /> New here? Sign up
              </button>
            </div>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }}>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">Reset your password</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">We'll email you a link to set a new one.</p>

            <div className="relative mb-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 dark:text-red-400 text-sm mt-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors mt-4 disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('login'); setError(null); }}
              className="w-full text-gray-500 dark:text-slate-400 text-sm mt-4 hover:text-gray-700 dark:hover:text-slate-200"
            >
              ← Back to login
            </button>
          </form>
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
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            >
              Back to Log In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
