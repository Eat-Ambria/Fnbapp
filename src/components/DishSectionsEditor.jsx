// Ambria FnB — Dish Library → Sections tab (V73, unified V96)
// Master print-menu catalogue: define sections, assign dishes, order both.
// Menu Builder loads this as the base grid for every proposal.
//
// V96: used to split into 4 dept tabs (Kitchen/Beverage/Bakery/Fruits), each
// with its own independently-numbered sort_order (so dragging within one
// tab had no effect on, and no visibility into, the others). `dept` on a
// section only ever drove THIS tab split — the field that actually routes a
// section to a Menu Builder sidebar tab is the separate `sales_dept` (the
// dropdown on each section row below) — so splitting the editor by `dept`
// bought nothing except making it impossible to control the relative order
// of, say, a welcome-drinks section against the snacks section right after
// it. Now one combined, globally-orderable list; `dept` is still written on
// insert (legacy NOT NULL column) but no longer drives anything in this UI.
//
// Features
// - Add / rename / delete sections
// - Reorder sections, and each one's own subsections, by drag
// - Expand section → dish list, each dish a real MEMBERSHIP row (a dish can
//   be in zero, one, or many sections at once — see dish_section_links
//   below), with per-section reorder, a "+ Also add to…" picker (additive —
//   never replaces a dish's other memberships), and a per-row "×" that
//   removes just THIS one membership
// - Merge dialog: every dish with a membership in the source section gets
//   one ensured in the target (no duplicate if already in both), then the
//   source section is deleted
// - Unassigned bucket pinned at bottom (any dish with ZERO memberships)
// - Realtime subscription — multi-admin edits stay in sync
//
// Schema: dish_catalogue_sections (id, dept, name, sort_order,
// sop_category_hint) + dish_section_links (dish_name, section_id,
// sort_order — the TRUE many-to-many join table, one row per membership,
// no "primary" column). dishes_master.section_id/sort_in_section are
// legacy, left in place as a migration safety net but no longer read or
// written by this screen — see src/lib/dishSections.js for the shared
// helpers every other consumer uses to derive a dish's section(s) from
// dish_section_links instead.

import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { supabase } from '../lib/supabase.js';
import { fetchAllRows } from '../lib/db.js';
import { upsertDishMaster } from '../data/recipeData.js';
import { buildDishSectionsMap, sectionIdsFor, primarySectionFor } from '../lib/dishSections.js';
import { formatMergeWarnings } from '../lib/dishRenameOps.js';
import { SALES_DEPTS, ITEM_HAVING_DEPTS } from '../data/salesConfig.js';
import { KToast, KModal } from './KitchenUI.jsx';
import { uploadMenuPhoto, slugRecipeKey } from '../utils/helpers.js';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEPTS = [
  { id: 'kitchen',  label: 'Kitchen',  icon: '🍲' },
  { id: 'beverage', label: 'Beverage', icon: '🥤' },
  { id: 'bakery',   label: 'Bakery',   icon: '🥧' },
  { id: 'fruits',   label: 'Fruits',   icon: '🍎' },
];

// V73: stable module-level wrapper so useSortable's state survives parent re-renders.
// Uses render-prop pattern — child function receives { ref, style, dragAttrs, dragListeners }
// and applies them to the drag handle + outer container.
function SortableItem(props) {
  const s = useSortable({ id: props.id });
  const style = {
    transform: CSS.Transform.toString(s.transform),
    transition: s.transition,
    opacity: s.isDragging ? 0.5 : 1,
    zIndex: s.isDragging ? 10 : 0,
  };
  return props.children({ ref: s.setNodeRef, style: style, dragAttrs: s.attributes, dragListeners: s.listeners });
}

