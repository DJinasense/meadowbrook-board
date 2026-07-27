import React, { useState } from 'react';
import { Home, KeyRound, Mail, User, Lock, CheckCircle, XCircle, ArrowRight, Sun, Moon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function InviteSignupFlow({ onContinueAsGuest, onVerified, onSwitchToLogin, theme, onToggleTheme }) {
  const [step, setStep] = useState('landing'); // landing | code | signup | success
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null); // null | 'checking' | 'valid' | 'invalid'
  const [apartment, setApartment] = useState('');
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState(null);

  const handleCheckCode = async () => {
    setCodeStatus('checking');
    const cleaned = inviteCode.trim().toUpperCase();

    const { data, error } = await supabase.rpc('check_invite_code', { p_code: cleaned });

    if (error || !data || data.length === 0 || !data[0].is_valid) {
      setCodeStatus('invalid');
      return;
    }

    setApartment(data[0].apartment);
    setCodeStatus('valid');
  };

  const handleCreateAccount = async () => {
    if (!form.email || !form.username || !form.password) {
      setSignupError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setSignupError(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

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

    const cleanedCode = inviteCode.trim().toUpperCase();
    const { data: redeemedApartment, error: redeemError } = await supabase.rpc('redeem_invite_code', {
      p_code: cleanedCode,
      p_username: form.username.trim(),
    });

    if (redeemError) {
      setSignupError(redeemError.message);
      setSubmitting(false);
      return;
    }

    setApartment(redeemedApartment);
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
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-full mb-4">
                <Home className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Community Board</h1>
              <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Browse freely, or verify your unit for extra features</p>
            </div>

            <button
              onClick={() => onContinueAsGuest && onContinueAsGuest()}
              className="w-full border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 py-3 rounded-lg font-medium hover:border-gray-300 dark:hover:border-slate-500 transition-colors mb-3"
            >
              Continue Browsing Anonymously
            </button>

            <button
              onClick={() => setStep('code')}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-5 h-5" />
              I Have an Invite Code
            </button>

            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-6">
              Invite codes are mailed to verified unit owners.<br/>
              Verified accounts unlock notifications & direct messaging.
            </p>

            <button
              onClick={() => onSwitchToLogin && onSwitchToLogin()}
              className="w-full text-indigo-600 dark:text-indigo-400 text-sm font-medium mt-4 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              Already verified? Log in
            </button>
          </div>
        )}

        {/* STEP: enter invite code */}
        {step === 'code' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">Enter Your Invite Code</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Found on the card mailed to your unit</p>

            <div className="relative mb-2">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setCodeStatus(null); }}
                placeholder="MB7-023-A7F2"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg uppercase tracking-wide bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {codeStatus === 'valid' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm mb-4">
                <CheckCircle className="w-4 h-4" />
                Code verified — {apartment}
              </div>
            )}
            {codeStatus === 'invalid' && (
              <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-sm mb-4">
                <XCircle className="w-4 h-4" />
                Invalid or already-used code
              </div>
            )}

            {codeStatus !== 'valid' ? (
              <button
                onClick={handleCheckCode}
                disabled={codeStatus === 'checking' || !inviteCode}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4"
              >
                {codeStatus === 'checking' ? 'Checking...' : 'Verify Code'}
              </button>
            ) : (
              <button
                onClick={() => setStep('signup')}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 mt-4"
              >
                Continue to Sign Up <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => setStep('landing')}
              className="w-full text-gray-500 dark:text-slate-400 text-sm mt-4 hover:text-gray-700 dark:hover:text-slate-200"
            >
              ← Back
            </button>
          </div>
        )}

        {/* STEP: create account */}
        {step === 'signup' && (
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-1">Create Your Account</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
              Linked to <span className="font-semibold">{apartment}</span>
            </p>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Display name"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              onClick={handleCreateAccount}
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors mt-6 disabled:opacity-50"
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              onClick={() => setStep('code')}
              className="w-full text-gray-500 dark:text-slate-400 text-sm mt-4 hover:text-gray-700 dark:hover:text-slate-200"
            >
              ← Back
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-2">You're Verified!</h2>
            <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
              {apartment} is now linked to your account.<br/>
              Notifications and direct messaging are unlocked.
            </p>
            <button
              onClick={() => onVerified && onVerified(apartment)}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Go to the Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
