import { supabase } from './supabase.js'

// Versioned cache key for staff busts old cached data on deploy
function cacheKey(table) {
  return table === 'staff' ? 'ambria_empdb_v10' : 'ambria_' + table;
}

export async function dbLoad(table, fallback = []) {
  const key = cacheKey(table);
  if (!supabase) {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : fallback;
    } catch(e) { return fallback; }
  }
  const { data, error } = await supabase.from(table).select('*');
  if (error || !data) {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : fallback;
    } catch(e) { return fallback; }
  }
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  return data;
}

export async function dbUpsert(table, record, conflictKey = 'id') {
  try { localStorage.setItem('ambria_' + table + '_dirty', 'true'); } catch(e) {}
  if (!supabase) return;
  await supabase.from(table).upsert(record, { onConflict: conflictKey });
}

export async function dbDelete(table, key, value) {
  if (!supabase) return;
  await supabase.from(table).delete().eq(key, value);
}

export async function dbInsert(table, record) {
  if (!supabase) return;
  await supabase.from(table).insert(record);
}

export function dbSubscribe(table, callback) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(table + '-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
