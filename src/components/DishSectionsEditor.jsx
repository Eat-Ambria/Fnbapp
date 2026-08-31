// Ambria FnB — Dish Library → Sections tab (V73)
// Master print-menu catalogue: define sections per department, assign dishes,
// order both. Menu Builder loads this as the base grid for every proposal.
//
// Features
// - Dept picker (Kitchen active; Beverage/Bakery/Fruits reserved)
// - Add / rename / delete sections
// - Reorder sections (▲▼ buttons)
// - Expand section → dish list with reorder + move-to-section dropdown
// - Merge dialog: move all dishes to target section, then delete source
// - Unassigned bucket pinned at bottom (any dish with section_id=null)
// - Realtime subscription — multi-admin edits stay in sync
//
// Schema deps (V72 migration): dish_catalogue_sections (id, dept, name,
// sort_order, sop_category_hint) + dishes_master.section_id +
// dishes_master.sort_in_section

import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';

const DEPTS = [
  { id: 'kitchen',  label: 'Kitchen',  icon: '🍲' },
  { id: 'beverage', label: 'Beverage', icon: '🥤' },
  { id: 'bakery',   label: 'Bakery',   icon: '🥧' },
  { id: 'fruits',   label: 'Fruits',   icon: '🍎' },
];

function DishSectionsEditor(props) {
  const lang = props.lang || 'en';
  const T2 = function(s) { return T(s, lang); };
  const isAdmin = props.currentUser && (props.currentUser.role === 'admin' || props.currentUser.role === 'headchef');

  const [dept, setDept] = useState('kitchen');
  const [sections, setSections] = useState([]);
  const [dishAssignments, setDishAssignments] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [addingSection, setAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [mergeModal, setMergeModal] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  // ── Data ────────────────────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    try {
      const results = await Promise.all([
        fetchAllRows(function(){ return supabase.from('dish_catalogue_sections').select('*').eq('dept', dept).order('sort_order', { ascending: true }); }),
        fetchAllRows(function(){ return supabase.from('dishes_master').select('dish_name, section_id, sort_in_section, is_active').eq('is_active', true); })
      ]);
      setSections(results[0] || []);
      const assignments = {};
      (results[1] || []).forEach(function(d){ assignments[d.dish_name] = { section_id: d.section_id, sort_in_section: d.sort_in_section || 0 }; });
      setDishAssignments(assignments);
    } catch (e) {
      console.error('[Sections] load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadData(); /* eslint-disable-next-line */ }, [dept]);

  // Realtime — reload on any change to sections or dish assignments
  useEffect(function(){
    if (!supabase) return function(){};
    const ch = supabase.channel('sections_editor_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_catalogue_sections' }, function(){ loadData(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'dishes_master' }, function(){ loadData(); })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, [dept]);

  // Group dishes by section
  const dishesBySection = useMemo(function(){
    const map = {};
    Object.keys(dishAssignments).forEach(function(dishName){
      const a = dishAssignments[dishName];
      const key = a.section_id || '__unassigned__';
      if (!map[key]) map[key] = [];
      map[key].push({ name: dishName, sort: a.sort_in_section || 0 });
    });
    Object.keys(map).forEach(function(k){
      map[k].sort(function(a, b){ return (a.sort - b.sort) || a.name.localeCompare(b.name); });
    });
    return map;
  }, [dishAssignments]);

  const unassignedList = dishesBySection['__unassigned__'] || [];

  // ── Actions ────────────────────────────────────────────────────────
  async function addSection() {
    if (!isAdmin || !newSectionName.trim()) return;
    setSaving(true);
    try {
      const maxSort = sections.reduce(function(m, s){ return Math.max(m, s.sort_order || 0); }, 0);
      const { error } = await supabase.from('dish_catalogue_sections').insert({
        dept: dept, name: newSectionName.trim(), sort_order: maxSort + 10
      });
      if (error) throw error;
      setNewSectionName(''); setAddingSection(false);
    } catch (e) { alert('Add failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function renameSection(id) {
    if (!isAdmin || !renameValue.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('dish_catalogue_sections')
        .update({ name: renameValue.trim(), updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      setRenamingId(null); setRenameValue('');
    } catch (e) { alert('Rename failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function deleteSection(sec) {
    if (!isAdmin) return;
    const dishCount = (dishesBySection[sec.id] || []).length;
    const msg = dishCount > 0
      ? 'Delete "' + sec.name + '"? Its ' + dishCount + ' dish' + (dishCount === 1 ? '' : 'es') + ' will move to Unassigned.'
      : 'Delete "' + sec.name + '"?';
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('dish_catalogue_sections').delete().eq('id', sec.id);
      if (error) throw error;
    } catch (e) { alert('Delete failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function moveSection(sec, dir) {
    if (!isAdmin) return;
    const idx = sections.findIndex(function(s){ return s.id === sec.id; });
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    const target = sections[targetIdx];
    setSaving(true);
    try {
      await supabase.from('dish_catalogue_sections').update({ sort_order: target.sort_order }).eq('id', sec.id);
      await supabase.from('dish_catalogue_sections').update({ sort_order: sec.sort_order }).eq('id', target.id);
    } catch (e) { alert('Move failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function moveDish(dishName, direction, currentSectionId) {
    if (!isAdmin) return;
    const list = dishesBySection[currentSectionId || '__unassigned__'] || [];
    const idx = list.findIndex(function(d){ return d.name === dishName; });
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const target = list[targetIdx];
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('dishes_master').update({ sort_in_section: target.sort }).eq('dish_name', dishName),
        supabase.from('dishes_master').update({ sort_in_section: list[idx].sort }).eq('dish_name', target.name)
      ]);
    } catch (e) { alert('Reorder failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function assignDishToSection(dishName, newSectionId) {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const targetList = dishesBySection[newSectionId] || [];
      const maxSort = targetList.reduce(function(m, d){ return Math.max(m, d.sort || 0); }, 0);
      const { error } = await supabase.from('dishes_master')
        .update({ section_id: newSectionId, sort_in_section: maxSort + 10 })
        .eq('dish_name', dishName);
      if (error) throw error;
    } catch (e) { alert('Move failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function unassignDish(dishName) {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('dishes_master')
        .update({ section_id: null, sort_in_section: null })
        .eq('dish_name', dishName);
      if (error) throw error;
    } catch (e) { alert('Unassign failed: ' + e.message); }
    finally { setSaving(false); }
  }

  async function doMerge() {
    if (!isAdmin || !mergeModal || !mergeTargetId) return;
    const targetList = dishesBySection[mergeTargetId] || [];
    const maxSort = targetList.reduce(function(m, d){ return Math.max(m, d.sort || 0); }, 0);
    const sourceDishes = dishesBySection[mergeModal.sourceId] || [];
    setSaving(true);
    try {
      for (let i = 0; i < sourceDishes.length; i++) {
        const d = sourceDishes[i];
        const { error } = await supabase.from('dishes_master')
          .update({ section_id: mergeTargetId, sort_in_section: maxSort + (i + 1) * 10 })
          .eq('dish_name', d.name);
        if (error) throw error;
      }
      const { error: delErr } = await supabase.from('dish_catalogue_sections').delete().eq('id', mergeModal.sourceId);
      if (delErr) throw delErr;
      setMergeModal(null); setMergeTargetId('');
    } catch (e) { alert('Merge failed: ' + e.message); }
    finally { setSaving(false); }
  }

  function toggleExpand(id) {
    setExpanded(function(p){ const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }

  // ── Render ────────────────────────────────────────────────────────
  function dishRow(dish, sectionId, idx, total) {
    const isUnassigned = sectionId === '__unassigned__';
    return (
      <div key={dish.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px 6px 40px', borderTop: idx > 0 ? '0.5px solid ' + C.borderLight : 0, fontSize: 12 }}>
        {isAdmin && !isUnassigned && (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 1 }}>
            <button onClick={function(){ moveDish(dish.name, -1, sectionId); }} disabled={saving || idx === 0}
              style={{ background: 'transparent', border: 0, cursor: idx === 0 ? 'not-allowed' : 'pointer', padding: 0, fontSize: 9, color: C.muted, lineHeight: 1, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
            <button onClick={function(){ moveDish(dish.name, 1, sectionId); }} disabled={saving || idx === total - 1}
              style={{ background: 'transparent', border: 0, cursor: idx === total - 1 ? 'not-allowed' : 'pointer', padding: 0, fontSize: 9, color: C.muted, lineHeight: 1, opacity: idx === total - 1 ? 0.3 : 1 }}>▼</button>
          </div>
        )}
        <span style={{ flex: 1, color: C.text }}>{dish.name}</span>
        {isAdmin && (
          <select value=""
            onChange={function(e){ const v = e.target.value; if (v === '__unassign__') unassignDish(dish.name); else if (v) assignDishToSection(dish.name, v); e.target.value = ''; }}
            style={{ fontSize: 11, padding: '2px 6px', border: '1px solid ' + C.border, borderRadius: 6, background: C.surface, color: C.muted, cursor: 'pointer' }}>
            <option value="">{isUnassigned ? 'Assign to…' : 'Move to…'}</option>
            {sections.map(function(s){ return <option key={s.id} value={s.id} disabled={s.id === sectionId}>{s.name}</option>; })}
            {!isUnassigned && <option value="__unassign__">— Unassign</option>}
          </select>
        )}
      </div>
    );
  }

  function sectionRow(sec) {
    const dishes = dishesBySection[sec.id] || [];
    const isExpanded = expanded.has(sec.id);
    const isRenaming = renamingId === sec.id;
    const otherCount = sections.length - 1;
    const printPos = Math.floor((sec.sort_order || 0) / 10);
    return (
      <div key={sec.id} style={{ background: C.surface, border: '0.5px solid ' + C.border, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          {isAdmin && (
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={function(){ moveSection(sec, -1); }} disabled={saving} title="Move up"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontSize: 10, color: C.muted, lineHeight: 1 }}>▲</button>
              <button onClick={function(){ moveSection(sec, 1); }} disabled={saving} title="Move down"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontSize: 10, color: C.muted, lineHeight: 1 }}>▼</button>
            </div>
          )}
          <span style={{ cursor: 'pointer', color: C.muted, fontSize: 11, padding: '0 2px' }} onClick={function(){ toggleExpand(sec.id); }}>
            {isExpanded ? '▾' : '▸'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 22, padding: '0 6px', borderRadius: 6, background: C.darkCard, fontSize: 11, fontWeight: 500, color: C.muted }}>
            {printPos}
          </span>
          {isRenaming ? (
            <>
              <input value={renameValue} onChange={function(e){ setRenameValue(e.target.value); }} autoFocus
                onKeyDown={function(e){ if (e.key === 'Enter') renameSection(sec.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                style={{ flex: 1, padding: '3px 8px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13 }} />
              <button onClick={function(){ renameSection(sec.id); }} disabled={saving} style={{ fontSize: 11, padding: '4px 10px', background: C.green, color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>Save</button>
              <button onClick={function(){ setRenamingId(null); setRenameValue(''); }} style={{ fontSize: 11, padding: '4px 10px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1, cursor: 'pointer' }} onClick={function(){ toggleExpand(sec.id); }}>{sec.name}</span>
              {sec.sop_category_hint && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#E7F0F7', color: '#1E5A8F', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SOP · {sec.sop_category_hint}</span>}
              <span style={{ fontSize: 11, color: C.muted }}>{dishes.length} dish{dishes.length === 1 ? '' : 'es'}</span>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 2 }}>
                  <button onClick={function(){ setRenamingId(sec.id); setRenameValue(sec.name); }} title="Rename"
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '2px 6px', fontSize: 12, color: C.muted, borderRadius: 4 }}>✎</button>
                  <button onClick={function(){ setMergeModal({ sourceId: sec.id, sourceName: sec.name, dishCount: dishes.length }); setMergeTargetId(''); }} title="Merge into another section" disabled={otherCount === 0}
                    style={{ background: 'transparent', border: 0, cursor: otherCount === 0 ? 'not-allowed' : 'pointer', padding: '2px 6px', fontSize: 12, color: C.muted, opacity: otherCount === 0 ? 0.3 : 1, borderRadius: 4 }}>⇄</button>
                  <button onClick={function(){ deleteSection(sec); }} title="Delete section"
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '2px 6px', fontSize: 14, color: C.muted, borderRadius: 4 }}>×</button>
                </div>
              )}
            </>
          )}
        </div>
        {isExpanded && dishes.length > 0 && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight }}>
            {dishes.map(function(d, di){ return dishRow(d, sec.id, di, dishes.length); })}
          </div>
        )}
        {isExpanded && dishes.length === 0 && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight, padding: '10px 12px', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
            No dishes assigned yet. Move dishes here from Unassigned or from other sections using the dropdown.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Dept picker */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {DEPTS.map(function(d){
          const active = dept === d.id;
          const disabled = d.id !== 'kitchen';
          return (
            <button key={d.id} onClick={function(){ if (!disabled) setDept(d.id); }} disabled={disabled}
              style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? '#FAEEDA' : C.surface, border: '0.5px solid ' + (active ? '#EF9F27' : C.border),
                color: active ? '#633806' : disabled ? C.faint : C.muted, opacity: disabled ? 0.5 : 1, fontWeight: active ? 500 : 400 }}>
              {d.icon} {d.label}{disabled ? ' (soon)' : ''}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.darkCard, borderRadius: 8, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: C.muted }}>
          <b style={{ color: C.text }}>{DEPTS.find(function(d){ return d.id === dept; }).label} catalogue</b>
          {' · '}{sections.length} sections
          {unassignedList.length > 0 && <> · <span style={{ color: C.red, fontWeight: 500 }}>{unassignedList.length} unassigned</span></>}
        </span>
        <div style={{ flex: 1 }} />
        {isAdmin && !addingSection && (
          <button onClick={function(){ setAddingSection(true); }}
            style={{ padding: '6px 14px', background: C.gold, color: '#fff', border: 0, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            + Add section
          </button>
        )}
        {isAdmin && addingSection && (
          <>
            <input value={newSectionName} onChange={function(e){ setNewSectionName(e.target.value); }} placeholder="Section name…" autoFocus
              onKeyDown={function(e){ if (e.key === 'Enter') addSection(); if (e.key === 'Escape') { setAddingSection(false); setNewSectionName(''); } }}
              style={{ padding: '5px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, minWidth: 200 }} />
            <button onClick={addSection} disabled={saving || !newSectionName.trim()}
              style={{ padding: '5px 12px', background: C.green, color: '#fff', border: 0, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: saving || !newSectionName.trim() ? 'not-allowed' : 'pointer' }}>Save</button>
            <button onClick={function(){ setAddingSection(false); setNewSectionName(''); }}
              style={{ padding: '5px 12px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </>
        )}
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading…</div>}

      {!loading && sections.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12, background: C.surface, border: '0.5px dashed ' + C.border, borderRadius: 10 }}>
          No sections defined for {DEPTS.find(function(d){ return d.id === dept; }).label} yet. Click <b>+ Add section</b> to create the first one.
        </div>
      )}

      {!loading && sections.length > 0 && sections.map(sectionRow)}

      {/* Unassigned bucket */}
      {!loading && unassignedList.length > 0 && (
        <div style={{ background: C.redBg, border: '0.5px solid ' + C.red, borderRadius: 10, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
            <span style={{ cursor: 'pointer', color: C.red, fontSize: 11, padding: '0 2px' }} onClick={function(){ toggleExpand('__unassigned__'); }}>
              {expanded.has('__unassigned__') ? '▾' : '▸'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, borderRadius: 6, background: '#F4D3D3', fontSize: 11, fontWeight: 500, color: C.red }}>⚠</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.red, flex: 1, cursor: 'pointer' }} onClick={function(){ toggleExpand('__unassigned__'); }}>Unassigned</span>
            <span style={{ fontSize: 11, color: C.red, fontWeight: 500 }}>{unassignedList.length} dish{unassignedList.length === 1 ? '' : 'es'}</span>
          </div>
          {expanded.has('__unassigned__') && (
            <div style={{ borderTop: '0.5px solid ' + C.red }}>
              <div style={{ padding: '8px 12px 8px 40px', fontSize: 11, color: C.red, fontStyle: 'italic' }}>
                These dishes exist in the master library but aren't in any section — they'll show under "Extras" in Menu Builder until assigned.
              </div>
              {unassignedList.map(function(d, di){ return dishRow(d, '__unassigned__', di, unassignedList.length); })}
            </div>
          )}
        </div>
      )}

      {/* Merge modal */}
      {mergeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={function(){ setMergeModal(null); setMergeTargetId(''); }}>
          <div onClick={function(e){ e.stopPropagation(); }} style={{ background: C.surface, borderRadius: 12, padding: 20, minWidth: 400, maxWidth: 500 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: C.text }}>Merge "{mergeModal.sourceName}"</h3>
            <p style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              {mergeModal.dishCount > 0
                ? 'All ' + mergeModal.dishCount + ' dish' + (mergeModal.dishCount === 1 ? '' : 'es') + ' will move to the target section, then "' + mergeModal.sourceName + '" will be deleted.'
                : '"' + mergeModal.sourceName + '" is empty. Pick a target to delete cleanly.'}
            </p>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Target section:</label>
            <select value={mergeTargetId} onChange={function(e){ setMergeTargetId(e.target.value); }}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              <option value="">— Pick a target —</option>
              {sections.filter(function(s){ return s.id !== mergeModal.sourceId; }).map(function(s){
                const c = (dishesBySection[s.id] || []).length;
                return <option key={s.id} value={s.id}>{s.name} ({c})</option>;
              })}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={function(){ setMergeModal(null); setMergeTargetId(''); }} style={{ padding: '7px 14px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={doMerge} disabled={saving || !mergeTargetId}
                style={{ padding: '7px 14px', background: C.gold, color: '#fff', border: 0, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: saving || !mergeTargetId ? 'not-allowed' : 'pointer', opacity: saving || !mergeTargetId ? 0.5 : 1 }}>
                {mergeModal.dishCount > 0 ? 'Merge & delete' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DishSectionsEditor;