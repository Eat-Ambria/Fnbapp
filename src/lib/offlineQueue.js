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
    } catch (_) {}
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
        let ok = false;
        if (entry.action === 'upsert') {
          const { error } = await supabase.from(entry.table).upsert(entry.record, { onConflict: entry.conflictKey || 'id' });
          ok = !error;
        } else if (entry.action === 'delete') {
          const { error } = await supabase.from(entry.table).delete().eq(entry.key, entry.value);
          ok = !error;
        } else if (entry.action === 'insert') {
          const { error } = await supabase.from(entry.table).insert(entry.record);
          ok = !error;
        }
        if (ok) {
          // Remove from queue
          const db2 = await openDB();
          const tx2 = db2.transaction(STORE, 'readwrite');
          tx2.objectStore(STORE).delete(entry.id);
          await new Promise((res, rej) => { tx2.oncomplete = res; tx2.onerror = rej; });
          db2.close();
          replayed++;
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
        let ok = false;
        if (entry.action === 'upsert') {
          const { error } = await supabase.from(entry.table).upsert(entry.record, { onConflict: entry.conflictKey || 'id' });
          ok = !error;
        } else if (entry.action === 'delete') {
          const { error } = await supabase.from(entry.table).delete().eq(entry.key, entry.value);
          ok = !error;
        } else if (entry.action === 'insert') {
          const { error } = await supabase.from(entry.table).insert(entry.record);
          ok = !error;
        }
        if (ok) replayed++;
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