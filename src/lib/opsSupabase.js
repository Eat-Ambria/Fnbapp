// Ambria FnB — Ops Supabase client (shared) + V62 catering-item lite cache
// Consolidates the client that was previously local to StoreModule.jsx so
// DishLibrary (V62 store picker) and any future Ops-inventory consumer
// share a single instance.

import { createClient } from '@supabase/supabase-js';
import { OPS_SUPABASE_URL, OPS_SUPABASE_KEY } from '../data/constants.js';

export const opsSupabase = (OPS_SUPABASE_URL && OPS_SUPABASE_KEY)
  ? createClient(OPS_SUPABASE_URL, OPS_SUPABASE_KEY)
  : null;

const CACHE_KEY = 'ambria_ops_catering_items';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Lite fetch — only the fields the V62 store-item picker needs.
 * status='approved' filter, sorted by name. No joins, no venues → fast.
 */
export async function fetchCateringStoreItemsLite() {
  if (!opsSupabase) return [];
  const SELECT = 'id,name,name_hindi,unit,brand,pack_size_qty,pack_size_unit';
  let all = [], from = 0, PAGE = 1000;
  while (true) {
    const { data, error } = await opsSupabase
      .from('catering_store_items')
      .select(SELECT)
      .eq('status', 'approved')
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error('Ops lite fetch error:', error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * 5-min TTL localStorage cache wrapper.
 * @param {boolean} force  bypass cache and refetch
 */
export async function getCateringStoreItemsCached(force) {
  try {
    if (!force) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ts && (Date.now() - parsed.ts) < CACHE_TTL_MS && Array.isArray(parsed.items)) {
          return parsed.items;
        }
      }
    }
  } catch (e) { /* cache read errors are non-fatal */ }
  const items = await fetchCateringStoreItemsLite();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items: items }));
  } catch (e) { /* storage full etc — non-fatal */ }
  return items;
}

export function clearCateringStoreItemsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
}