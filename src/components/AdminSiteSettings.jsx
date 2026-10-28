import React, { useState, useEffect } from 'react';
import {
  Building2,
  Heart,
  Bell,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useSiteSettings, DEFAULT_SITE_SETTINGS } from '../lib/siteSettings';
import { navigate } from '../lib/router';

export default function AdminSiteSettings({ _theme }) {
  const { settings, loading, tableExists, saveSetting, resetSetting } = useSiteSettings();

  const [formState, setFormState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmResetKey, setConfirmResetKey] = useState(null);

  // Sync state when settings load
  useEffect(() => {
    if (settings && !formState) {
      setFormState(JSON.parse(JSON.stringify(settings)));
    }
  }, [settings, formState]);

  if (loading || !formState) {
    return (
      <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
        Loading site settings...
      </div>
    );
  }

  const updateSection = (section, key, value) => {
    setFormState((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [key]: value,
      },
    }));
    setSavedSuccess(false);
  };

  const updateBanner = (board, key, value) => {
    setFormState((prev) => ({
      ...prev,
      banners: {
        ...(prev.banners || {}),
        [board]: {
          ...(prev.banners?.[board] || {}),
          [key]: value,
        },
      },
    }));
    setSavedSuccess(false);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await Promise.all([
        saveSetting('branding', formState.branding),
        saveSetting('donation', formState.donation),
        saveSetting('banners', formState.banners),
        saveSetting('policies', formState.policies),
      ]);
      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setErrorMsg(err.message || 'Failed to save settings to database.');
      setSaving(false);
    }
  };

  const handleResetSection = async (key) => {
    try {
      await resetSetting(key);
      setFormState((prev) => ({
        ...prev,
        [key]: JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS[key])),
      }));
      setConfirmResetKey(null);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setErrorMsg(err.message || `Failed to reset ${key}.`);
      setConfirmResetKey(null);
    }
  };

  const bannerVariants = [
    { id: 'info', label: 'Info (Blue)', border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200' },
    { id: 'urgent', label: 'Urgent (Red)', border: 'border-rose-200 dark:border-rose-800', bg: 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200' },
    { id: 'warning', label: 'Warning (Amber)', border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200' },
    { id: 'success', label: 'Success (Green)', border: 'border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200' },
  ];

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Table existence warning banner if SQL hasn't been run */}
      {!tableExists && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-sm">Supabase Table Not Connected Yet</p>
            <p>
              The <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded font-mono">site_settings</code> table is not found in your Supabase database. The board is currently using safe local defaults.
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              To persist settings permanently across all 3 machines, run the migration file <code className="font-mono bg-white/70 dark:bg-slate-900/60 px-1 py-0.5 rounded">supabase_site_settings.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Header bar with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/95 dark:bg-slate-800/95 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Board & Platform Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage branding, donation options, live announcement banners, and posting policies without editing code.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('editor')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Visual Page Studio
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {saving ? (
              'Saving...'
            ) : savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" /> Saved!
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          Settings saved successfully and synced with Supabase!
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* 1. Branding & Header Info */}
      <div className="bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Site Branding & Header</h3>
              <p className="text-xs text-slate-400">Controls the main site title, header tagline, and administrator contact.</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmResetKey('branding')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Building Name / Main Title</label>
            <input
              type="text"
              value={formState.branding?.buildingName || ''}
              onChange={(e) => updateSection('branding', 'buildingName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="MeadowBrook · Building 7"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Contact Email</label>
            <input
              type="email"
              value={formState.branding?.contactEmail || ''}
              onChange={(e) => updateSection('branding', 'contactEmail', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="dgromensky@gmail.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Subtitle / Tagline</label>
            <input
              type="text"
              value={formState.branding?.subtitle || ''}
              onChange={(e) => updateSection('branding', 'subtitle', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Community discussion board for owners and occupants"
            />
          </div>
        </div>
      </div>

      {/* 2. Live Board Announcement Banners */}
      <div className="bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Live Board Announcement Banners</h3>
              <p className="text-xs text-slate-400">Display prominent notice banners at the top of the General or Members boards.</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmResetKey('banners')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        {/* General Board Banner */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">General Board Banner (Public)</span>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formState.banners?.general?.enabled ?? false}
                onChange={(e) => updateBanner('general', 'enabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Show Banner
            </label>
          </div>

          {formState.banners?.general?.enabled && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Banner Style</label>
                  <select
                    value={formState.banners?.general?.variant || 'info'}
                    onChange={(e) => updateBanner('general', 'variant', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    {bannerVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Banner Title</label>
                  <input
                    type="text"
                    value={formState.banners?.general?.title || ''}
                    onChange={(e) => updateBanner('general', 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="General Board Notice"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Message Content</label>
                <textarea
                  value={formState.banners?.general?.message || ''}
                  onChange={(e) => updateBanner('general', 'message', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none"
                  placeholder="Welcome! Open to all neighbors."
                />
              </div>

              {/* Preview */}
              <div className="text-[11px] text-slate-400">Live Preview:</div>
              <div className={`p-3 rounded-lg border text-xs ${bannerVariants.find((v) => v.id === formState.banners?.general?.variant)?.border} ${bannerVariants.find((v) => v.id === formState.banners?.general?.variant)?.bg}`}>
                <div className="font-bold">{formState.banners?.general?.title || 'Notice'}</div>
                <div className="mt-0.5">{formState.banners?.general?.message || 'No message set.'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Members Board Banner */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Members Board Banner (Building 7 Residents)</span>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formState.banners?.members?.enabled ?? false}
                onChange={(e) => updateBanner('members', 'enabled', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              Show Banner
            </label>
          </div>

          {formState.banners?.members?.enabled && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Banner Style</label>
                  <select
                    value={formState.banners?.members?.variant || 'info'}
                    onChange={(e) => updateBanner('members', 'variant', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    {bannerVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Banner Title</label>
                  <input
                    type="text"
                    value={formState.banners?.members?.title || ''}
                    onChange={(e) => updateBanner('members', 'title', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    placeholder="Building 7 Announcements"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Message Content</label>
                <textarea
                  value={formState.banners?.members?.message || ''}
                  onChange={(e) => updateBanner('members', 'message', e.target.value)}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 resize-none"
                  placeholder="Registered members can file documents in Archives or send private messages."
                />
              </div>

              {/* Preview */}
              <div className="text-[11px] text-slate-400">Live Preview:</div>
              <div className={`p-3 rounded-lg border text-xs ${bannerVariants.find((v) => v.id === formState.banners?.members?.variant)?.border} ${bannerVariants.find((v) => v.id === formState.banners?.members?.variant)?.bg}`}>
                <div className="font-bold">{formState.banners?.members?.title || 'Notice'}</div>
                <div className="mt-0.5">{formState.banners?.members?.message || 'No message set.'}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Support & Donation */}
      <div className="bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Donation & Support Button</h3>
              <p className="text-xs text-slate-400">Configure the PayPal donation link shown in the header navigation.</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmResetKey('donation')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Show Donate Button in Navigation</div>
            <div className="text-[11px] text-slate-400">Toggles the heart badge in the top navigation bar.</div>
          </div>
          <input
            type="checkbox"
            checked={formState.donation?.enabled ?? true}
            onChange={(e) => updateSection('donation', 'enabled', e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
          />
        </div>

        {formState.donation?.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Button Label</label>
              <input
                type="text"
                value={formState.donation?.label || 'Support the Board'}
                onChange={(e) => updateSection('donation', 'label', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                placeholder="Support the Board"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">PayPal Hosted URL</label>
              <input
                type="url"
                value={formState.donation?.url || ''}
                onChange={(e) => updateSection('donation', 'url', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                placeholder="https://www.paypal.com/donate/?hosted_button_id=..."
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Board Policies */}
      <div className="bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Board Policies & Safety</h3>
              <p className="text-xs text-slate-400">Control guest permissions, anonymous postings, and upload limits.</p>
            </div>
          </div>
          <button
            onClick={() => setConfirmResetKey('policies')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Allow Guest Posting on General Board</div>
              <div className="text-[11px] text-slate-400">Visitors can start threads and browse General without logging in.</div>
            </div>
            <input
              type="checkbox"
              checked={formState.policies?.allowGuestPosting ?? true}
              onChange={(e) => updateSection('policies', 'allowGuestPosting', e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Allow Anonymous Posting</div>
              <div className="text-[11px] text-slate-400">Permits posters to tick 'Post anonymously' to hide their identity.</div>
            </div>
            <input
              type="checkbox"
              checked={formState.policies?.allowAnonymous ?? true}
              onChange={(e) => updateSection('policies', 'allowAnonymous', e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Max Attachment Size (MB)</div>
              <div className="text-[11px] text-slate-400">Maximum allowed file size for photos and PDFs per upload.</div>
            </div>
            <input
              type="number"
              min="1"
              max="50"
              value={formState.policies?.maxAttachmentMb ?? 25}
              onChange={(e) => updateSection('policies', 'maxAttachmentMb', parseInt(e.target.value, 10) || 25)}
              className="w-20 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center"
            />
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Resetting */}
      {confirmResetKey && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Reset {confirmResetKey} settings?
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This will restore the default values for the {confirmResetKey} section. Any unsaved edits will be discarded.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmResetKey(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResetSection(confirmResetKey)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
