import { supabase } from './supabase.js'
import { enqueue } from './offlineQueue.js'

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
  // Date-scoping for high-growth tables: newest first, last 90 days (attendance)
  // or last 180 days for events. Older data fetched on demand.
  let q = supabase.from(table).select('*').range(0, 49999);
  if (table === 'attendance') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0,10);
    q = supabase.from(table).select('*').gte('date', cutoffStr).order('date', { ascending: false }).range(0, 49999);
  } else if (table === 'ingredient_usage_log') {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    q = supabase.from(table).select('*').gte('created_at', cutoff.toISOString()).order('created_at', { ascending: false }).range(0, 49999);
  }
  const { data, error } = await q;
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
  if (!supabase) {
    await enqueue({ action: 'upsert', table, record, conflictKey });
    return;
  }
  try {
    const { error } = await supabase.from(table).upsert(record, { onConflict: conflictKey });
    if (error) throw error;
  } catch(e) {
    console.warn('dbUpsert offline-queued:', table, e.message||e);
    await enqueue({ action: 'upsert', table, record, conflictKey });
  }
}

export async function dbDelete(table, key, value) {
  if (!supabase) {
    await enqueue({ action: 'delete', table, key, value });
    return;
  }
  try {
    const { error } = await supabase.from(table).delete().eq(key, value);
    if (error) throw error;
  } catch(e) {
    console.warn('dbDelete offline-queued:', table, e.message||e);
    await enqueue({ action: 'delete', table, key, value });
  }
}

export async function dbInsert(table, record) {
  if (!supabase) {
    await enqueue({ action: 'insert', table, record });
    return;
  }
  try {
    const { error } = await supabase.from(table).insert(record);
    if (error) throw error;
  } catch(e) {
    console.warn('dbInsert offline-queued:', table, e.message||e);
    await enqueue({ action: 'insert', table, record });
  }
}

/**
 * Paginate a Supabase select through PostgREST's 1000-row cap.
 * Pass a builder function that returns a fresh query each call
 * (helper appends .range() per page). Throws on error.
 *
 *   const rows = await fetchAllRows(() =>
 *     supabase.from('attendance').select('*').gte('date', s).lte('date', e).order('date')
 *   );
 */
export async function fetchAllRows(builder, opts = {}) {
  const pageSize = opts.pageSize || 1000;
  const maxRows  = opts.maxRows  || 100000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
    if (all.length >= maxRows) {
      console.warn('[fetchAllRows] maxRows cap hit at', maxRows, '— increase opts.maxRows if intentional');
      break;
    }
  }
  return all;
}

export function dbSubscribe(table, callback) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(table + '-rt')
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