function DishSectionsEditor(props) {
  const lang = props.lang || 'en';
  const T2 = function(s) { return T(s, lang); };
  const isAdmin = props.currentUser && (props.currentUser.role === 'admin' || props.currentUser.role === 'headchef');

  const [sections, setSections] = useState([]);
  const [dishAssignments, setDishAssignments] = useState({});
  const [expanded, setExpanded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  // Every edit (rename, veg toggle, add section, merge...) calls loadData() to
  // pull the fresh rows back — but the render below used to gate the ENTIRE
  // list on `loading`, so each of those refetches unmounted the whole list for
  // a moment and remounted it once done. React can't preserve scroll position
  // across that (it's new DOM, not a patch), so every edit dropped you back at
  // the top. Only the very first load should hide the list; every refetch
  // after that updates the data in place while the list stays mounted.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [addingSection, setAddingSection] = useState(false);
  // Why an add was refused, shown next to the field. Without it the only
  // feedback for a rejected click was that nothing happened.
  const [addError, setAddError] = useState('');

  // Every outcome on this screen used to be a browser alert, and the only
  // confirmation was window.confirm — both of which sit outside the app, look
  // nothing like it, and on a save gave no sign at all that anything worked.
  const [toast, setToast] = useState(null);
  const [dlg, setDlg] = useState(null);
  // The section whose photo is mid-upload, so only that one row goes busy.
  const [photoBusy, setPhotoBusy] = useState(null);
  function say(title, body) { setToast({ tone: 'ok', title: title, body: body || '' }); }
  function fail(title, err) {
    setToast({ tone: 'danger', title: title, body: String((err && err.message) || err || '') });
  }
  function ask(opts) { setDlg(opts); }
  const [newSectionName, setNewSectionName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [mergeModal, setMergeModal] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  // V85 — one level of subsections (e.g. Main Course > Hyderabadi Cuisine).
  // A subsection is just another dish_catalogue_sections row with parent_section_id
  // set; dishes assign to it the same way as any section (dish_section_links).
  const [addingSubFor, setAddingSubFor] = useState(null); // parent section id, or null
  const [newSubName, setNewSubName] = useState('');
  // Quick-search within the Unassigned bucket — it routinely runs into the
  // hundreds (every dish never filed into a section), too many to scan by eye.
  const [unassignedSearch, setUnassignedSearch] = useState('');
  // V97 — section-row "⋯" kebab (replaces 5 separate icon buttons) and the
  // dish-row "+" add-to-section popover (replaces the native "+Also add
  // to…" <select>). One shared key scheme: 'sec:<id>' for a section's own
  // kebab, '<sectionId>::<dishName>' for a dish row's add picker.
  const [menuFor, setMenuFor] = useState(null);
  const [addPickerFor, setAddPickerFor] = useState(null);
  const [addPickerSearch, setAddPickerSearch] = useState('');
  // V98 — a section's own "+ Add dish" (brings in a dish that's ALREADY in
  // some other section, or genuinely new/unassigned, without requiring you
  // to go find its row wherever it currently lives). Additive, like every
  // other dish_section_links write in this file — never touches a dish's
  // other memberships. Auto-opened right after creating a section/subsection
  // (see addSection) so a brand-new section never sits empty and easy to
  // mistake for "didn't save".
  const [dishPickerFor, setDishPickerFor] = useState(null);
  const [dishPickerSearch, setDishPickerSearch] = useState('');

  // ── Data ────────────────────────────────────────────────────────
  // V96: one combined fetch across every dept, no `.eq('dept', ...)` filter.
  // sort_order used to only ever be compared within one dept's own rows
  // (each tab independently renumbered 10/20/30…), so the FIRST time this
  // runs, top-level sections from different depts can share a sort_order
  // value and sort arbitrarily against each other. Detect that (any
  // duplicate top-level sort_order) and do a one-time renumber into a clean
  // global sequence — using DEPTS' declared order as a sane starting
  // grouping — persisted immediately so it never needs to run again. This
  // must NOT re-run on every load once sort_order is genuinely global, or
  // it would silently undo any deliberate cross-dept interleaving someone
  // drags into place later (exactly the flexibility this change is for).
  async function loadData() {
    setLoading(true);
    try {
      const results = await Promise.all([
        fetchAllRows(function(){ return supabase.from('dish_catalogue_sections').select('*').order('sort_order', { ascending: true }); }),
        fetchAllRows(function(){ return supabase.from('dishes_master').select('dish_name, is_active, diet, image_url').eq('is_active', true); }),
        fetchAllRows(function(){ return supabase.from('dish_section_links').select('dish_name, section_id, sort_order').order('sort_order', { ascending: true }); })
      ]);
      var fetched = results[0] || [];
      var topFetched = fetched.filter(function(s){ return !s.parent_section_id; });
      var seenOrders = {};
      var hasCollision = topFetched.some(function(s){
        var k = s.sort_order || 0;
        if (seenOrders[k]) return true;
        seenOrders[k] = true;
        return false;
      });
      var loadedSections = fetched;
      if (hasCollision && isAdmin) {
        var deptRank = DEPTS.reduce(function(m, d, i){ m[d.id] = i; return m; }, {});
        var sortedTop = topFetched.slice().sort(function(a, b){
          var da = deptRank[a.dept], db = deptRank[b.dept];
          if (da !== db) return (da === undefined ? 999 : da) - (db === undefined ? 999 : db);
          return (a.sort_order || 0) - (b.sort_order || 0);
        });
        var renumberedById = {};
        sortedTop.forEach(function(s, i){ renumberedById[s.id] = (i + 1) * 10; });
        loadedSections = fetched.map(function(s){
          return renumberedById[s.id] !== undefined ? { ...s, sort_order: renumberedById[s.id] } : s;
        });
        // Best-effort, fire-and-forget — the UI already has the correct order
        // from the map above; this just makes it stick for next time (and
        // for anyone else's load) instead of recomputing it on every mount.
        Promise.all(sortedTop.map(function(s, i){
          return supabase.from('dish_catalogue_sections').update({ sort_order: (i + 1) * 10 }).eq('id', s.id);
        })).catch(function(e){ console.error('[Sections] one-time global renumber failed:', e); });
      } else {
        loadedSections = fetched.slice().sort(function(a, b){ return (a.sort_order || 0) - (b.sort_order || 0); });
      }
      setSections(loadedSections);
      // Each dish starts with zero memberships; every dish_section_links row
      // for it (results[2]) pushes one more onto `sections` — a dish can
      // legitimately end up in more than one section's bucket below.
      const assignments = {};
      (results[1] || []).forEach(function(d){ assignments[d.dish_name] = { sections: [], diet: d.diet || null, image_url: d.image_url || null }; });
      (results[2] || []).forEach(function(l){
        if (!assignments[l.dish_name]) return; // an inactive/deleted dish's leftover link row — ignore
        assignments[l.dish_name].sections.push({ section_id: l.section_id, sort_order: l.sort_order || 0 });
      });
      setDishAssignments(assignments);
      setLoadError(null);
    } catch (e) {
      console.error('[Sections] load failed:', e);
      setLoadError('Could not load sections: ' + (e.message || e));
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
    }
  }

  useEffect(function(){ loadData(); /* eslint-disable-next-line */ }, []);

  // Realtime — reload on any change to sections or dish assignments
  useEffect(function(){
    if (!supabase) return function(){};
    const ch = supabase.channel('sections_editor_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_catalogue_sections' }, function(){ loadData(); })
      // '*', not just 'UPDATE' -- a dish added elsewhere (e.g. a custom dish
      // created from the Build Menu/Items tab) INSERTs a new dishes_master
      // row, which an UPDATE-only subscription never saw: this screen, left
      // open, needed a manual reload before a dish created while it was open
      // would ever appear. Matches the sibling dish_catalogue_sections
      // subscription just above, which already correctly used '*'.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes_master' }, function(){ loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dish_section_links' }, function(){ loadData(); })
      .subscribe();
    return function(){ supabase.removeChannel(ch); };
    /* eslint-disable-next-line */
  }, []);

  // Group dishes by section — each dish contributes one row to EVERY
  // section it's a member of, so a multi-section dish legitimately shows up
  // in more than one bucket here.
  const dishesBySection = useMemo(function(){
    const map = {};
    Object.keys(dishAssignments).forEach(function(dishName){
      const a = dishAssignments[dishName];
      if (!a.sections || a.sections.length === 0) {
        (map['__unassigned__'] = map['__unassigned__'] || []).push({ name: dishName, sort: 0, diet: a.diet || null, image_url: a.image_url || null });
        return;
      }
      a.sections.forEach(function(m){
        (map[m.section_id] = map[m.section_id] || []).push({ name: dishName, sort: m.sort_order || 0, diet: a.diet || null, image_url: a.image_url || null });
      });
    });
    Object.keys(map).forEach(function(k){
      map[k].sort(function(a, b){ return (a.sort - b.sort) || a.name.localeCompare(b.name); });
    });
    return map;
  }, [dishAssignments]);

  const unassignedList = dishesBySection['__unassigned__'] || [];

  // Other sections a dish belongs to, shown as small removable pills on its
  // row — needs each section's display name, not just its id.
  const sectionNameById = useMemo(function(){
    const m = {};
    sections.forEach(function(s){ m[s.id] = s.name; });
    return m;
  }, [sections]);

  // Every active dish, for the per-section "+ Add dish" picker below — it
  // needs the whole catalogue, not just a section's own current members.
  const allDishNames = useMemo(function(){
    return Object.keys(dishAssignments).sort();
  }, [dishAssignments]);

  // V85 — top-level sections vs. their subsections (one level deep only —
  // a subsection never has its own parent_section_id set to another subsection).
  const topSections = useMemo(function(){ return sections.filter(function(s){ return !s.parent_section_id; }); }, [sections]);
  // V89 — dnd-kit's SortableContext takes `items` by reference; an inline
  // `.map()` produces a brand-new array every render even when topSections
  // itself is unchanged, which reads to dnd-kit as "the sortable set
  // changed" and can reset this list's own scroll position. Keying the memo
  // off the joined id string keeps the same array identity across renders
  // unless a section is actually added, removed, or reordered.
  const topSectionIdsKey = topSections.map(function(s){ return s.id; }).join('|');
  const topSectionIds = useMemo(function(){ return topSectionIdsKey ? topSectionIdsKey.split('|') : []; }, [topSectionIdsKey]);
  const subsByParent = useMemo(function(){
    const map = {};
    sections.forEach(function(s){
      if (s.parent_section_id) { (map[s.parent_section_id] = map[s.parent_section_id] || []).push(s); }
    });
    Object.keys(map).forEach(function(k){ map[k].sort(function(a,b){ return (a.sort_order||0) - (b.sort_order||0); }); });
    return map;
  }, [sections]);
  // Flat, indented option list for "add/move to" and merge-target pickers —
  // a subsection is addressed exactly like a section (same table, same id
  // space). excludeIds: a single id, an array of ids (a multi-section
  // dish's own current memberships, so the dropdown never re-offers one
  // it's already in), or omitted.
  function flatSectionOptions(excludeIds) {
    const excludeSet = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);
    const out = [];
    topSections.forEach(function(s){
      if (excludeSet.indexOf(s.id) === -1) out.push({ id: s.id, label: s.name });
      (subsByParent[s.id] || []).forEach(function(sub){
        if (excludeSet.indexOf(sub.id) === -1) out.push({ id: sub.id, label: '— ' + sub.name });
      });
    });
    return out;
  }

  // ── Actions ────────────────────────────────────────────────────────
  async function addSection(arg) {
    // Every exit from here used to be a bare return, so a refused click looked
    // exactly like a working one: no row, no message, nothing in the console.
    setAddError('');
    if (!isAdmin) { setAddError('Only an admin or head chef can add sections.'); return; }
    // A section id is a string. Anything else reaching this argument means the
    // function was handed to onClick directly and is holding a click event —
    // which used to make a top-level section read the empty subsection input
    // and return without saving or complaining.
    const parentId = typeof arg === 'string' ? arg : null;
    const nameVal = parentId ? newSubName.trim() : newSectionName.trim();
    if (!nameVal) { setAddError('Type a name first.'); return; }
    setSaving(true);
    try {
      const siblings = parentId ? (subsByParent[parentId] || []) : topSections;
      const maxSort = siblings.reduce(function(m, s){ return Math.max(m, s.sort_order || 0); }, 0);
      // `dept` no longer drives anything in this UI (see V96 note at top of
      // file) — the column is legacy NOT NULL, so still populate it, but any
      // value works equally well now; 'kitchen' is simplest.
      const payload = { dept: 'kitchen', name: nameVal, sort_order: maxSort + 10 };
      if (parentId) payload.parent_section_id = parentId;
      const { data, error } = await supabase.from('dish_catalogue_sections').insert(payload).select('*').single();
      if (error) throw error;
      if (!data) { fail('Could not add the section', 'The database returned no row — this is usually a permissions rule.'); return; }
      // V73: optimistic append — realtime may not be enabled on dish_catalogue_sections
      setSections(function(prev){ return [...(prev || []), data]; });
      if (parentId) { setNewSubName(''); setAddingSubFor(null); }
      else { setNewSectionName(''); setAddingSection(false); }
      // Expand it and open its dish picker immediately — a freshly created
      // section with zero dishes is easy to mistake for one that failed to
      // save, especially sorted to the bottom of a long list (see below).
      setExpanded(function(prev){ return new Set(prev).add(data.id); });
      setDishPickerFor(data.id);
      setDishPickerSearch('');
      // A new section sorts to the very end of a list twenty-five long, so it
      // lands off-screen. Without this the save looked like it did nothing.
      say(parentId ? 'Subsection added' : 'Section added',
          '"' + nameVal + '" is at the bottom of the list — add its first dish below.');
    } catch (e) { setAddError('Could not save: ' + e.message); fail('Could not add the section', e); }
    finally { setSaving(false); }
  }

  async function renameSection(id) {
    if (!isAdmin || !renameValue.trim()) return;
    const newName = renameValue.trim();
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dish_catalogue_sections')
        .update({ name: newName, updated_at: new Date().toISOString() }).eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) { fail('Could not rename', 'No row was updated — this is usually a permissions rule.'); return; }
      // V73: optimistic local update
      setSections(function(prev){ return (prev || []).map(function(s){ return s.id === id ? { ...s, name: newName } : s; }); });
      setRenamingId(null); setRenameValue('');
      say('Renamed', 'Now called "' + newName + '".');
    } catch (e) { fail('Could not rename', e); }
    finally { setSaving(false); }
  }

  // ── Section photographs ───────────────────────────────────────────────
  // What the client menu prints beside a section's dish list. Before this the
  // preview guessed a picture by matching words in the section's name against
  // filenames shipped in public/menu/, which gave nothing at all to any section
  // added later. That matching stays, but only as the fallback.
  async function uploadSectionPhoto(sec, file) {
    if (!file) return;
    if (!isAdmin) { fail('Only an admin or head chef can change photos'); return; }
    setPhotoBusy(sec.id);
    try {
      const url = await uploadMenuPhoto(supabase, 'sections', sec.id, file);
      if (!url) throw new Error('The upload returned no URL.');
      const { data, error } = await supabase.from('dish_catalogue_sections')
        .update({ image_url: url }).eq('id', sec.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No row was updated — this is usually a permissions rule.');
      setSections(function(prev){ return (prev || []).map(function(s){ return s.id === sec.id ? { ...s, image_url: url } : s; }); });
      say('Photo updated', '"' + sec.name + '" will use it in the menu preview and PDF.');
    } catch (e) {
      // The bucket is the one thing that cannot be created from here, so say so
      // plainly rather than surfacing "Bucket not found" on its own.
      const missing = /bucket not found|nosuchbucket/i.test(String(e && e.message));
      fail('Could not upload the photo', missing
        ? 'The menu-photos storage bucket does not exist yet — run MIGRATION_menu_photos.sql.'
        : e);
    } finally { setPhotoBusy(null); }
  }

  // The dish card's picture in Menu Builder. The printed menu has no per-dish
  // photograph, so this one deliberately does not reach the preview or the PDF.
  async function uploadDishPhoto(dishName, file) {
    if (!file) return;
    if (!isAdmin) { fail('Only an admin or head chef can change photos'); return; }
    setPhotoBusy(dishName);
    try {
      const url = await uploadMenuPhoto(supabase, 'dishes', slugRecipeKey(dishName), file);
      if (!url) throw new Error('The upload returned no URL.');
      const { data, error } = await supabase.from('dishes_master')
        .update({ image_url: url }).eq('dish_name', dishName).select('dish_name');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No row was updated — this is usually a permissions rule.');
      setDishAssignments(function(prev){
        const next = { ...(prev || {}) };
        if (next[dishName]) next[dishName] = { ...next[dishName], image_url: url };
        return next;
      });
      upsertDishMaster(dishName, { image_url: url });
      say('Photo updated', dishName + ' now has a picture on its card in Menu Builder.');
    } catch (e) {
      const missing = /bucket not found|nosuchbucket/i.test(String(e && e.message));
      fail('Could not upload the photo', missing
        ? 'The menu-photos storage bucket does not exist yet — run MIGRATION_menu_photos.sql.'
        : e);
    } finally { setPhotoBusy(null); }
  }

  async function clearSectionPhoto(sec) {
    if (!isAdmin) { fail('Only an admin or head chef can change photos'); return; }
    setPhotoBusy(sec.id);
    try {
      const { error } = await supabase.from('dish_catalogue_sections')
        .update({ image_url: null }).eq('id', sec.id);
      if (error) throw error;
      setSections(function(prev){ return (prev || []).map(function(s){ return s.id === sec.id ? { ...s, image_url: null } : s; }); });
      say('Photo removed', '"' + sec.name + '" falls back to the default artwork.');
    } catch (e) { fail('Could not remove the photo', e); }
    finally { setPhotoBusy(null); }
  }

  // Asks first, then does the work in the confirm handler. window.confirm blocks
  // the thread and renders outside the app; the consequences of this particular
  // delete are worth showing properly, so they go in the dialog's subhead.
  function deleteSection(sec) {
    if (!isAdmin) { fail('Only an admin or head chef can delete sections'); return; }
    const dishNames = (dishesBySection[sec.id] || []).map(function(d){ return d.name; });
    const subCount = (subsByParent[sec.id] || []).length;
    // A dish with OTHER memberships keeps showing up elsewhere — only one
    // with NO other section left behind actually falls to Unassigned.
    const fallingToUnassigned = dishNames.filter(function(n){
      return (dishAssignments[n].sections || []).length <= 1;
    }).length;
    const lines = [];
    if (dishNames.length > 0) {
      lines.push('Its ' + dishNames.length + ' dish' + (dishNames.length === 1 ? '' : 'es') + ' will lose this section'
        + (fallingToUnassigned > 0 ? ' (' + fallingToUnassigned + ' with no other section will move to Unassigned).' : ' — any with another section keep it.'));
    }
    if (subCount > 0) lines.push('Its ' + subCount + ' subsection' + (subCount === 1 ? '' : 's') + ' will become top-level section' + (subCount === 1 ? '' : 's') + '.');
    ask({
      tone: 'danger', icon: 'trash',
      title: 'Delete "' + sec.name + '"?',
      subhead: lines.length ? lines.join(' ') : 'This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: function(){ setDlg(null); reallyDeleteSection(sec); },
    });
  }

  async function reallyDeleteSection(sec) {
    setSaving(true);
    try {
      // Remove just THIS section's membership rows in DB FIRST, then delete
      // the section — a dish's OTHER memberships are never touched. No FK
      // on dish_section_links (same no-explicit-FK convention as the rest
      // of this project's schema), so a row referencing a deleted section
      // would otherwise sit there forever as a harmless-but-confusing orphan.
      const affectedNames = (dishesBySection[sec.id] || []).map(function(d){ return d.name; });
      if (affectedNames.length > 0) {
        const { error: lErr } = await supabase.from('dish_section_links').delete().eq('section_id', sec.id);
        if (lErr) throw lErr;
      }
      const { data, error } = await supabase.from('dish_catalogue_sections').delete().eq('id', sec.id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) { fail('Could not delete', 'No row was deleted — this is usually a permissions rule.'); return; }
      // Optimistic local removal + drop just this one membership per
      // affected dish (keeping any others it has) + un-nest any subsections,
      // mirroring the DB's ON DELETE SET NULL for parent_section_id.
      setSections(function(prev){
        return (prev || [])
          .filter(function(s){ return s.id !== sec.id; })
          .map(function(s){ return s.parent_section_id === sec.id ? { ...s, parent_section_id: null } : s; });
      });
      // Captured from INSIDE the updater (not re-derived from the outer
      // `dishAssignments` closure afterward) so the DISH_MASTER patch below
      // always reflects this exact write, never a stale snapshot from
      // before some other still-in-flight action's own update landed.
      var remainingByName = {};
      setDishAssignments(function(prev){
        const next = { ...(prev || {}) };
        affectedNames.forEach(function(name){
          if (!next[name]) return;
          const kept = (next[name].sections || []).filter(function(m){ return m.section_id !== sec.id; });
          next[name] = { ...next[name], sections: kept };
          remainingByName[name] = kept.map(function(m){ return m.section_id; });
        });
        return next;
      });
      // Patch the shared app-wide cache too (recipeData.js's DISH_MASTER) —
      // same reasoning as every other write in this file: Build Menu/FP
      // Print read from that cache, not this screen's own React state.
      affectedNames.forEach(function(name){
        const remaining = remainingByName[name] || [];
        upsertDishMaster(name, { section_ids: remaining, section_id: remaining[0] || null });
      });
      say('Section deleted', '"' + sec.name + '" is gone.');
    } catch (e) { fail('Could not delete', e); }
    finally { setSaving(false); }
  }

  // V73: drag-and-drop replaces click-based section reorder.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // V73: route a section's dishes to a specific Menu Builder sidebar tab.
  // null = default to 'kit' (kitchen). Only ITEM_HAVING_DEPTS make sense (kit/bev/bak/frt).
  async function setSalesDept(sectionId, salesDept) {
    if (!isAdmin) return;
    const val = salesDept || null;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dish_catalogue_sections')
        .update({ sales_dept: val })
        .eq('id', sectionId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) { fail('Could not change the tab', 'No row was updated — this is usually a permissions rule.'); return; }
      // Optimistic local update
      setSections(function(prev){ return (prev || []).map(function(s){ return s.id === sectionId ? { ...s, sales_dept: val } : s; }); });
    } catch (e) { fail('Could not change the tab', e); }
    finally { setSaving(false); }
  }

  // Reorders one parent's subsections only (e.g. Beverages' own Refreshing
  // Station / Fresh Juice / ...) — a separate DndContext per expanded parent,
  // scoped to just that parent's subs, mirroring onSectionDragEnd below but
  // against subsByParent[parentId] instead of the top-level list.
  async function onSubDragEnd(parentId, event) {
    if (!isAdmin) return;
    const active = event.active;
    const over = event.over;
    if (!over || active.id === over.id) return;
    const subs = subsByParent[parentId] || [];
    const oldIdx = subs.findIndex(function(s){ return s.id === active.id; });
    const newIdx = subs.findIndex(function(s){ return s.id === over.id; });
    if (oldIdx < 0 || newIdx < 0) return;

    const prevSections = sections;
    const reordered = arrayMove(subs, oldIdx, newIdx);
    const renumbered = reordered.map(function(s, i){ return { ...s, sort_order: (i + 1) * 10 }; });
    const renumberedById = {};
    renumbered.forEach(function(s){ renumberedById[s.id] = s; });
    const nextSections = sections.map(function(s){ return renumberedById[s.id] || s; });

    setSections(nextSections);
    setSaving(true);
    try {
      const changed = renumbered.filter(function(s){
        const orig = prevSections.find(function(p){ return p.id === s.id; });
        return !orig || orig.sort_order !== s.sort_order;
      });
      const results = await Promise.all(changed.map(function(s){
        return supabase.from('dish_catalogue_sections').update({ sort_order: s.sort_order }).eq('id', s.id).select('id');
      }));
      const firstError = results.find(function(r){ return r.error; });
      if (firstError) throw firstError.error;
    } catch (e) {
      fail('Could not reorder', e);
      // Same reasoning as onSectionDragEnd below — a partial batch failure
      // can leave the DB only half-renumbered; pull the real state back
      // rather than guessing from the pre-drag snapshot.
      loadData();
    } finally { setSaving(false); }
  }

  // V97 — per-section dish drag-reorder, replacing the old ▲▼ buttons.
  // Scoped to ONE section's own dish_section_links rows, same as moveDish
  // above — a dish's position in any OTHER section it also belongs to is
  // never touched. Mirrors onSubDragEnd's shape exactly, just against
  // dishesBySection[sectionId] instead of subsByParent[parentId].
  async function onDishDragEnd(sectionId, event) {
    if (!isAdmin) return;
    const active = event.active;
    const over = event.over;
    if (!over || active.id === over.id) return;
    const list = dishesBySection[sectionId] || [];
    const oldIdx = list.findIndex(function(d){ return d.name === active.id; });
    const newIdx = list.findIndex(function(d){ return d.name === over.id; });
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = arrayMove(list, oldIdx, newIdx);
    const renumbered = reordered.map(function(d, i){ return { name: d.name, sort: (i + 1) * 10 }; });
    const origSortByName = {};
    list.forEach(function(d){ origSortByName[d.name] = d.sort; });
    const changed = renumbered.filter(function(r){ return origSortByName[r.name] !== r.sort; });

    // Optimistic local update.
    setDishAssignments(function(prev){
      const next = { ...(prev || {}) };
      renumbered.forEach(function(r){
        const a = next[r.name]; if (!a) return;
        next[r.name] = { ...a, sections: (a.sections || []).map(function(m){ return m.section_id === sectionId ? { ...m, sort_order: r.sort } : m; }) };
      });
      return next;
    });
    setSaving(true);
    try {
      const results = await Promise.all(changed.map(function(r){
        return supabase.from('dish_section_links').update({ sort_order: r.sort }).eq('dish_name', r.name).eq('section_id', sectionId).select('dish_name');
      }));
      const firstError = results.find(function(r){ return r.error; });
      if (firstError) throw firstError.error;
    } catch (e) {
      fail('Could not reorder', e);
      // Same reasoning as onSectionDragEnd/onSubDragEnd — pull real state
      // back rather than guessing at a partial-failure outcome.
      loadData();
    } finally { setSaving(false); }
  }

  async function onSectionDragEnd(event) {
    if (!isAdmin) return;
    const active = event.active;
    const over = event.over;
    if (!over || active.id === over.id) return;
    // V85 — the sortable list is top-level sections only (subsections aren't
    // draggable, one level deep), so reorder within topSections and splice the
    // renumbered result back into the full flat `sections` state, leaving every
    // subsection's own entry untouched.
    const oldIdx = topSections.findIndex(function(s){ return s.id === active.id; });
    const newIdx = topSections.findIndex(function(s){ return s.id === over.id; });
    if (oldIdx < 0 || newIdx < 0) return;

    const prevSections = sections;
    const reorderedTop = arrayMove(topSections, oldIdx, newIdx);
    // Renumber to keep 10-step spacing so future single-row inserts fit between neighbours.
    const renumberedTop = reorderedTop.map(function(s, i){ return { ...s, sort_order: (i + 1) * 10 }; });
    const renumberedById = {};
    renumberedTop.forEach(function(s){ renumberedById[s.id] = s; });
    const renumbered = sections.map(function(s){ return renumberedById[s.id] || s; });

    // Optimistic local update — realtime on dish_catalogue_sections may not be enabled.
    setSections(renumbered);
    setSaving(true);
    try {
      // Only write the rows whose sort_order actually changed (minimises churn).
      // Direct UPDATE per row — upsert would validate all NOT NULL columns
      // (INSERT path) even when the conflict resolves to UPDATE.
      const changed = renumberedTop.filter(function(s){
        const orig = prevSections.find(function(p){ return p.id === s.id; });
        return !orig || orig.sort_order !== s.sort_order;
      });
      // V96 — this used to be a sequential round trip per changed row, fine
      // when a drag only ever reordered within one dept's short list. The
      // unified list means dragging a section up past dozens of others (e.g.
      // a Beverage section above all of Kitchen) can change 20-40+ rows in
      // one move, so a long sequential await chain is both slow and, if a
      // single request in the middle drops (a transient network blip —
      // "TypeError: Failed to fetch" is the browser failing to even reach
      // the server, not Supabase rejecting anything), leaves the DB
      // partially renumbered while this function has already thrown and
      // bailed. Fire every changed row together instead.
      const results = await Promise.all(changed.map(function(s){
        return supabase.from('dish_catalogue_sections').update({ sort_order: s.sort_order }).eq('id', s.id).select('id');
      }));
      const firstError = results.find(function(r){ return r.error; });
      if (firstError) throw firstError.error;
      const touched = results.filter(function(r){ return r.data && r.data.length > 0; }).length;
      if (touched === 0 && changed.length > 0) {
        console.warn('[Sections] 0 rows updated — check RLS on dish_catalogue_sections');
      }
    } catch (e) {
      fail('Could not reorder', e);
      // A partial batch failure can leave SOME rows renumbered in the DB and
      // others not — reverting to the pre-drag snapshot from memory would
      // show an order that no longer matches what's actually persisted.
      // Pull the real state back from the server instead of guessing.
      loadData();
    } finally { setSaving(false); }
  }

  // Scoped to THIS section's own membership row for each dish — reordering
  // within one section no longer perturbs its position in any OTHER
  // section it also belongs to (sort_order lives per-membership now, on
  // dish_section_links, not as one dish-wide dishes_master column).
  async function moveDish(dishName, direction, currentSectionId) {
    if (!isAdmin) return;
    const list = dishesBySection[currentSectionId] || [];
    const idx = list.findIndex(function(d){ return d.name === dishName; });
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const target = list[targetIdx];
    const dishSort = target.sort;
    const targetSort = list[idx].sort;
    setSaving(true);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from('dish_section_links').update({ sort_order: dishSort }).eq('dish_name', dishName).eq('section_id', currentSectionId).select('dish_name'),
        supabase.from('dish_section_links').update({ sort_order: targetSort }).eq('dish_name', target.name).eq('section_id', currentSectionId).select('dish_name')
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      if (!r1.data?.length || !r2.data?.length) { fail('Could not reorder', 'No row was updated — a permissions rule, or the dish is missing.'); return; }
      // V73: optimistic local update — don't wait for realtime
      setDishAssignments(function(prev){
        const cur = prev || {};
        function patch(name, sort){
          const a = cur[name]; if (!a) return a;
          return { ...a, sections: (a.sections || []).map(function(m){ return m.section_id === currentSectionId ? { ...m, sort_order: sort } : m; }) };
        }
        return { ...cur, [dishName]: patch(dishName, dishSort), [target.name]: patch(target.name, targetSort) };
      });
    } catch (e) { fail('Could not reorder', e); }
    finally { setSaving(false); }
  }

  // Additive — inserts a NEW membership, never touches the dish's other
  // sections. ignoreDuplicates makes a re-pick of an already-held section a
  // harmless no-op instead of a duplicate-key error.
  async function addDishToSection(dishName, newSectionId) {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const targetList = dishesBySection[newSectionId] || [];
      const maxSort = targetList.reduce(function(m, d){ return Math.max(m, d.sort || 0); }, 0);
      const newSort = maxSort + 10;
      const { error } = await supabase.from('dish_section_links')
        .upsert({ dish_name: dishName, section_id: newSectionId, sort_order: newSort }, { onConflict: 'dish_name,section_id', ignoreDuplicates: true });
      if (error) throw error;
      // nextIds is captured from INSIDE the updater (not re-derived from the
      // outer `dishAssignments` closure afterward) so the DISH_MASTER patch
      // below always reflects this exact write, never a stale snapshot from
      // before some other still-in-flight action's own update landed.
      var nextIds = null;
      setDishAssignments(function(prev){
        const p = prev || {};
        const a = p[dishName] || { sections: [], diet: null, image_url: null };
        const already = (a.sections || []).some(function(m){ return m.section_id === newSectionId; });
        const sections = already ? a.sections : [...(a.sections || []), { section_id: newSectionId, sort_order: newSort }];
        nextIds = sections.map(function(m){ return m.section_id; });
        if (already) return p;
        return { ...p, [dishName]: { ...a, sections: sections } };
      });
      // See moveDish's comment above — patch the shared cache too, or Build
      // Menu/FP Print keep showing this dish under its OLD section(s) only
      // until a full reload.
      upsertDishMaster(dishName, { section_ids: nextIds, section_id: nextIds[0] || null });
    } catch (e) { fail('Could not add the dish to that section', e); }
    finally { setSaving(false); }
  }

  // Removes just THIS one membership — any other section the dish belongs
  // to is untouched. Replaces the old scalar "Unassign" (there was only
  // ever one section to clear); the per-row "×" button below is what calls
  // this now, not a dropdown option.
  async function removeDishFromSection(dishName, sectionId) {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dish_section_links').delete().eq('dish_name', dishName).eq('section_id', sectionId).select('dish_name');
      if (error) throw error;
      if (!data || data.length === 0) { fail('Could not remove the dish', 'No row was removed — this is usually a permissions rule.'); return; }
      // remainingIds captured from INSIDE the updater — see addDishToSection's comment above.
      var remainingIds = null;
      setDishAssignments(function(prev){
        const p = prev || {};
        const a = p[dishName]; if (!a) return p;
        const kept = (a.sections || []).filter(function(m){ return m.section_id !== sectionId; });
        remainingIds = kept.map(function(m){ return m.section_id; });
        return { ...p, [dishName]: { ...a, sections: kept } };
      });
      upsertDishMaster(dishName, { section_ids: remainingIds || [], section_id: (remainingIds && remainingIds[0]) || null });
    } catch (e) { fail('Could not remove the dish from that section', e); }
    finally { setSaving(false); }
  }

  // V74/V97: veg/non-veg/egg classification — null (unclassified) → veg →
  // non-veg → egg → back to null.
  async function cycleDishDiet(dishName, current) {
    if (!isAdmin) return;
    const next = current == null ? 'veg' : current === 'veg' ? 'nonveg' : current === 'nonveg' ? 'egg' : null;
    setSaving(true);
    try {
      const { data, error } = await supabase.from('dishes_master')
        .update({ diet: next })
        .eq('dish_name', dishName)
        .select('dish_name');
      if (error) throw error;
      if (!data || data.length === 0) { fail('Could not update', 'No row was updated — a permissions rule, or the dish is inactive.'); return; }
      setDishAssignments(function(prev){
        const p = prev || {};
        return { ...p, [dishName]: { ...(p[dishName] || {}), diet: next } };
      });
      upsertDishMaster(dishName, { diet: next });
    } catch (e) { fail('Could not update', e); }
    finally { setSaving(false); }
  }

  // V73: bulk selection + move ─────────────────────────────────────
  const [bulkSel, setBulkSel] = useState(new Set());
  function toggleBulk(dishName) {
    setBulkSel(function(prev){
      const next = new Set(prev);
      if (next.has(dishName)) next.delete(dishName); else next.add(dishName);
      return next;
    });
  }
  function clearBulk() { setBulkSel(new Set()); }

  // V90 — merge duplicate dish NAMES (e.g. "Chutney" + "Chutney (Tomato / Mint / Homemade)")
  // into one canonical dish. Reuses the parent Dish Library's merge logic (rewrites every
  // menu package + drops the merged names' Hindi/SOP/Inventory mappings) via onMergeDishes —
  // this component only owns the target-picker UI and its own bulkSel selection.
  const [dishMergeOpen, setDishMergeOpen] = useState(false);
  const [dishMergeTarget, setDishMergeTarget] = useState('');
  const [dishMergeSaving, setDishMergeSaving] = useState(false);
  function openDishMerge() {
    if (bulkSel.size === 0) return;
    const sorted = Array.from(bulkSel).sort();
    setDishMergeTarget(sorted[0]);
    setDishMergeOpen(true);
  }
  function closeDishMerge() {
    if (dishMergeSaving) return;
    setDishMergeOpen(false);
    setDishMergeTarget('');
  }
  async function confirmDishMerge() {
    if (!props.onMergeDishes) return;
    const target = (dishMergeTarget || '').trim();
    if (!target) { fail('Type a target dish name first'); return; }
    const selectedNames = Array.from(bulkSel);
    const sources = selectedNames.filter(function(n){ return n !== target; });
    if (sources.length === 0) { fail('Nothing to merge', 'The target is the same as the dish you picked.'); return; }
    const isRename = selectedNames.length === 1;
    const verb = isRename ? 'Rename "' + sources[0] + '" to "' + target + '"?' : 'Merge ' + sources.length + ' dish(es) into "' + target + '"?';
    // This one destroys mappings, so the consequences are spelled out rather
    // than crammed into a window.confirm the browser renders in its own chrome.
    ask({
      tone: 'danger', icon: 'alert',
      title: verb,
      subhead: 'This replaces the merged name in every menu package that references it, '
             + 'deletes the merged dish(es) from the library along with their Hindi, SOP and '
             + 'Inventory mappings, and leaves the target\'s own mappings untouched.',
      confirmLabel: isRename ? 'Rename' : 'Merge',
      onConfirm: function(){ setDlg(null); reallyMergeDishes(sources, target, isRename); },
    });
  }

  async function reallyMergeDishes(sources, target, isRename) {
    setDishMergeSaving(true);
    // A merge that hung here previously left "Working…" up forever with nothing
    // in the console. Log + cap each half so a stuck step is now visible and
    // recoverable instead of an indefinite spinner.
    function withTimeout(p, label, ms) {
      const t = ms || 15000;
      console.log('[dish-merge] ' + label + ' — starting');
      const t0 = Date.now();
      let timer;
      const timeoutP = new Promise(function(_, reject){ timer = setTimeout(function(){ reject(new Error('Timed out after ' + t + 'ms: ' + label)); }, t); });
      return Promise.race([p, timeoutP]).then(
        function(v){ clearTimeout(timer); console.log('[dish-merge] ' + label + ' — done in ' + (Date.now() - t0) + 'ms'); return v; },
        function(e){ clearTimeout(timer); console.error('[dish-merge] ' + label + ' — FAILED after ' + (Date.now() - t0) + 'ms:', e); throw e; }
      );
    }
    try {
      // 120s, not the default 15s — the merge now also scans events/proposals
      // for section tags and outsourced flags, and moves kitchen_tracking rows
      // one at a time, so it legitimately takes longer than before. The OLD
      // default here would report "Timed out" while the real merge (which
      // this timeout can't actually cancel) kept running in the background,
      // inviting a second, concurrent merge attempt from a second click.
      const result = await withTimeout(props.onMergeDishes(sources, target), 'merge core (' + sources.length + ' source(s) -> "' + target + '")', 120000);
      setDishMergeOpen(false);
      setDishMergeTarget('');
      clearBulk();
      await withTimeout(loadData(), 'reload sections after merge');
      var warnNote = (result && result.bookingsWarnings && result.bookingsWarnings.length > 0)
        ? ' Needs manual review: ' + formatMergeWarnings(result.bookingsWarnings)
        : '';
      say(isRename ? 'Renamed' : 'Merged',
          (isRename ? 'Now called "' + target + '". ' : sources.length + ' dish(es) merged into "' + target + '". ')
          + (result && result.affected != null ? result.affected + ' package(s) updated.' : '') + warnNote);
    } catch (e) {
      fail('Could not merge', e);
    } finally {
      setDishMergeSaving(false);
    }
  }

  // targetSectionId: a real section id ("+ Add to"), or '__unassign__'
  // ("remove from every section"). bulkSel is keyed by bare dish name
  // (shared with the dish-rename/merge feature below, which needs plain
  // dish identity, not a per-section pairing — see toggleBulk above), so a
  // bulk action here is necessarily dish-wide: "Add to" is additive (never
  // touches a dish's existing sections, same as the per-row "+ Also add
  // to…" action, just batched); "remove from every section" clears ALL of
  // a selected dish's memberships, matching this toolbar's original
  // "— Unassign" wording as literally as a now-possibly-multi-section dish
  // allows (the per-row "×" button is what removes just ONE membership).
  async function bulkMoveTo(targetSectionId) {
    if (!isAdmin || bulkSel.size === 0) return;
    const isUnassign = targetSectionId === '__unassign__';
    const names = Array.from(bulkSel);
    setSaving(true);
    try {
      if (isUnassign) {
        const results = await Promise.all(names.map(function(name){
          return supabase.from('dish_section_links').delete().eq('dish_name', name).select('dish_name').then(function(res){ return { name: name, res: res }; });
        }));
        results.forEach(function(r){ if (r.res.error) throw r.res.error; });
        setDishAssignments(function(prev){
          const next = { ...(prev || {}) };
          names.forEach(function(name){ if (next[name]) next[name] = { ...next[name], sections: [] }; });
          return next;
        });
        names.forEach(function(name){ upsertDishMaster(name, { section_ids: [], section_id: null }); });
        clearBulk();
        say('Removed ' + names.length + ' dish' + (names.length === 1 ? '' : 'es') + ' from every section');
        return;
      }
      const targetList = dishesBySection[targetSectionId] || [];
      const baseSort = targetList.reduce(function(m, d){ return Math.max(m, d.sort || 0); }, 0);
      // Fire all row writes in parallel instead of one round trip per dish —
      // sequential awaits here made a 10-dish bulk add take 10x one
      // request's latency. ignoreDuplicates makes a dish already in the
      // target section a harmless no-op instead of a duplicate-key error.
      const results = await Promise.all(names.map(function(name, i){
        return supabase.from('dish_section_links')
          .upsert({ dish_name: name, section_id: targetSectionId, sort_order: baseSort + (i + 1) * 10 }, { onConflict: 'dish_name,section_id', ignoreDuplicates: true })
          .then(function(res){ return { name: name, res: res }; });
      }));
      results.forEach(function(r){ if (r.res.error) throw r.res.error; });
      // nextIdsByName captured from INSIDE the updater — see
      // addDishToSection's comment for why (avoids a stale-closure race
      // against any other still-in-flight action on the same dish).
      var nextIdsByName = {};
      setDishAssignments(function(prev){
        const next = { ...(prev || {}) };
        names.forEach(function(name, i){
          const a = next[name] || { sections: [], diet: null, image_url: null };
          const already = (a.sections || []).some(function(m){ return m.section_id === targetSectionId; });
          const sections = already ? a.sections : [...(a.sections || []), { section_id: targetSectionId, sort_order: baseSort + (i + 1) * 10 }];
          nextIdsByName[name] = sections.map(function(m){ return m.section_id; });
          next[name] = { ...a, sections: sections };
        });
        return next;
      });
      names.forEach(function(name){
        const nextIds = nextIdsByName[name] || [];
        upsertDishMaster(name, { section_ids: nextIds, section_id: nextIds[0] || null });
      });
      clearBulk();
      say('Added ' + names.length + ' dish' + (names.length === 1 ? '' : 'es') + ' to that section');
    } catch (e) { fail('Could not update those dishes', e); }
    finally { setSaving(false); }
  }

  async function doMerge() {
    if (!isAdmin || !mergeModal || !mergeTargetId) return;
    const targetList = dishesBySection[mergeTargetId] || [];
    const baseSort = targetList.reduce(function(m, d){ return Math.max(m, d.sort || 0); }, 0);
    const sourceDishes = dishesBySection[mergeModal.sourceId] || [];
    setSaving(true);
    try {
      // Ensure every source dish has a target membership FIRST (upsert +
      // ignoreDuplicates — a harmless no-op for a dish already in both
      // source AND target), THEN bulk-delete every membership in the
      // source section — in that order, so a dish is never briefly in
      // neither. Same parallel-writes fix as bulkMoveTo above.
      const results = await Promise.all(sourceDishes.map(function(d, i){
        return supabase.from('dish_section_links')
          .upsert({ dish_name: d.name, section_id: mergeTargetId, sort_order: baseSort + (i + 1) * 10 }, { onConflict: 'dish_name,section_id', ignoreDuplicates: true })
          .then(function(res){ return { name: d.name, res: res }; });
      }));
      results.forEach(function(r){ if (r.res.error) throw r.res.error; });
      const { error: delLinksErr } = await supabase.from('dish_section_links').delete().eq('section_id', mergeModal.sourceId);
      if (delLinksErr) throw delLinksErr;
      const { error: delErr } = await supabase.from('dish_catalogue_sections').delete().eq('id', mergeModal.sourceId);
      if (delErr) throw delErr;
      // V73: optimistic local update. nextIdsByName captured from INSIDE
      // the updater — see addDishToSection's comment for why.
      var nextIdsByName = {};
      setDishAssignments(function(prev){
        const next = { ...(prev || {}) };
        sourceDishes.forEach(function(d, i){
          const a = next[d.name]; if (!a) return;
          const withoutSource = (a.sections || []).filter(function(m){ return m.section_id !== mergeModal.sourceId; });
          const alreadyInTarget = withoutSource.some(function(m){ return m.section_id === mergeTargetId; });
          const sections = alreadyInTarget ? withoutSource : [...withoutSource, { section_id: mergeTargetId, sort_order: baseSort + (i + 1) * 10 }];
          nextIdsByName[d.name] = sections.map(function(m){ return m.section_id; });
          next[d.name] = { ...a, sections: sections };
        });
        return next;
      });
      sourceDishes.forEach(function(d){
        const nextIds = nextIdsByName[d.name] || [];
        upsertDishMaster(d.name, { section_ids: nextIds, section_id: nextIds[0] || null });
      });
      setSections(function(prev){ return (prev || []).filter(function(s){ return s.id !== mergeModal.sourceId; }); });
      setMergeModal(null); setMergeTargetId('');
    } catch (e) { fail('Could not merge', e); }
    finally { setSaving(false); }
  }

  function toggleExpand(id) {
    setExpanded(function(p){ const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }

  // ── Render ────────────────────────────────────────────────────────
  function dishRow(dish, sectionId, idx, total, drag) {
    const isUnassigned = sectionId === '__unassigned__';
    const isPicked = bulkSel.has(dish.name);
    // Every OTHER section this dish is already in, besides the one this
    // row is rendered under — used to both hide already-held sections from
    // the "+" add picker and to show them as removable pills, and to show
    // the "×" remove button only when it's safe (removing a dish's ONLY
    // remaining section still works, it just falls to Unassigned).
    const allMemberships = (dishAssignments[dish.name] && dishAssignments[dish.name].sections) || [];
    const currentIds = allMemberships.map(function(m){ return m.section_id; });
    const otherIds = currentIds.filter(function(id){ return id !== sectionId; });
    const rowKey = sectionId + '::' + dish.name;
    const diet = dish.diet || null;
    // Only ever null/'veg'/'nonveg'/'egg' from this screen's own cycle below
    // — but dishes_master.diet's check constraint also allows 'jain' (set
    // only from the separate Sales Catalogue screen, never from here), so
    // an unrecognized value must still get a real color/label/next-state
    // rather than silently rendering as an invisible dot and, on click,
    // discarding it by jumping straight to 'veg'.
    const dietColor = diet === 'veg' ? C.green : diet === 'nonveg' ? C.red : diet === 'egg' ? C.egg : (diet ? C.muted : null);
    const dietLabel = diet === 'veg' ? 'Veg' : diet === 'nonveg' ? 'Non-veg' : diet === 'egg' ? 'Egg' : (diet || 'Unclassified');
    // Matches cycleDishDiet's own real next-state logic below exactly (which
    // clears ANY value outside veg/nonveg to null) — so the title text never
    // promises something other than what the click actually does.
    const dietNext = diet === 'veg' ? 'non-veg' : diet === 'nonveg' ? 'egg' : diet ? 'clear' : 'veg';
    const dishMenuKey = 'dish:' + rowKey;
    return (
      <div ref={drag ? drag.ref : undefined} style={{ ...(drag ? drag.style : null), display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px 9px ' + (isUnassigned ? '44px' : '12px'), borderTop: idx > 0 ? '0.5px solid ' + C.borderLight : 0, fontSize: 13, background: isPicked ? '#F1F6FC' : 'transparent' }}>
        {isAdmin && (
          <input type="checkbox" checked={isPicked}
            onChange={function(){ toggleBulk(dish.name); }}
            title="Select for bulk action"
            style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }} />
        )}
        {isAdmin && !isUnassigned && drag && (
          <span {...drag.dragAttrs} {...drag.dragListeners}
            title="Drag to reorder"
            style={{ cursor: 'grab', userSelect: 'none', padding: '2px 5px', fontSize: 14, color: C.muted, lineHeight: 1, touchAction: 'none', flexShrink: 0 }}>⠿</span>
        )}
        {isAdmin ? (
          <button onClick={function(){ cycleDishDiet(dish.name, diet); }} disabled={saving}
            title={dietLabel + ' — click to mark ' + dietNext}
            style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, padding: 0, cursor: saving ? 'wait' : 'pointer',
              background: dietColor || 'transparent',
              border: diet == null ? '1.5px solid ' + C.faint : 'none' }} />
        ) : (
          diet != null && (
            <span title={dietLabel}
              style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: dietColor }} />
          )
        )}
        <span style={{ flex: 1, minWidth: 60, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.name}</span>
        {otherIds.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 260, justifyContent: 'flex-end' }}>
            {otherIds.map(function(id){
              return (
                <span key={id} title={'Also in "' + (sectionNameById[id] || '') + '"'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 7px 2px 9px', borderRadius: 999, background: C.darkCard, color: C.muted, whiteSpace: 'nowrap' }}>
                  {sectionNameById[id] || '…'}
                  {isAdmin && (
                    <button onClick={function(){ removeDishFromSection(dish.name, id); }} disabled={saving}
                      title={'Remove from "' + (sectionNameById[id] || '') + '"'}
                      style={{ background: 'transparent', border: 0, cursor: saving ? 'wait' : 'pointer', padding: 0, fontSize: 12, color: C.muted, lineHeight: 1, fontWeight: 700 }}>×</button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {isAdmin && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={function(){ setAddPickerFor(addPickerFor === rowKey ? null : rowKey); setAddPickerSearch(''); }}
              title={isUnassigned ? 'Assign to a section' : 'Also add to another section'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', background: 'transparent', border: '1px solid ' + C.border, borderRadius: 6, cursor: 'pointer', padding: '3px 10px', fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>+ Add section</button>
            {addPickerFor === rowKey && (function(){
              const opts = flatSectionOptions(currentIds).filter(function(o){
                const q = addPickerSearch.trim().toLowerCase();
                return !q || o.label.toLowerCase().indexOf(q) !== -1;
              });
              return (
                <>
                  <div onClick={function(){ setAddPickerFor(null); }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  <div onClick={function(e){ e.stopPropagation(); }}
                    style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 999, background: C.surface, border: '1px solid ' + C.border, borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: 230 }}>
                    <input autoFocus value={addPickerSearch} onChange={function(e){ setAddPickerSearch(e.target.value); }}
                      placeholder="Search sections…"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: 0, borderBottom: '1px solid ' + C.borderLight, fontSize: 13, outline: 'none', borderRadius: '9px 9px 0 0' }} />
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {opts.map(function(o){
                        return (
                          <button key={o.id} onClick={function(){ addDishToSection(dish.name, o.id); setAddPickerFor(null); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 0, borderTop: '0.5px solid ' + C.borderLight, cursor: 'pointer', padding: '9px 12px', fontSize: 13, color: C.text }}>
                            {o.label}
                          </button>
                        );
                      })}
                      {opts.length === 0 && (
                        <div style={{ padding: '12px', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                          {addPickerSearch.trim() ? 'No match' : 'Already in every section'}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
        {isAdmin && (function(){
          const menuItemStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', border: 0, borderTop: '0.5px solid ' + C.borderLight, cursor: 'pointer', padding: '9px 14px', fontSize: 13, color: C.text };
          return (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={function(){ setMenuFor(menuFor === dishMenuKey ? null : dishMenuKey); }} title="More actions"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '3px 8px', fontSize: 16, color: C.muted, borderRadius: 5, lineHeight: 1 }}>⋯</button>
              {menuFor === dishMenuKey && (
                <>
                  <div onClick={function(){ setMenuFor(null); }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  <div onClick={function(e){ e.stopPropagation(); }}
                    style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 999, background: C.surface, border: '1px solid ' + C.border, borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', minWidth: 200, overflow: 'hidden' }}>
                    {/* Same control as a section's, against dishes_master.image_url.
                        Does NOT appear in the printed menu — that has no per-dish
                        photograph — it's the picture on the dish card in Menu Builder. */}
                    <label style={{ ...menuItemStyle, borderTop: 0, cursor: photoBusy === dish.name ? 'wait' : 'pointer' }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoBusy === dish.name}
                        onChange={function(e){ uploadDishPhoto(dish.name, e.target.files && e.target.files[0]); e.target.value = ''; setMenuFor(null); }} />
                      📷 {dish.image_url ? 'Replace dish photo' : 'Add dish photo'}
                    </label>
                    {!isUnassigned && (
                      <button onClick={function(){ setMenuFor(null); removeDishFromSection(dish.name, sectionId); }}
                        title={otherIds.length > 0 ? 'It stays in its other sections' : 'Falls to Unassigned'}
                        style={{ ...menuItemStyle, color: C.red }}>🗑 Remove from this section</button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  function sectionRow(sec, drag, isSub) {
    const dishes = dishesBySection[sec.id] || [];
    const isExpanded = expanded.has(sec.id);
    const isRenaming = renamingId === sec.id;
    const otherCount = sections.length - 1;
    const printPos = Math.floor((sec.sort_order || 0) / 10);
    const subs = isSub ? [] : (subsByParent[sec.id] || []);
    const addingSub = addingSubFor === sec.id;
    // V73: drag ref/style applied to outer container; listeners applied to grip handle only.
    return (
      <div ref={drag ? drag.ref : undefined} style={{ ...(drag ? drag.style : null), background: C.surface, border: '0.5px solid ' + C.border, borderRadius: 12, overflow: 'hidden', marginBottom: isSub ? 8 : 10, marginLeft: isSub ? 28 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
          {isAdmin && drag && (
            <span {...drag.dragAttrs} {...drag.dragListeners}
              title="Drag to reorder"
              style={{ cursor: 'grab', userSelect: 'none', padding: '2px 5px', fontSize: 14, color: C.muted, lineHeight: 1, touchAction: 'none' }}>
              ⋮⋮
            </span>
          )}
          <span style={{ cursor: 'pointer', color: C.muted, fontSize: 12, padding: '0 2px' }} onClick={function(){ toggleExpand(sec.id); }}>
            {isExpanded ? '▾' : '▸'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 24, padding: '0 7px', borderRadius: 6, background: C.darkCard, fontSize: 12, fontWeight: 500, color: C.muted }}>
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
              <span style={{ fontSize: 14, fontWeight: 500, color: C.text, flex: 1, cursor: 'pointer' }} onClick={function(){ toggleExpand(sec.id); }}>{sec.name}</span>
              {sec.sop_category_hint && <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: '#E7F0F7', color: '#1E5A8F', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SOP · {sec.sop_category_hint}</span>}
              {isAdmin && (
                <select value={sec.sales_dept || ''}
                  onChange={function(e){ setSalesDept(sec.id, e.target.value); }}
                  title="Which Menu Builder sidebar tab shows this section"
                  style={{ fontSize: 11, padding: '3px 8px', border: '1px solid ' + C.border, borderRadius: 999, background: sec.sales_dept ? '#F4EEDA' : C.surface, color: sec.sales_dept ? '#7A5B12' : C.muted, cursor: 'pointer', fontWeight: sec.sales_dept ? 600 : 400 }}>
                  <option value="">→ Kitchen tab (default)</option>
                  {SALES_DEPTS.filter(function(d){ return ITEM_HAVING_DEPTS.indexOf(d.id) >= 0; }).map(function(d){
                    return <option key={d.id} value={d.id}>→ {d.name} tab</option>;
                  })}
                </select>
              )}
              <span style={{ fontSize: 12, color: C.muted }}>{dishes.length} dish{dishes.length === 1 ? '' : 'es'}</span>
              {isAdmin && (function(){
                const menuKey = 'sec:' + sec.id;
                const menuItemStyle = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', border: 0, borderTop: '0.5px solid ' + C.borderLight, cursor: 'pointer', padding: '9px 14px', fontSize: 13, color: C.text };
                return (
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button onClick={function(){ setMenuFor(menuFor === menuKey ? null : menuKey); }} title="More actions"
                      style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '3px 9px', fontSize: 16, color: C.muted, borderRadius: 5, lineHeight: 1 }}>⋯</button>
                    {menuFor === menuKey && (
                      <>
                        <div onClick={function(){ setMenuFor(null); }} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                        <div onClick={function(e){ e.stopPropagation(); }}
                          style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 999, background: C.surface, border: '1px solid ' + C.border, borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', minWidth: 220, overflow: 'hidden' }}>
                          <label style={{ ...menuItemStyle, borderTop: 0, cursor: photoBusy === sec.id ? 'wait' : 'pointer' }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={photoBusy === sec.id}
                              onChange={function(e){ uploadSectionPhoto(sec, e.target.files && e.target.files[0]); e.target.value = ''; setMenuFor(null); }} />
                            📷 {sec.image_url ? 'Replace section photo' : 'Add section photo'}
                          </label>
                          {sec.image_url && (
                            <button onClick={function(){ clearSectionPhoto(sec); setMenuFor(null); }} style={menuItemStyle}>🗑 Remove section photo</button>
                          )}
                          <button onClick={function(){ setExpanded(function(prev){ return new Set(prev).add(sec.id); }); setDishPickerFor(sec.id); setDishPickerSearch(''); setMenuFor(null); }}
                            style={menuItemStyle}>+ Add dish</button>
                          {!isSub && (
                            <button onClick={function(){ setAddingSubFor(sec.id); setNewSubName(''); setMenuFor(null); }} style={menuItemStyle}>⊞ Add subsection</button>
                          )}
                          <button onClick={function(){ setRenamingId(sec.id); setRenameValue(sec.name); setMenuFor(null); }} style={menuItemStyle}>✎ Rename</button>
                          <button onClick={function(){ if (otherCount > 0) { setMergeModal({ sourceId: sec.id, sourceName: sec.name, dishCount: dishes.length }); setMergeTargetId(''); } setMenuFor(null); }}
                            disabled={otherCount === 0}
                            style={{ ...menuItemStyle, cursor: otherCount === 0 ? 'not-allowed' : 'pointer', opacity: otherCount === 0 ? 0.4 : 1 }}>⇄ Merge into another section</button>
                          <button onClick={function(){ setMenuFor(null); deleteSection(sec); }} style={{ ...menuItemStyle, color: C.red }}>🗑 Delete section</button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
        {isExpanded && dishes.length > 0 && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight, maxHeight: 420, overflowY: 'auto' }}>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={function(event){ onDishDragEnd(sec.id, event); }}>
              <SortableContext items={dishes.map(function(d){ return d.name; })} strategy={verticalListSortingStrategy}>
                {dishes.map(function(d, di){
                  return (
                    <SortableItem key={d.name} id={d.name}>
                      {function(drag){ return dishRow(d, sec.id, di, dishes.length, drag); }}
                    </SortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        )}
        {isExpanded && dishes.length === 0 && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight, padding: '10px 12px', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
            No dishes assigned yet — use "+ Add dish" above (it also finds a dish that's already in another section).
          </div>
        )}
        {isExpanded && dishPickerFor === sec.id && (function(){
          const currentIds = (dishesBySection[sec.id] || []).map(function(d){ return d.name; });
          const q = dishPickerSearch.trim().toLowerCase();
          const matches = allDishNames.filter(function(name){
            if (currentIds.indexOf(name) !== -1) return false;
            return !q || name.toLowerCase().indexOf(q) !== -1;
          });
          const shown = q ? matches : matches.slice(0, 50);
          return (
            <div style={{ borderTop: '0.5px solid ' + C.borderLight, padding: '10px 12px 12px ' + (isSub ? '0' : '12px') }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <input autoFocus value={dishPickerSearch} onChange={function(e){ setDishPickerSearch(e.target.value); }}
                  placeholder={'Search all ' + allDishNames.length + ' dishes…'}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12.5, boxSizing: 'border-box' }} />
                <button onClick={function(){ setDishPickerFor(null); }}
                  style={{ padding: '6px 12px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Done</button>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid ' + C.borderLight, borderRadius: 7 }}>
                {shown.map(function(name){
                  const elsewhere = ((dishAssignments[name] && dishAssignments[name].sections) || []).length > 0;
                  return (
                    <button key={name} onClick={function(){ addDishToSection(name, sec.id); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', border: 0, borderTop: '0.5px solid ' + C.borderLight, cursor: 'pointer', padding: '7px 10px', fontSize: 12.5, color: C.text }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      {elsewhere && <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>already elsewhere</span>}
                    </button>
                  );
                })}
                {shown.length === 0 && (
                  <div style={{ padding: 10, fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>
                    {q ? 'No match' : 'Every dish is already in this section'}
                  </div>
                )}
              </div>
              {!q && matches.length > shown.length && (
                <div style={{ fontSize: 10.5, color: C.faint, marginTop: 4 }}>+{matches.length - shown.length} more — type to narrow</div>
              )}
            </div>
          );
        })()}
        {!isSub && isExpanded && subs.length > 0 && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight, padding: '8px 12px 8px 0', maxHeight: 460, overflowY: 'auto' }}>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={function(event){ onSubDragEnd(sec.id, event); }}>
              <SortableContext items={subs.map(function(s){ return s.id; })} strategy={verticalListSortingStrategy}>
                {subs.map(function(sub){
                  return (
                    <SortableItem key={sub.id} id={sub.id}>
                      {function(drag){ return sectionRow(sub, drag, true); }}
                    </SortableItem>
                  );
                })}
              </SortableContext>
            </DndContext>
          </div>
        )}
        {!isSub && addingSub && (
          <div style={{ borderTop: '0.5px solid ' + C.borderLight, padding: '10px 12px 10px 40px', display: 'flex', gap: 6 }}>
            <input value={newSubName} onChange={function(e){ setNewSubName(e.target.value); }} placeholder="Subsection name…" autoFocus
              onKeyDown={function(e){ if (e.key === 'Enter') addSection(sec.id); if (e.key === 'Escape') { setAddingSubFor(null); setNewSubName(''); } }}
              style={{ flex: 1, padding: '5px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, minWidth: 160 }} />
            <button onClick={function(){ addSection(sec.id); }} disabled={saving || !newSubName.trim()}
              style={{ padding: '5px 12px', background: C.green, color: '#fff', border: 0, borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: saving || !newSubName.trim() ? 'not-allowed' : 'pointer' }}>Save</button>
            <button onClick={function(){ setAddingSubFor(null); setNewSubName(''); }}
              style={{ padding: '5px 12px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {loadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.redBg, border: '0.5px solid ' + C.red, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: C.red }}>
          <span style={{ flex: 1 }}>⚠ {loadError}</span>
          <button onClick={loadData}
            style={{ padding: '5px 12px', borderRadius: 6, background: C.red, border: 'none', color: '#fff', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: C.darkCard, borderRadius: 8, marginBottom: 12, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: C.muted }}>
          <b style={{ color: C.text }}>Dish catalogue</b>
          {' · '}{topSections.length} sections{sections.length > topSections.length ? ' (' + (sections.length - topSections.length) + ' subsections)' : ''}
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
            {/* Wrapped, not passed by reference: onClick hands the handler a
                click event, which arrives as parentId and makes addSection
                treat a top-level section as a subsection.
                The disabled state is painted, not just declared — it used to
                keep the full green fill and only change the cursor, so an empty
                field left a button that looked live and did nothing. */}
            <button onClick={function(){ addSection(); }} disabled={saving || !newSectionName.trim()}
              style={{ padding: '5px 12px', color: '#fff', border: 0, borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: saving || !newSectionName.trim() ? C.border : C.green,
                opacity: saving || !newSectionName.trim() ? 0.75 : 1,
                cursor: saving || !newSectionName.trim() ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={function(){ setAddingSection(false); setNewSectionName(''); setAddError(''); }}
              style={{ padding: '5px 12px', background: 'transparent', color: C.muted, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            {addError && <span style={{ color: C.red, fontSize: 11.5 }}>{addError}</span>}
          </>
        )}
      </div>

      {loading && !hasLoadedOnce && <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12 }}>Loading…</div>}

      {hasLoadedOnce && !loading && sections.length === 0 && (
        <div style={{ padding: 30, textAlign: 'center', color: C.muted, fontSize: 12, background: C.surface, border: '0.5px dashed ' + C.border, borderRadius: 10 }}>
          No sections defined yet. Click <b>+ Add section</b> to create the first one.
        </div>
      )}

      {/* V73: bulk-move toolbar */}
      {isAdmin && bulkSel.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, marginBottom: 10, padding: '10px 14px', background: '#EAF2FA', border: '1.5px solid #7FA9D4', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1E5A8F' }}>{bulkSel.size} selected</span>
          <span style={{ fontSize: 12, color: C.muted }}>· Add to:</span>
          <select value=""
            onChange={function(e){ const v = e.target.value; if (v) bulkMoveTo(v); e.target.value = ''; }}
            title="Additive — adds every selected dish to the picked section without touching any section it's already in"
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #7FA9D4', background: C.surface, fontSize: 12, color: C.text, cursor: 'pointer', fontWeight: 600 }}>
            <option value="">— pick section —</option>
            {flatSectionOptions().map(function(o){
              return <option key={o.id} value={o.id}>{o.label}</option>;
            })}
            <option value="__unassign__">— Remove from every section —</option>
          </select>
          {props.onMergeDishes && (
            <button onClick={openDishMerge}
              title={bulkSel.size === 1 ? 'Rename this dish (updates every package that uses it)' : 'Merge selected dishes into one canonical name (updates every package)'}
              style={{ padding: '5px 12px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              🔀 {bulkSel.size === 1 ? 'Rename' : 'Merge'}
            </button>
          )}
          <button onClick={clearBulk}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      )}

      {hasLoadedOnce && topSections.length > 0 && (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
          <SortableContext items={topSectionIds} strategy={verticalListSortingStrategy}>
            {topSections.map(function(sec){
              return (
                <SortableItem key={sec.id} id={sec.id}>
                  {function(drag){ return sectionRow(sec, drag, false); }}
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* Unassigned bucket */}
      {hasLoadedOnce && unassignedList.length > 0 && (
        <div style={{ background: C.redBg, border: '0.5px solid ' + C.red, borderRadius: 10, marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
            <span style={{ cursor: 'pointer', color: C.red, fontSize: 11, padding: '0 2px' }} onClick={function(){ toggleExpand('__unassigned__'); }}>
              {expanded.has('__unassigned__') ? '▾' : '▸'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 22, borderRadius: 6, background: '#F4D3D3', fontSize: 11, fontWeight: 500, color: C.red }}>⚠</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.red, flex: 1, cursor: 'pointer' }} onClick={function(){ toggleExpand('__unassigned__'); }}>Unassigned</span>
            <span style={{ fontSize: 11, color: C.red, fontWeight: 500 }}>{unassignedList.length} dish{unassignedList.length === 1 ? '' : 'es'}</span>
          </div>
          {expanded.has('__unassigned__') && (function(){
            var q = unassignedSearch.trim().toLowerCase();
            var filtered = q ? unassignedList.filter(function(d){ return d.name.toLowerCase().indexOf(q) !== -1; }) : unassignedList;
            return (
            <div style={{ borderTop: '0.5px solid ' + C.red }}>
              <div style={{ padding: '8px 12px 8px 40px', fontSize: 11, color: C.red, fontStyle: 'italic' }}>
                These dishes exist in the master library but aren't in any section — they'll show under "Extras" in Menu Builder until assigned.
              </div>
              <div style={{ padding: '0 12px 8px 40px' }}>
                <input type="text" value={unassignedSearch} onChange={function(e){ setUnassignedSearch(e.target.value); }}
                  placeholder={'🔍 Search ' + unassignedList.length + ' unassigned dishes…'}
                  style={{ width: '100%', maxWidth: 320, fontSize: 12, padding: '6px 10px', border: '1px solid ' + C.red, borderRadius: 7, background: C.surface, color: C.text, boxSizing: 'border-box' }} />
                {q && <span style={{ fontSize: 11, color: C.red, marginLeft: 8 }}>{filtered.length} / {unassignedList.length}</span>}
              </div>
              {filtered.length === 0 ? (
                <div style={{ padding: '8px 12px 10px 40px', fontSize: 12, color: C.muted, fontStyle: 'italic' }}>No dishes match "{unassignedSearch.trim()}"</div>
              ) : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {filtered.map(function(d, di){ return dishRow(d, '__unassigned__', di, filtered.length); })}
                </div>
              )}
            </div>
            );
          })()}
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
              {flatSectionOptions(mergeModal.sourceId).map(function(o){
                const c = (dishesBySection[o.id] || []).length;
                return <option key={o.id} value={o.id}>{o.label} ({c})</option>;
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

      {/* Dish merge modal (duplicate dish NAMES, not sections) */}
      {dishMergeOpen && (
        <div onClick={closeDishMerge}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={function(e){ e.stopPropagation(); }}
            style={{ background: C.surface, borderRadius: 12, padding: 20, maxWidth: 480, width: '100%', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  🔀 {bulkSel.size === 1 ? 'Rename dish' : 'Merge ' + bulkSel.size + ' dishes'}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>The target name replaces the others in every menu package.</div>
              </div>
              <button onClick={closeDishMerge} disabled={dishMergeSaving}
                style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 20, cursor: dishMergeSaving ? 'not-allowed' : 'pointer', padding: 4 }}>×</button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Selected — click one to make it the target</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
              {Array.from(bulkSel).sort().map(function(n){
                const isT = n === dishMergeTarget;
                return (
                  <button key={n} onClick={function(){ setDishMergeTarget(n); }} disabled={dishMergeSaving}
                    style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, cursor: dishMergeSaving ? 'not-allowed' : 'pointer',
                      background: isT ? C.wine : C.bg, color: isT ? '#fff' : C.text,
                      border: '1px solid ' + (isT ? C.wine : C.border), fontWeight: isT ? 600 : 400 }}>
                    {isT ? '✓ ' : ''}{n}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Or type a new target name</div>
              <input value={dishMergeTarget} onChange={function(e){ setDishMergeTarget(e.target.value); }} disabled={dishMergeSaving}
                placeholder="Target dish name…"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, fontSize: 13, color: C.text, boxSizing: 'border-box' }} />
            </div>

            <div style={{ padding: '10px 12px', background: C.amberBg, border: '1px solid ' + C.amberBorder, borderRadius: 6, fontSize: 11, color: C.text, marginBottom: 14, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, color: C.amber, marginBottom: 4 }}>⚠ What this does</div>
              • Replaces the merged name(s) in every menu package that uses them<br/>
              • Deletes the merged dish(es) from the library<br/>
              • Drops the merged dishes' own Hindi / SOP / Inventory mappings — the target's are kept
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid ' + C.border }}>
              <button onClick={closeDishMerge} disabled={dishMergeSaving}
                style={{ padding: '6px 14px', borderRadius: 6, background: 'transparent', border: '1px solid ' + C.border, color: C.muted, fontSize: 12, fontWeight: 600, cursor: dishMergeSaving ? 'not-allowed' : 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmDishMerge} disabled={dishMergeSaving || !dishMergeTarget.trim()}
                style={{ padding: '6px 14px', borderRadius: 6, background: C.wine, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: (dishMergeSaving || !dishMergeTarget.trim()) ? 'not-allowed' : 'pointer', opacity: (dishMergeSaving || !dishMergeTarget.trim()) ? 0.5 : 1 }}>
                {dishMergeSaving ? 'Working…' : (bulkSel.size === 1 ? 'Rename' : 'Merge')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Both portal to <body>, so they sit above this screen's own modals
          rather than behind them. */}
      <KToast
        open={!!toast}
        toneName={toast && toast.tone}
        title={toast && toast.title}
        body={toast && toast.body}
        onClose={function(){ setToast(null); }}
      />
      <KModal
        open={!!dlg}
        toneName={dlg && dlg.tone}
        icon={dlg && dlg.icon}
        title={dlg && dlg.title}
        subhead={dlg && dlg.subhead}
        confirmLabel={dlg && dlg.confirmLabel}
        cancelLabel="Cancel"
        onConfirm={dlg && dlg.onConfirm}
        onClose={function(){ setDlg(null); }}
      />
    </div>
  );
}

export default DishSectionsEditor;