// Ambria FnB — Fruit-counter selection picker
//
// "3+3 Fruits" / "4 Indian Fruits" style dishes have no fixed recipe or
// inventory item — the specific fruits vary per function (whatever's in
// season). Instead of tagging them to a fixed SOP category, Fruits Ops picks
// the actual fruits FOR THIS FUNCTION from the real Ops inventory catalog
// (same catalog Dish Library's Inventory tab searches), and that selection is
// what Store & Inventory reads to know what to source/issue — see
// event_fruit_selections (MIGRATION_event_fruit_selections.sql) and
// StoreModule.jsx's buildEventBags, which folds these into the normal
// smart-issue pipeline via the existing ops_inventory_id direct-link path.
import React, { useState, useEffect } from 'react';
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { parseFruitSpec } from '../data/recipeData.js';
import { supabase } from '../lib/supabase.js';
import { getCateringStoreItemsCached } from '../lib/opsSupabase.js';

function FruitSelectionPicker({ eventId, dishName, lang = 'en' }) {
  const T2 = s => T(s, lang);
  const spec = parseFruitSpec(dishName) || { indian: 0, imported: 0 };
  const [rows, setRows] = useState([]); // rows from event_fruit_selections for this event+dish
  const [opsItems, setOpsItems] = useState([]);
  const [search, setSearch] = useState({ indian: '', imported: '' });
  const [saving, setSaving] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [selRes, items] = await Promise.all([
        supabase.from('event_fruit_selections').select('*').eq('event_id', eventId).eq('dish_name', dishName),
        getCateringStoreItemsCached(),
      ]);
      if (cancelled) return;
      if (!selRes.error) setRows(selRes.data || []);
      setOpsItems(items || []);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [eventId, dishName]);

  function picked(side) { return rows.filter(r => r.side === side); }

  async function addItem(side, item) {
    const already = picked(side).some(r => r.ops_item_id === item.id);
    if (already) return;
    if (picked(side).length >= spec[side]) { alert(T2('Already picked') + ' ' + spec[side] + '/' + spec[side] + ' ' + T2(side === 'indian' ? 'Indian' : 'Imported') + '.'); return; }
    setSaving(item.id);
    try {
      const row = {
        event_id: eventId, dish_name: dishName, side,
        ops_item_id: item.id, ops_item_name: item.name || '',
        ops_item_hindi: item.name_hindi || null,
        ops_item_unit: item.unit || 'Pieces',
        ops_inventory_id: item.inventory_id || null,
        qty_per_cover: 1,
      };
      const res = await supabase.from('event_fruit_selections').upsert(row, { onConflict: 'event_id,dish_name,ops_item_id' }).select();
      if (res.error) throw res.error;
      setRows(p => [...p, (res.data && res.data[0]) || row]);
      setSearch(p => ({ ...p, [side]: '' }));
    } catch (e) { alert(T2('Failed to save selection:') + ' ' + (e.message || e)); }
    finally { setSaving(''); }
  }

  async function removeItem(id, opsItemId) {
    setSaving(opsItemId);
    try {
      const res = await supabase.from('event_fruit_selections').delete().eq('id', id);
      if (res.error) throw res.error;
      setRows(p => p.filter(r => r.id !== id));
    } catch (e) { alert(T2('Failed to remove:') + ' ' + (e.message || e)); }
    finally { setSaving(''); }
  }

  async function setQty(id, qty) {
    const q = parseFloat(qty);
    if (!q || q <= 0) return;
    setRows(p => p.map(r => r.id === id ? { ...r, qty_per_cover: q } : r));
    try { await supabase.from('event_fruit_selections').update({ qty_per_cover: q }).eq('id', id); }
    catch (e) { /* non-fatal — local state already updated, will resync next load */ }
  }

  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8 }}>🍓 {dishName}</div>
      {!loaded ? (
        <div style={{ fontSize: 11, color: C.muted }}>{T2('Loading…')}</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <SideBlock side="indian" label={T2('Indian')} color="#2B8A50" need={spec.indian || 0}
            picked={picked('indian')} search={search.indian} setSearch={v => setSearch(p => ({ ...p, indian: v }))}
            opsItems={opsItems} saving={saving} addItem={addItem} removeItem={removeItem} setQty={setQty} T2={T2} />
          <SideBlock side="imported" label={T2('Imported')} color="#D97A3E" need={spec.imported || 0}
            picked={picked('imported')} search={search.imported} setSearch={v => setSearch(p => ({ ...p, imported: v }))}
            opsItems={opsItems} saving={saving} addItem={addItem} removeItem={removeItem} setQty={setQty} T2={T2} />
        </div>
      )}
    </div>
  );
}

// Module-level, NOT nested inside FruitSelectionPicker — a component defined
// inside another component's body is a fresh function identity every render,
// so React unmounts/remounts it (and its <input>) on every keystroke, which
// is exactly what made the search box lose focus after one character.
function SideBlock({ side, label, color, need, picked, search, setSearch, opsItems, saving, addItem, removeItem, setQty, T2 }) {
  if (need <= 0) return null;
  const q = (search || '').toLowerCase().trim();
  const results = q ? opsItems.filter(it => (it.name || '').toLowerCase().includes(q)).slice(0, 8) : [];
  const full = picked.length >= need;
  return (
    <div style={{ flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6 }}>{label} — {picked.length}/{need}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {picked.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, background: color + '15', border: `1px solid ${color}35` }}>
            <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{r.ops_item_name}</span>
            <input type="number" step="0.01" value={r.qty_per_cover} onChange={e => setQty(r.id, e.target.value)}
              style={{ width: 46, padding: '2px 4px', borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 10, textAlign: 'center' }} />
            <span style={{ fontSize: 9, color: C.muted }}>{r.ops_item_unit}/{T2('cover')}</span>
            <button onClick={() => removeItem(r.id, r.ops_item_id)} disabled={saving === r.ops_item_id}
              style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
          </div>
        ))}
      </div>
      {!full && (
        <div style={{ position: 'relative' }}>
          <input value={search || ''} onChange={e => setSearch(e.target.value)}
            placeholder={T2('Search fruit item…')}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 11, color: C.text, background: C.surface, boxSizing: 'border-box' }} />
          {q && (
            <div style={{ border: `1px solid ${C.borderLight}`, borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: 'auto', background: C.surface }}>
              {results.map(it => (
                <div key={it.id} onClick={() => addItem(side, it)}
                  style={{ padding: '6px 10px', fontSize: 11, cursor: 'pointer', borderBottom: `1px solid ${C.borderLight}`, color: C.text }}>
                  {it.name} <span style={{ color: C.faint, fontSize: 10 }}>{it.unit}</span>
                </div>
              ))}
              {results.length === 0 && <div style={{ padding: '8px 10px', fontSize: 11, color: C.muted }}>{T2('No matching items.')}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { FruitSelectionPicker };
