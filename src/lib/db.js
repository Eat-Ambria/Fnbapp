import { supabase } from './supabase.js'

export async function dbLoad(table, fallback = []) {
  if (!supabase) {
    try {
      const cached = localStorage.getItem('ambria_' + table);
      return cached ? JSON.parse(cached) : fallback;
    } catch(e) { return fallback; }
  }
  const { data, error } = await supabase.from(table).select('*');
  if (error || !data) {
    try {
      const cached = localStorage.getItem('ambria_' + table);
      return cached ? JSON.parse(cached) : fallback;
    } catch(e) { return fallback; }
  }
  try { localStorage.setItem('ambria_' + table, JSON.stringify(data)); } catch(e) {}
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
