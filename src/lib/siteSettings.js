import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

export const DEFAULT_SITE_SETTINGS = {
  branding: {
    buildingName: 'MeadowBrook · Building 7',
    subtitle: 'Community discussion board for owners and occupants',
    contactEmail: 'dgromensky@gmail.com',
  },
  donation: {
    enabled: true,
    url: 'https://www.paypal.com/donate/?hosted_button_id=62QBNJL452VKE',
    label: 'Self hosted, chip in :)',
  },
  banners: {
    general: {
      enabled: false,
      title: 'General Board Notice',
      message: 'Welcome! Open to all neighbors. Start a thread or join a conversation.',
      variant: 'info', // 'urgent' | 'warning' | 'info' | 'success'
    },
    members: {
      enabled: false,
      title: 'Building 7 Announcements',
      message: 'Registered members can file documents in Archives or send private messages.',
      variant: 'info',
    },
  },
  policies: {
    allowGuestPosting: true,
    allowAnonymous: true,
    maxAttachmentMb: 25,
  },
  categories: [
    { id: 'general', label: 'Everyday Talk', description: 'General neighborhood discussions' },
    { id: 'maintenance', label: 'Building Issues', description: 'Repairs, water, noise, elevators' },
    { id: 'recommendations', label: 'Recommendations', description: 'Local handymen, contractors, services' },
    { id: 'marketplace', label: 'Marketplace & Free', description: 'Items to buy, sell, or give away' },
    { id: 'lost_found', label: 'Lost & Found', description: 'Lost keys, packages, pets' },
  ],
};

let cachedSettings = { ...DEFAULT_SITE_SETTINGS };
let cachedLoaded = false;
let cachedTableExists = true;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(cachedSettings, cachedTableExists));
}

export async function fetchSiteSettings() {
  try {
    const { data, error } = await supabase.from('site_settings').select('key, value');
    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        cachedTableExists = false;
      }
      cachedLoaded = true;
      emit();
      return { settings: cachedSettings, tableExists: cachedTableExists };
    }

    const merged = { ...DEFAULT_SITE_SETTINGS };
    (data || []).forEach((row) => {
      if (row.key && row.value) {
        merged[row.key] = typeof row.value === 'object' && !Array.isArray(row.value)
          ? { ...(DEFAULT_SITE_SETTINGS[row.key] || {}), ...row.value }
          : row.value;
      }
    });

    cachedSettings = merged;
    cachedTableExists = true;
    cachedLoaded = true;
    emit();
    return { settings: merged, tableExists: true };
  } catch (err) {
    console.warn('fetchSiteSettings error:', err);
    cachedLoaded = true;
    emit();
    return { settings: cachedSettings, tableExists: cachedTableExists };
  }
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(cachedSettings);
  const [loading, setLoading] = useState(!cachedLoaded);
  const [tableExists, setTableExists] = useState(cachedTableExists);

  useEffect(() => {
    function handleChange(newSettings, exists) {
      setSettings({ ...newSettings });
      setTableExists(exists);
      setLoading(false);
    }

    listeners.add(handleChange);

    if (!cachedLoaded) {
      fetchSiteSettings().then(() => setLoading(false));
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const saveSetting = useCallback(async (key, value) => {
    const { error } = await supabase.rpc('admin_save_setting', {
      p_key: key,
      p_value: value,
    });
    if (error) throw error;

    cachedSettings[key] = value;
    emit();
  }, []);

  const resetSetting = useCallback(async (key) => {
    const { error } = await supabase.rpc('admin_reset_setting', { p_key: key });
    if (error) throw error;

    cachedSettings[key] = DEFAULT_SITE_SETTINGS[key];
    emit();
  }, []);

  return {
    settings,
    loading,
    tableExists,
    saveSetting,
    resetSetting,
    refresh: fetchSiteSettings,
  };
}
