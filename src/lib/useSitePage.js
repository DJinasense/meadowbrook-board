import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { SITE_PAGE_DEFAULTS } from './puckConfig';

const cachedPages = {};
let cachedTableExists = true;
const listeners = new Set();

function emit(pageId, data, tableExists) {
  listeners.forEach((fn) => fn(pageId, data, tableExists));
}

function getDefaultData(pageId) {
  if (SITE_PAGE_DEFAULTS[pageId]) {
    return SITE_PAGE_DEFAULTS[pageId];
  }
  return {
    content: [
      {
        type: 'PageHeader',
        props: {
          id: `hdr-${pageId}`,
          title: pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, ' '),
          subtitle: 'Building 7 community document.',
          tag: 'Building 7',
        },
      },
      {
        type: 'RichText',
        props: {
          id: `txt-${pageId}`,
          content: 'This page is ready for content. Click "Visual Page Editor" as an admin to customize and publish sections.',
          align: 'left',
        },
      },
      {
        type: 'Footer',
        props: {
          id: `ftr-${pageId}`,
          text: 'MeadowBrook Building 7 Community',
        },
      },
    ],
    root: {
      props: {
        title: pageId.charAt(0).toUpperCase() + pageId.slice(1).replace(/-/g, ' '),
      },
    },
  };
}

export async function fetchSitePage(pageId = 'landing') {
  const fallback = getDefaultData(pageId);
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
      cachedPages[pageId] = fallback;
      emit(pageId, fallback, cachedTableExists);
      return { data: fallback, tableExists: cachedTableExists };
    }

    if (data && data.data && Array.isArray(data.data.content)) {
      cachedPages[pageId] = data.data;
      cachedTableExists = true;
    } else {
      cachedPages[pageId] = fallback;
      cachedTableExists = true;
    }

    emit(pageId, cachedPages[pageId], cachedTableExists);
    return { data: cachedPages[pageId], tableExists: true };
  } catch (err) {
    console.warn(`fetchSitePage (${pageId}) error:`, err);
    cachedPages[pageId] = fallback;
    emit(pageId, fallback, cachedTableExists);
    return { data: fallback, tableExists: cachedTableExists };
  }
}

export function useSitePage(pageId = 'landing') {
  const initial = cachedPages[pageId] || getDefaultData(pageId);
  const [pageData, setPageData] = useState(initial);
  const [loading, setLoading] = useState(!cachedPages[pageId]);
  const [tableExists, setTableExists] = useState(cachedTableExists);

  useEffect(() => {
    function handleChange(id, newData, exists) {
      if (id === pageId) {
        setPageData(newData);
        setTableExists(exists);
        setLoading(false);
      }
    }

    listeners.add(handleChange);

    if (!cachedPages[pageId]) {
      fetchSitePage(pageId).then(() => setLoading(false));
    } else {
      setPageData(cachedPages[pageId]);
      setLoading(false);
    }

    return () => {
      listeners.delete(handleChange);
    };
  }, [pageId]);

  const savePage = useCallback(async (id, title, data) => {
    const targetId = id || pageId;
    const { error } = await supabase.rpc('admin_save_page', {
      p_id: targetId,
      p_title: title || targetId,
      p_data: data,
    });
    if (error) throw error;
    cachedPages[targetId] = data;
    emit(targetId, data, true);
  }, [pageId]);

  const resetPage = useCallback(async (id) => {
    const targetId = id || pageId;
    const { error } = await supabase.rpc('admin_reset_page', { p_id: targetId });
    if (error) throw error;
    const fallback = getDefaultData(targetId);
    cachedPages[targetId] = fallback;
    emit(targetId, fallback, true);
  }, [pageId]);

  return {
    pageData,
    loading,
    tableExists,
    savePage,
    resetPage,
    refresh: () => fetchSitePage(pageId),
  };
}
