import { supabase } from './supabaseClient';

export async function fetchDirectory(ids) {
  if (ids.length === 0) return {};
  const { data } = await supabase.from('member_directory').select('id, username, apartment').in('id', ids);
  const map = {};
  (data || []).forEach((row) => { map[row.id] = row; });
  return map;
}
