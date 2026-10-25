/**
 * AMBRIA FnB — Offline Write Queue
 * 
 * Queues failed Supabase writes to IndexedDB.
 * Replays them in order when connectivity returns.
 * 
 * Usage:
 *   import { enqueue, replayQueue, getQueueSize } from './offlineQueue.js';
 *   
 *   // In db.js — on failed write:
 *   enqueue({ action: 'upsert', table, record, conflictKey });
 *   
 *   // In App.jsx — on reconnect:
 *   replayQueue(supabase);
 */

const DB_NAME = 'ambria_offline';
const STORE = 'write_queue';
const DB_VERSION = 1;

// Mirrors db.js's isOfflineError exactly (not imported — db.js imports
// enqueue() from this file, so importing back from db.js would be a
// circular dependency for one 4-line classifier). A write that fails
// because Supabase actually responded (a constraint violation, RLS denial,
// bad payload — anything PostgREST returns a real error for, carrying a
// `.code`) will fail the exact same way every time it's replayed; only a
// genuine connectivity failure is worth retrying.
function isOfflineError(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (e && e.code) return false;
  return true;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(entry) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ ...entry, ts: Date.now() });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch (e) {
    // IndexedDB unavailable — last resort: localStorage
    try {
      const key = 'ambria_offq';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ ...entry, ts: Date.now() });
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (_) {
      // Both IndexedDB and localStorage failed (private browsing, quota
      // exceeded) -- this write is genuinely gone with no way to retry it.
      // At minimum leave a trace; silently losing data with zero evidence
      // anywhere was the worst version of the original bug class.
      console.error('[offlineQueue] write lost -- IndexedDB and localStorage both unavailable:', entry.table, entry.action);
    }
  }
}

export async function replayQueue(supabase) {
  if (!supabase) return 0;
  let replayed = 0;

  // 1. Replay IndexedDB queue
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();

    for (const entry of all) {
      try {
        let ok = false, err = null;
        if (entry.action === 'upsert') {
          const { error } = await supabase.from(entry.table).upsert(entry.record, { onConflict: entry.conflictKey || 'id' });
          ok = !error; err = error;
        } else if (entry.action === 'update') {
          const key = entry.conflictKey || 'id';
          const { error } = await supabase.from(entry.table).update(entry.record).eq(key, entry.record[key]);
          ok = !error; err = error;
        } else if (entry.action === 'delete') {
          const { error } = await supabase.from(entry.table).delete().eq(entry.key, entry.value);
          ok = !error; err = error;
        } else if (entry.action === 'insert') {
          const { error } = await supabase.from(entry.table).insert(entry.record);
          ok = !error; err = error;
        }
        // A permanently-failing entry (a real PostgREST error, not a
        // connectivity blip) used to just sit here forever: this loop never
        // deleted it on failure and never broke out either, so it was
        // silently re-attempted on every single replayQueue() call (every
        // reconnect, every 2-minute poll) indefinitely — confirmed live as
        // the actual source of an endless stream of identical 400s for one
        // stale queued write, long after the code that originally caused it
        // was fixed. Drop it instead, the same retryable-vs-not distinction
        // dbUpsert already applies before ever queuing one.
        if (ok) {
          const db2 = await openDB();
          const tx2 = db2.transaction(STORE, 'readwrite');
          tx2.objectStore(STORE).delete(entry.id);
          await new Promise((res, rej) => { tx2.oncomplete = res; tx2.onerror = rej; });
          db2.close();
          replayed++;
        } else if (!isOfflineError(err)) {
          console.error('[offlineQueue] dropping permanently-failing queued write:', entry.table, entry.action, err?.message || err);
          const db2 = await openDB();
          const tx2 = db2.transaction(STORE, 'readwrite');
          tx2.objectStore(STORE).delete(entry.id);
          await new Promise((res, rej) => { tx2.oncomplete = res; tx2.onerror = rej; });
          db2.close();
        } else {
          break; // genuinely offline — stop here, preserve order for next time
        }
      } catch (_) {
        break; // stop on first failure — preserve order
      }
    }
  } catch (_) {}

  // 2. Replay localStorage fallback queue
  try {
    const key = 'ambria_offq';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    const remaining = [];
    for (const entry of arr) {
      try {
        let ok = false, err = null;
        if (entry.action === 'upsert') {
          const { error } = await supabase.from(entry.table).upsert(entry.record, { onConflict: entry.conflictKey || 'id' });
          ok = !error; err = error;
        } else if (entry.action === 'update') {
          const key = entry.conflictKey || 'id';
          const { error } = await supabase.from(entry.table).update(entry.record).eq(key, entry.record[key]);
          ok = !error; err = error;
        } else if (entry.action === 'delete') {
          const { error } = await supabase.from(entry.table).delete().eq(entry.key, entry.value);
          ok = !error; err = error;
        } else if (entry.action === 'insert') {
          const { error } = await supabase.from(entry.table).insert(entry.record);
          ok = !error; err = error;
        }
        // Same fix as the IndexedDB loop above: a permanently-failing entry
        // must not go back into `remaining`, or it sits here forever too.
        if (ok) replayed++;
        else if (!isOfflineError(err)) console.error('[offlineQueue] dropping permanently-failing queued write:', entry.table, entry.action, err?.message || err);
        else remaining.push(entry);
      } catch (_) {
        remaining.push(entry);
        break;
      }
    }
    localStorage.setItem(key, JSON.stringify(remaining));
  } catch (_) {}

  return replayed;
}

export async function getQueueSize() {
  let count = 0;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    count = await new Promise((res) => { req.onsuccess = () => res(req.result); req.onerror = () => res(0); });
    db.close();
  } catch (_) {}
  try {
    count += JSON.parse(localStorage.getItem('ambria_offq') || '[]').length;
  } catch (_) {}
  return count;
}