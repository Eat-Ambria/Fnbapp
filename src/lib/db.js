import { supabase } from './supabase.js'
import { enqueue } from './offlineQueue.js'

// Versioned cache key for staff busts old cached data on deploy
function cacheKey(table) {
  return table === 'staff' ? 'ambria_empdb_v10' : 'ambria_' + table;
}

// A write that fails because the device is offline is RETRYABLE -- queuing it
// for replay is correct, and the whole point of the offline queue. A write
// that fails because Supabase actually responded (a constraint violation, RLS
// denial, bad payload -- anything PostgREST returns a real error for) is NOT
// retryable by just waiting: it will fail the exact same way every single
// time it's replayed. Queuing those "forever" is what let the menu_package
// bug (and others like it) sit silently broken through six save attempts
// with nothing ever telling anyone. A PostgREST/Postgres error that actually
// reached the server carries a `.code` (e.g. '23502' not-null, '23505'
// unique, '42501' insufficient privilege); a genuine network failure never
// gets a response to carry one, so it has no `.code`.
function isOfflineError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (e && e.code) return false;
  return true;
}

export async function dbLoad(table, fallback = []) {
  const key = cacheKey(table);
  if (!supabase) {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : fallback;
    } catch(e) { return fallback; }
  }
  // Date-scoping for high-growth tables: newest first, last 90 days. Older
  // data fetched on demand.
  let q = supabase.from(table).select('*').range(0, 49999);
  if (table === 'ingredient_usage_log') {
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
    if (isOfflineError(e)) {
      console.warn('dbUpsert offline-queued:', table, e.message||e);
      await enqueue({ action: 'upsert', table, record, conflictKey });
      return;
    }
    console.error('dbUpsert failed (not retryable, not queued):', table, e.message||e);
    throw e;
  }
}

// Use this instead of dbUpsert whenever the row is already known to exist and
// `record` is only a PARTIAL patch (some columns, not all). Postgres validates
// NOT NULL/CHECK constraints against the full proposed row BEFORE it even
// looks at ON CONFLICT, so PostgREST's upsert(partialRecord) throws on any
// table with a NOT NULL column the patch doesn't happen to include -- found
// live via events: a patch of just {id, menu_package} 400'd with "null value
// in column guest violates not-null constraint" and silently queued offline
// forever, even though the row already existed and only menu_package needed
// to change. A real UPDATE only touches the columns named in the SET clause
// and never re-validates the columns it doesn't touch.
export async function dbUpdate(table, record, conflictKey = 'id') {
  try { localStorage.setItem('ambria_' + table + '_dirty', 'true'); } catch(e) {}
  if (!supabase) {
    await enqueue({ action: 'update', table, record, conflictKey });
    return;
  }
  try {
    const { error } = await supabase.from(table).update(record).eq(conflictKey, record[conflictKey]);
    if (error) throw error;
  } catch(e) {
    if (isOfflineError(e)) {
      console.warn('dbUpdate offline-queued:', table, e.message||e);
      await enqueue({ action: 'update', table, record, conflictKey });
      return;
    }
    console.error('dbUpdate failed (not retryable, not queued):', table, e.message||e);
    throw e;
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
    if (isOfflineError(e)) {
      console.warn('dbDelete offline-queued:', table, e.message||e);
      await enqueue({ action: 'delete', table, key, value });
      return;
    }
    console.error('dbDelete failed (not retryable, not queued):', table, e.message||e);
    throw e;
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
    if (isOfflineError(e)) {
      console.warn('dbInsert offline-queued:', table, e.message||e);
      await enqueue({ action: 'insert', table, record });
      return;
    }
    console.error('dbInsert failed (not retryable, not queued):', table, e.message||e);
    throw e;
  }
}

/**
 * Paginate a Supabase select through PostgREST's 1000-row cap.
 * Pass a builder function that returns a fresh query each call
 * (helper appends .range() per page). Throws on error.
 *
 *   const rows = await fetchAllRows(() =>
 *     supabase.from('events').select('*').gte('date', s).lte('date', e).order('date')
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

let dbSubscribeSeq = 0;
export function dbSubscribe(table, callback) {
  if (!supabase) return () => {};
  // Channel name used to be just `${table}-rt` — fine as long as only ONE
  // caller ever subscribed to a given table. BookedFunctionsView.jsx adding
  // its own `dbSubscribe('events', ...)` alongside App.jsx's existing one
  // broke that assumption: the second `.channel('events-rt')` call reused
  // the same topic name, and adding postgres_changes callbacks to it after
  // the first subscribe() had already gone through threw "cannot add
  // postgres_changes callbacks... after subscribe()". Each call now gets its
  // own topic so independent subscribers never collide.
  const channel = supabase
    .channel(table + '-rt-' + (dbSubscribeSeq++))
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
