import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

export const SITE_COPY_DEFAULTS = {
  'landing.hero.1': 'Neighborly built, hosted, and maintained — Community Board.',
  'landing.hero.2': 'Fueled by transparency, authenticity, anonymity, if need be.',
  'landing.hero.3': 'Our Build. Your Voice.',
  'landing.general.1': 'Open to neighbors. Start a thread, read a thread, join in a conversation.',
  'landing.general.2': 'See something, say something.',
  'landing.general.3': 'No account required.',
  'landing.general.4': 'Post with name, unit number, or anonymously.',
  'landing.members.intro': 'Register as a Building 7 resident. Sign up with your unit number to get in.',
  'landing.members.posting': 'Members can post under their name, unit #, or anonymously.',
  'landing.footer': 'Building 7 · If you see something, say something',
};

export const SITE_COPY_SECTIONS = [
  {
    id: 'hero',
    title: 'Landing Hero Header',
    description: 'Header text displayed below the building title on the landing page.',
    items: [
      { key: 'landing.hero.1', label: 'Hero line 1', default: SITE_COPY_DEFAULTS['landing.hero.1'] },
      { key: 'landing.hero.2', label: 'Hero line 2', default: SITE_COPY_DEFAULTS['landing.hero.2'] },
      { key: 'landing.hero.3', label: 'Hero line 3', default: SITE_COPY_DEFAULTS['landing.hero.3'] },
    ],
  },
  {
    id: 'general',
    title: 'General Board Card',
    description: 'Bullet points and descriptions on the public General Board card.',
    items: [
      { key: 'landing.general.1', label: 'Line 1 (Invitation)', default: SITE_COPY_DEFAULTS['landing.general.1'] },
      { key: 'landing.general.2', label: 'Line 2 (Community note)', default: SITE_COPY_DEFAULTS['landing.general.2'] },
      { key: 'landing.general.3', label: 'Line 3 (Access note)', default: SITE_COPY_DEFAULTS['landing.general.3'] },
      { key: 'landing.general.4', label: 'Line 4 (Identity options)', default: SITE_COPY_DEFAULTS['landing.general.4'] },
    ],
  },
  {
    id: 'members',
    title: 'Members Board Card',
    description: 'Intro and guidelines text displayed on the Members Board card.',
    items: [
      { key: 'landing.members.intro', label: 'Intro line', default: SITE_COPY_DEFAULTS['landing.members.intro'] },
      { key: 'landing.members.posting', label: 'Posting note', default: SITE_COPY_DEFAULTS['landing.members.posting'] },
    ],
  },
  {
    id: 'footer',
    title: 'Landing Footer',
    description: 'Small footer note displayed at the very bottom of the landing page.',
    items: [
      { key: 'landing.footer', label: 'Footer text', default: SITE_COPY_DEFAULTS['landing.footer'] },
    ],
  },
];

// In-memory cache shared across components
let globalCopyMap = {};
let globalLoaded = false;
let globalTableExists = true;
const listeners = new Set();

function emitChange() {
  listeners.forEach((fn) => fn(globalCopyMap, globalTableExists));
}

export async function fetchSiteCopy() {
  try {
    const { data, error } = await supabase.from('site_copy').select('key, value');
    if (error) {
      // PGRST205 / 42P01: relation "public.site_copy" does not exist yet
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        globalTableExists = false;
      } else {
        console.warn('Could not load site_copy:', error.message);
      }
      globalLoaded = true;
      emitChange();
      return { copyMap: globalCopyMap, tableExists: globalTableExists };
    }

    const map = {};
    (data || []).forEach((row) => {
      if (row.key && typeof row.value === 'string') {
        map[row.key] = row.value;
      }
    });

    globalCopyMap = map;
    globalTableExists = true;
    globalLoaded = true;
    emitChange();
    return { copyMap: map, tableExists: true };
  } catch (err) {
    console.warn('fetchSiteCopy exception:', err);
    globalLoaded = true;
    emitChange();
    return { copyMap: globalCopyMap, tableExists: globalTableExists };
  }
}

export function useSiteCopy() {
  const [copyMap, setCopyMap] = useState(globalCopyMap);
  const [loading, setLoading] = useState(!globalLoaded);
  const [tableExists, setTableExists] = useState(globalTableExists);

  useEffect(() => {
    function handleChange(newMap, exists) {
      setCopyMap({ ...newMap });
      setTableExists(exists);
      setLoading(false);
    }

    listeners.add(handleChange);

    if (!globalLoaded) {
      fetchSiteCopy().then(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const copy = useCallback((key, fallback) => {
    if (copyMap && Object.prototype.hasOwnProperty.call(copyMap, key)) {
      return copyMap[key];
    }
    if (fallback !== undefined) return fallback;
    return SITE_COPY_DEFAULTS[key] ?? '';
  }, [copyMap]);

  const saveCopy = useCallback(async (key, value) => {
    if (!key || typeof value !== 'string') throw new Error('Invalid key or value');
    if (value.length > 500) throw new Error('Keep each line under 500 characters');

    const { error } = await supabase.rpc('admin_set_copy', { p_key: key, p_value: value });
    if (error) throw error;

    globalCopyMap[key] = value;
    emitChange();
  }, []);

  const resetCopy = useCallback(async (key) => {
    if (!key) throw new Error('Invalid key');

    const { error } = await supabase.rpc('admin_reset_copy', { p_key: key });
    if (error) throw error;

    delete globalCopyMap[key];
    emitChange();
  }, []);

  return {
    copy,
    copyMap,
    loading,
    tableExists,
    saveCopy,
    resetCopy,
    refresh: fetchSiteCopy,
  };
}
