import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { DEFAULT_LANDING_PUCK_DATA } from './puckConfig';

let cachedPageData = null;
let cachedTableExists = true;
const listeners = new Set();

function emit(data, tableExists) {
  listeners.forEach((fn) => fn(data, tableExists));
}

export async function fetchSitePage(pageId = 'landing') {
  try {
    const { data, error } = await supabase
      .from('site_pages')
      .select('id, title, data, updated_at')
      .eq('id', pageId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
        cachedTableExists = false;
      }
      cachedPageData = DEFAULT_LANDING_PUCK_DATA;
      emit(cachedPageData, cachedTableExists);
      return { data: DEFAULT_LANDING_PUCK_DATA, tableExists: cachedTableExists };
    }

    if (data && data.data && Array.isArray(data.data.content)) {
      cachedPageData = data.data;
      cachedTableExists = true;
    } else {
      cachedPageData = DEFAULT_LANDING_PUCK_DATA;
      cachedTableExists = true;
    }

    emit(cachedPageData, cachedTableExists);
    return { data: cachedPageData, tableExists: true };
  } catch (err) {
    console.warn('fetchSitePage error:', err);
    cachedPageData = DEFAULT_LANDING_PUCK_DATA;
    emit(cachedPageData, cachedTableExists);
    return { data: DEFAULT_LANDING_PUCK_DATA, tableExists: cachedTableExists };
  }
}

export function useSitePage(pageId = 'landing') {
  const [pageData, setPageData] = useState(cachedPageData || DEFAULT_LANDING_PUCK_DATA);
  const [loading, setLoading] = useState(!cachedPageData);
  const [tableExists, setTableExists] = useState(cachedTableExists);

  useEffect(() => {
    function handleChange(newData, exists) {
      setPageData(newData);
      setTableExists(exists);
      setLoading(false);
    }

    listeners.add(handleChange);

    if (!cachedPageData) {
      fetchSitePage(pageId).then(() => setLoading(false));
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, [pageId]);

  const savePage = useCallback(async (id, title, data) => {
    const { error } = await supabase.rpc('admin_save_page', {
      p_id: id,
      p_title: title || 'Page',
      p_data: data,
    });
    if (error) throw error;
    cachedPageData = data;
    emit(data, true);
  }, []);

  const resetPage = useCallback(async (id) => {
    const { error } = await supabase.rpc('admin_reset_page', { p_id: id });
    if (error) throw error;
    cachedPageData = DEFAULT_LANDING_PUCK_DATA;
    emit(DEFAULT_LANDING_PUCK_DATA, true);
  }, []);

  return {
    pageData,
    loading,
    tableExists,
    savePage,
    resetPage,
    refresh: () => fetchSitePage(pageId),
  };
}
