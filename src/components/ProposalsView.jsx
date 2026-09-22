// Ambria FnB — Proposals View (Sales)
// V70 Phase 2: list + create form + row actions + realtime
// Place in: src/components/ProposalsView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { hasPermission } from '../data/permissions.js';
import { AMBRIA_VENUES } from '../data/constants.js';
import { MENU_PACKAGES, MENU_PACKAGE_SECTIONS } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { supabase } from '../lib/supabase.js';
import { K, type } from '../utils/theme.js';
import { ripple } from '../utils/ripple.js';
import { Icon } from './Icons.jsx';
import { KButton, ModalWatermark, KModal } from './KitchenUI.jsx';
import { fetchAllRows } from '../lib/db.js';
import MenuBuilderView from './MenuBuilderView.jsx';

// ── Local enums for form pickers (kept here so no schema/DB coupling) ──
const EVENT_TYPES  = ["Wedding","Engagement","Reception","Sangeet","Cocktail","Birthday","Anniversary","Corporate","Baby Shower","Naming Ceremony","Retirement","Other"];
const SOURCES      = ["Instagram","Website","Referral","Walk-in","Repeat Client","Wedding Portal","Google","Other"];
// V71 — guest's diet requirement, filters the package picker
const DIET_OPTIONS = [
  { value: '',       label: 'Both' },
  { value: 'veg',    label: '🥬 Veg only' },
  { value: 'nonveg', label: '🍗 Non-Veg' },
];
// Sales venue codes = 4 catering venues (ODC excluded — proposals convert to on-property events)
const SALES_VENUES = AMBRIA_VENUES.filter(function(v){ return v.code !== 'ODC'; });

// Status colours come from the shared tokens rather than one-off hex, so a
// proposal status reads the same as every other status in the app.
const STATUS_META = {
  draft: { label: "Draft", bg: K.warnBg,   fg: K.warn,   border: K.warnBorder },
  sent:  { label: "Sent",  bg: K.accentSoft, fg: K.accent, border: K.accentBorder },
  won:   { label: "Won",   bg: K.okBg,     fg: K.ok,     border: K.okBorder },
  lost:  { label: "Lost",  bg: K.dangerBg, fg: K.danger, border: K.dangerBorder },
};

function emptyForm() {
  return {
    guest_name: "", phone: "", email: "",
    event_type: "", venue: "", event_date: "", pax: "",
    source: "",
    menu_diet: "",                        // '' | 'veg' | 'nonveg'
    tier_package_id: null,                // repurposed as menu_package_id (DB col name kept)
    notes: "",
  };
}

export function ProposalsView({ lang = "en", currentUser = null, empDb = [] }) {
  var T2 = function(s) { return T(s, lang); };
  var canCreate  = hasPermission(currentUser, 'proposals.create');
  var canViewAll = hasPermission(currentUser, 'proposals.view_all');
  var canConvert = hasPermission(currentUser, 'proposals.convert');

  var repId      = (currentUser && (currentUser.staff_id || currentUser.staffListId || currentUser.id)) || 'unknown';

  var [proposals, setProposals] = useState([]);
  var [loading, setLoading]     = useState(true);
  var [mode, setMode]           = useState('list'); // 'list' | 'new' | 'edit' | 'menu_builder'
  var [editingId, setEditingId] = useState(null);
  var [menuBuilderProposal, setMenuBuilderProposal] = useState(null);
  var [form, setForm]           = useState(emptyForm());
  var [saving, setSaving]       = useState(false);
  var [statusFilter, setStatusFilter] = useState('all');
  var [repFilter, setRepFilter]       = useState('all');
  var [searchQ, setSearchQ]           = useState('');

  // ── Load proposals (own vs all based on perm) ──
  async function loadProposals() {
    setLoading(true);
    try {
      var rows = await fetchAllRows(function(){
        var q = supabase.from('proposals').select('*').order('created_at', { ascending: false });
        if (!canViewAll) q = q.eq('rep_emp_id', repId);
        return q;
      });
      setProposals(rows);
    } catch (e) {
      console.error('[Proposals] load failed:', e);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadProposals(); /* eslint-disable-next-line */ }, [canViewAll, repId]);

  // ── Realtime subscription ──
  useEffect(function(){
    var chan = supabase.channel('proposals_rt_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, function(payload){
        var row = payload.new || payload.old;
        if (!canViewAll && row && row.rep_emp_id !== repId) return;
        if (payload.eventType === 'INSERT' && payload.new) {
          setProposals(function(prev){ if (prev.some(function(p){return p.id===payload.new.id;})) return prev; return [payload.new].concat(prev); });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setProposals(function(prev){ return prev.map(function(p){ return p.id===payload.new.id ? payload.new : p; }); });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setProposals(function(prev){ return prev.filter(function(p){ return p.id!==payload.old.id; }); });
        }
      })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  // eslint-disable-next-line
  }, [canViewAll, repId]);

  // V71 — all packages, sorted alphabetically, with auto-detected diet.
  // The picker below filters this list by form.menu_diet.
  // Note: we don't have package IDs in MENU_PACKAGES (name-keyed), so we derive
  // id from the loaded proposals table if any row already references this package.
  // Backup: query menu_packages once for the id map at mount time.
  var [pkgIdMap, setPkgIdMap] = useState({});   // { name → id }
  useEffect(function(){
    (async function(){
      try {
        var res = await supabase.from('menu_packages').select('id,name').eq('is_active', true);
        if (res.error) { console.warn('[Proposals] pkg id map load failed:', res.error); return; }
        var m = {};
        (res.data || []).forEach(function(r){ m[r.name] = r.id; });
        setPkgIdMap(m);
      } catch(e){ console.warn('[Proposals] pkg id map err:', e); }
    })();
  }, []);
  var allPackages = useMemo(function(){
    var out = [];
    Object.keys(MENU_PACKAGES).forEach(function(name){
      var dishes = MENU_PACKAGES[name] || [];
      out.push({
        name: name,
        id: pkgIdMap[name] || null,
        diet: detectPackageDiet(name),
        dishCount: dishes.length,
      });
    });
    out.sort(function(a,b){ return a.name.localeCompare(b.name); });
    return out;
  }, [pkgIdMap]);
  var filteredPackages = useMemo(function(){
    if (!form.menu_diet) return allPackages;                // 'Both' → all
    return allPackages.filter(function(p){
      if (!p.diet) return true;                             // unclassified show in both
      return p.diet === form.menu_diet;
    });
  }, [allPackages, form.menu_diet]);

  // ── Filtered list ──
  var repNameLookup = useMemo(function(){
    var m = {};
    (empDb || []).forEach(function(e){
      var id = e.staffListId || e.staff_id || e.id;
      if (id) m[id] = e.name || id;
    });
    return m;
  }, [empDb]);

  var filteredList = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return proposals.filter(function(p){
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (canViewAll && repFilter !== 'all' && p.rep_emp_id !== repFilter) return false;
      if (q && !(p.guest_name || '').toLowerCase().includes(q) && !(p.phone || '').includes(q)) return false;
      return true;
    });
  }, [proposals, statusFilter, repFilter, searchQ, canViewAll]);

  // Sorting and paging live here rather than in the table, so a filter change
  // can reset the page - otherwise filtering down to two rows while on page 3
  // shows an empty table with no explanation.
  var [sortKey, setSortKey] = useState('guest_name');
  var [sortDir, setSortDir] = useState('asc');
  var [page, setPage]       = useState(1);
  // The shell renders #kh-hdr-slot inside the page header plate; its DOM node
  // only exists after that commit, so it is read in an effect rather than
  // during render. Screen-level actions go there instead of sitting in a row
  // of their own above the content.
  // One dialog for every confirm and every failure on this screen. The browser
  // ones are unstyled OS chrome, cannot name what is being acted on in the
  // app's voice, and on a kiosk tablet can be suppressed entirely - which would
  // make a delete silent.
  var [dlg, setDlg] = useState(null);
  function ask(opts){ setDlg(opts); }
  function fail(title, err){ setDlg({ tone: 'danger', icon: 'alert', title: title, body: String((err && err.message) || err || ''), confirmLabel: T2('Close') }); }
  var [hdrSlot, setHdrSlot] = useState(null);
  useEffect(function(){ setHdrSlot(document.getElementById("kh-hdr-slot")); }, [mode]);
  var PAGE_SIZE = 12;
  useEffect(function(){ setPage(1); }, [searchQ, statusFilter, repFilter, sortKey, sortDir]);

  var sortedList = useMemo(function(){
    var dir = sortDir === 'desc' ? -1 : 1;
    var val = function(p){
      if (sortKey === 'pax') return p.pax == null ? -1 : Number(p.pax);
      if (sortKey === 'rep') return (repNameLookup[p.rep_emp_id] || p.rep_emp_id || '').toLowerCase();
      if (sortKey === 'menu_diet') return (p.menu_diet || '');
      return String(p[sortKey] || '').toLowerCase();
    };
    return filteredList.slice().sort(function(a,b){
      var av = val(a), bv = val(b);
      // Blanks sort last in both directions: a row with no date is missing
      // information, not the earliest date.
      var aEmpty = av === '' || av === -1, bEmpty = bv === '' || bv === -1;
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
  }, [filteredList, sortKey, sortDir, repNameLookup]);

  var pageCount = Math.max(1, Math.ceil(sortedList.length / PAGE_SIZE));
  var pageSafe  = Math.min(page, pageCount);
  var pagedList = sortedList.slice((pageSafe-1)*PAGE_SIZE, pageSafe*PAGE_SIZE);
  function toggleSort(key){
    if (sortKey === key) { setSortDir(function(d){ return d === 'asc' ? 'desc' : 'asc'; }); }
    else { setSortKey(key); setSortDir('asc'); }
  }

  var uniqueReps = useMemo(function(){
    var s = {}; proposals.forEach(function(p){ if (p.rep_emp_id) s[p.rep_emp_id] = true; });
    return Object.keys(s).sort();
  }, [proposals]);

  // ── Form helpers ──
  function updateForm(field, val) {
    setForm(function(prev){ var next = {}; Object.keys(prev).forEach(function(k){ next[k] = prev[k]; }); next[field] = val; return next; });
  }

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setMode('new');
  }
  function openEdit(p) {
    setForm({
      guest_name: p.guest_name || "", phone: p.phone || "", email: p.email || "",
      event_type: p.event_type || "", venue: p.venue || "",
      event_date: p.event_date || "", pax: p.pax != null ? String(p.pax) : "",
      source: p.source || "",
      menu_diet: p.menu_diet || "",
      tier_package_id: p.tier_package_id || null,
      notes: p.notes || "",
    });
    setEditingId(p.id);
    setMode('edit');
  }
  function cancelForm() {
    setForm(emptyForm());
    setEditingId(null);
    setMode('list');
  }

  function openMenuBuilder(p) {
    setMenuBuilderProposal(p);
    setMode('menu_builder');
  }
  function closeMenuBuilder() {
    // Refresh proposal so `menu_initialized` reflects any seeder change
    loadProposals();
    setMenuBuilderProposal(null);
    setMode('list');
  }

  // V79 — Won proposals become real booked functions: creates an events row,
  // copies proposal_items into event_items (mirrors the same table shape the
  // Booked Functions editor uses), and seeds events.menu with just the Kitchen-
  // dept subset (same dept resolution EventMenuBuilderView uses: package
  // section's own sales_dept first, then sales_items_meta, else Kitchen default)
  // so Kitchen Hub's production planning sees the right menu immediately.
  function convertToBooking(p) {
    if (!canConvert || p.converted_event_id || p.status !== 'won') return;
    ask({ tone: 'brand', icon: 'calendar',
      title: T2('Convert this proposal to a booking?'),
      subhead: <div style={{ fontSize: 15, fontWeight: 700, color: K.hdrTitle, overflowWrap: 'anywhere' }}>{p.guest_name}</div>,
      body: T2('This creates a real event from the proposal. It will show up under Booked Functions.'),
      confirmLabel: T2('Convert'),
      onConfirm: function(){ setDlg(null); doConvertToBooking(p); } });
  }
  async function doConvertToBooking(p) {

    var eventId = 'PROP-' + p.id;
    try {
      var pkgName = Object.keys(pkgIdMap).find(function(n){ return pkgIdMap[n] === p.tier_package_id; }) || null;

      var itemsRes = await supabase.from('proposal_items').select('*').eq('proposal_id', p.id);
      if (itemsRes.error) throw itemsRes.error;
      var items = itemsRes.data || [];

      var pkgSecs = pkgName ? MENU_PACKAGE_SECTIONS[pkgName] : null;
      var dishNameToPkgDept = {};
      if (pkgSecs) {
        pkgSecs.forEach(function(sec){
          var dept = sec.sales_dept || 'kit';
          (sec.dishes || []).forEach(function(name){ if (name) dishNameToPkgDept[name] = dept; });
        });
      }
      var metaRes = items.length > 0
        ? await supabase.from('sales_items_meta').select('dish_name, sales_dept').in('dish_name', items.map(function(it){ return it.dish_name; }))
        : { data: [] };
      var metaByName = {};
      (metaRes.data || []).forEach(function(r){ metaByName[r.dish_name] = r.sales_dept; });
      var kitchenNames = items.filter(function(it){
        var dept = dishNameToPkgDept[it.dish_name] || metaByName[it.dish_name] || 'kit';
        return dept === 'kit';
      }).map(function(it){ return it.dish_name; });

      var evRes = await supabase.from('events').insert({
        id: eventId,
        guest: p.guest_name,
        venue: p.venue,
        date: p.event_date,
        type: p.event_type,
        pax: p.pax,
        menu_package: pkgName,
        menu: kitchenNames,
        special: p.notes || null,
        event_items_initialized: true,
        // V87 — carry over any custom dish's section/subsection tag so it
        // shows in the same place if Build Menu opens this event next.
        menu_section_overrides: p.menu_section_overrides || {},
      }).select().single();
      if (evRes.error) throw evRes.error;

      if (items.length > 0) {
        var rows = items.map(function(it){ return { event_id: eventId, dish_name: it.dish_name, is_addon: it.is_addon, ordering: it.ordering }; });
        var insRes = await supabase.from('event_items').insert(rows);
        if (insRes.error) throw insRes.error;
      }

      // V88 — carry over Service/Crockery/Transport configs (waiters ratio,
      // uniforms, vehicles...) the same way items are carried over, so they
      // don't have to be re-entered once the proposal becomes a real function.
      var configsRes = await supabase.from('proposal_configs').select('dept_id,config_key,config_value').eq('proposal_id', p.id);
      if (!configsRes.error && configsRes.data && configsRes.data.length > 0) {
        var configRows = configsRes.data.map(function(c){ return { event_id: eventId, dept_id: c.dept_id, config_key: c.config_key, config_value: c.config_value }; });
        var configInsRes = await supabase.from('event_configs').insert(configRows);
        if (configInsRes.error) console.error('[Proposals] copying configs to event failed:', configInsRes.error);
      }

      if (p.notes) {
        await supabase.from('event_function_plans').upsert({ event_id: eventId, general_notes: p.notes }, { onConflict: 'event_id' });
      }

      var updRes = await supabase.from('proposals').update({ converted_event_id: eventId }).eq('id', p.id).select().single();
      if (updRes.error) throw updRes.error;
      setProposals(function(prev){ return prev.map(function(x){ return x.id === p.id ? updRes.data : x; }); });
      setDlg({ tone: 'ok', icon: 'check', title: T2('Converted to a booking'), body: T2('Find it under Booked Functions.'), confirmLabel: T2('Done') });
    } catch (e) {
      console.error('[Proposals] convertToBooking failed:', e);
      fail(T2('Could not convert this proposal'), e);
    }
  }

  function pickTemplate(pkg) {
    updateForm('tier_package_id', pkg.id);
  }

  async function saveProposal(newStatus) {
    if (!form.guest_name.trim()) { setDlg({ tone: 'warn', icon: 'alert', title: T2('Guest name is required'), body: T2('A proposal without a name cannot be found again.'), confirmLabel: T2('Close') }); return; }
    if (!form.venue) { setDlg({ tone: 'warn', icon: 'alert', title: T2('Pick a venue'), body: T2('The venue decides which kitchen and menu the proposal belongs to.'), confirmLabel: T2('Close') }); return; }
    if (saving) return;
    setSaving(true);
    // Snapshot the pre-edit row so we can tell, after saving, whether the
    // template actually changed on an existing proposal — see reset block below.
    var origProposal = editingId ? proposals.find(function(p){ return p.id === editingId; }) : null;
    var payload = {
      rep_emp_id: repId,
      guest_name: form.guest_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      event_type: form.event_type || null,
      venue: form.venue || null,
      event_date: form.event_date || null,
      pax: form.pax ? parseInt(form.pax, 10) : null,
      source: form.source || null,
      menu_diet: form.menu_diet || null,
      tier_package_id: form.tier_package_id || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (newStatus) payload.status = newStatus;
    try {
      var res;
      if (editingId) {
        res = await supabase.from('proposals').update(payload).eq('id', editingId).select().single();
      } else {
        payload.status = payload.status || 'draft';
        res = await supabase.from('proposals').insert(payload).select().single();
      }
      if (res.error) throw res.error;
      var saved = res.data;

      // Template swapped on a proposal whose menu was already built: the old
      // seed (proposal_items from the PREVIOUS template) would otherwise stick
      // around forever and get misread as "add-ons" against the new template
      // (see the Chatori Chaat bug — a proposal seeded from Luxury Veg, then
      // switched to Double Magnum Non Veg, kept showing Luxury Veg's dishes).
      // Reset means: wipe the stale items and clear menu_initialized so the
      // existing seedTemplateIfNeeded() in MenuBuilderView re-seeds cleanly
      // from the new template next time Build Menu is opened.
      if (origProposal && origProposal.menu_initialized && origProposal.tier_package_id !== saved.tier_package_id) {
        try {
          var delRes = await supabase.from('proposal_items').delete().eq('proposal_id', saved.id);
          if (delRes.error) throw delRes.error;
          var reinitRes = await supabase.from('proposals').update({ menu_initialized: false }).eq('id', saved.id).select().single();
          if (reinitRes.error) throw reinitRes.error;
          saved = reinitRes.data;
        } catch (e) {
          console.error('[Proposals] template-switch reset failed:', e);
          fail(T2('Package changed, but the old menu selections were not cleared'), e);
        }
      }

      setProposals(function(prev){
        var idx = prev.findIndex(function(p){ return p.id === saved.id; });
        if (idx >= 0) { var copy = prev.slice(); copy[idx] = saved; return copy; }
        return [saved].concat(prev);
      });
      cancelForm();
    } catch (e) {
      console.error('[Proposals] save failed:', e);
      fail(T2('Could not save this proposal'), e);
    } finally {
      setSaving(false);
    }
  }

  function duplicateProposal(p) {
    ask({ tone: 'brand', icon: 'layers',
      title: T2('Duplicate this proposal?'),
      subhead: <div style={{ fontSize: 15, fontWeight: 700, color: K.hdrTitle, overflowWrap: 'anywhere' }}>{p.guest_name}</div>,
      body: T2('A copy is created as a new draft, without the event date. The original is untouched.'),
      confirmLabel: T2('Duplicate'),
      onConfirm: function(){ setDlg(null); doDuplicateProposal(p); } });
  }
  async function doDuplicateProposal(p) {
    var payload = {
      rep_emp_id: repId,
      guest_name: p.guest_name + ' (copy)',
      phone: p.phone, email: p.email,
      event_type: p.event_type, venue: p.venue,
      event_date: null, pax: p.pax, source: p.source,
      menu_diet: p.menu_diet,
      tier_package_id: p.tier_package_id,
      notes: p.notes,
      status: 'draft',
    };
    try {
      var res = await supabase.from('proposals').insert(payload).select().single();
      if (res.error) throw res.error;
      setProposals(function(prev){ return [res.data].concat(prev); });
    } catch (e) {
      fail(T2('Could not duplicate this proposal'), e);
    }
  }

  function deleteProposal(p) {
    ask({ tone: 'danger', icon: 'trash',
      title: T2('Delete this proposal?'),
      subhead: <div style={{ fontSize: 15, fontWeight: 700, color: K.hdrTitle, overflowWrap: 'anywhere' }}>{p.guest_name}</div>,
      body: T2('It is removed for everyone. This cannot be undone.'),
      confirmLabel: T2('Delete proposal'),
      onConfirm: function(){ setDlg(null); doDeleteProposal(p); } });
  }
  async function doDeleteProposal(p) {
    try {
      var res = await supabase.from('proposals').delete().eq('id', p.id);
      if (res.error) throw res.error;
      setProposals(function(prev){ return prev.filter(function(x){ return x.id !== p.id; }); });
    } catch (e) {
      fail(T2('Could not delete this proposal'), e);
    }
  }

  async function updateStatus(p, newStatus) {
    try {
      var res = await supabase.from('proposals').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', p.id).select().single();
      if (res.error) throw res.error;
      setProposals(function(prev){ return prev.map(function(x){ return x.id===p.id ? res.data : x; }); });
    } catch (e) {
      fail(T2('Could not change the status'), e);
    }
  }

  // ── RENDER: menu builder takes over the full viewport ──
  if (mode === 'menu_builder' && menuBuilderProposal) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: K.shellBg }}>
        <MenuBuilderView proposal={menuBuilderProposal} onClose={closeMenuBuilder} lang={lang} currentUser={currentUser} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Screen actions live in the page header plate, portalled into the slot
          the shell renders there, so they sit on the banner rather than in a
          row of their own pushing the list down. */}
      {hdrSlot && createPortal((
        <>
          {mode === 'list' && canCreate && (
            <KButton variant="brand" icon="plus" onClick={openNew}
              style={{ padding: "12px 22px", borderRadius: K.rPill, fontSize: 14.5 }}>{T2("New Proposal")}</KButton>
          )}
          {mode !== 'list' && (
            <KButton icon="chevronL" onClick={cancelForm}
              style={{ padding: "11px 18px", borderRadius: K.rPill, fontSize: 14, background: "#FFFFFF", borderColor: K.hdrChipLine }}>
              {T2("Back to list")}
            </KButton>
          )}
        </>
      ), hdrSlot)}

      {/* ── FORM (new / edit) ── */}
      {/* A dialog, not a panel pushed in above the list: editing a proposal is
          a task you finish and leave, and inline it left the table hanging
          below with no way to tell which row you were on. */}
      {mode !== 'list' && (
        <div onClick={saving ? undefined : cancelForm}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: K.modalScrim,
            display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px 20px", overflowY: "auto" }}>
          <div onClick={function(e){ e.stopPropagation(); }} role="dialog" aria-modal="true"
            style={{ position: "relative", background: K.modalBg, border: "1px solid " + K.modalLine,
              borderRadius: K.modalRadius, boxShadow: K.shadowLift, maxWidth: 1180, width: "100%", overflow: "hidden" }}>
            <ModalWatermark />

            <div style={{ position: "relative", zIndex: 1, padding: "16px 24px 12px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, backgroundColor: K.cardWarm,
                border: "1px solid " + K.hdrLine, color: K.sbGold,
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="note" size={22} strokeWidth={1.6} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", ...type.sectionHead, fontSize: 23, color: K.hdrTitle }}>
                  {mode === 'edit' ? T2("Edit Proposal") : T2("New Proposal")}
                </span>
                <span style={{ display: "block", fontSize: 13, color: K.hdrMeta, marginTop: 1 }}>
                  {T2("Update guest details, event information and menu preferences.")}
                </span>
              </span>
              <button onClick={cancelForm} disabled={saving} aria-label={T2("Cancel")}
                className="kh-modal-x kh-rip" onPointerDown={ripple}
                style={{ width: 40, height: 40, borderRadius: K.rPill, flexShrink: 0, background: K.surface,
                  border: "1px solid " + K.modalLine, color: K.textMuted, cursor: "pointer", padding: 0,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={18} strokeWidth={2.1} />
              </button>
            </div>

            <div style={{ position: "relative", zIndex: 1, padding: "0 24px 18px" }}>
              <div style={{ background: "#FFFFFF", border: "1px solid " + K.line, borderRadius: 18, padding: "15px 18px", marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(225px, 1fr))", gap: 12 }}>
                  <Field label={T2("Guest name")} required icon="contact" value={form.guest_name}
                    onChange={function(v){ updateForm('guest_name', v); }} placeholder={T2("Full name")} />
                  <Field label={T2("Phone")} icon="contact" value={form.phone}
                    onChange={function(v){ updateForm('phone', v); }} placeholder="+91 98…" />
                  <Field label={T2("Email")} icon="note" value={form.email}
                    onChange={function(v){ updateForm('email', v); }} placeholder="guest@…" />
                  <SelectField label={T2("Event type")} icon="calendar" value={form.event_type}
                    onChange={function(v){ updateForm('event_type', v); }} options={EVENT_TYPES}
                    placeholder={T2("Pick event type")} />
                  <Field label={T2("Event date")} type="date" icon="calendarDays" value={form.event_date}
                    onChange={function(v){ updateForm('event_date', v); }} />
                  <Field label={T2("Pax")} required icon="users" value={form.pax}
                    onChange={function(v){ updateForm('pax', v.replace(/[^0-9]/g,'')); }} placeholder="300" />
                  <SelectField label={T2("Source")} icon="tag" value={form.source}
                    onChange={function(v){ updateForm('source', v); }} options={SOURCES}
                    placeholder={T2("How did they find us?")} />
                  <SelectField label={T2("Venue")} required icon="building" value={form.venue}
                    onChange={function(v){ updateForm('venue', v); }}
                    options={SALES_VENUES.map(function(v){ return { value: v.code, label: v.code + ' — ' + v.name.replace(/^Ambria\s*/,'') }; })}
                    placeholder={T2("Pick venue")} />
                </div>
              </div>

              <div style={{ background: "#FFFFFF", border: "1px solid " + K.line, borderRadius: 18, padding: "14px 18px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: K.brandBg,
                      border: "1px solid " + K.brandBorder, color: K.brand,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="utensils" size={17} strokeWidth={1.8} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.2px", color: K.hdrTitle }}>{T2("Menu Template")}</span>
                      <span style={{ display: "block", fontSize: 13.5, color: K.hdrMeta, marginTop: 2 }}>
                        {T2("Choose a menu template or start from scratch. You can customise it later.")}
                      </span>
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, color: K.hdrMeta }}>{T2("Guest diet preference")}:</span>
                    {DIET_OPTIONS.map(function(opt){
                      var isSel = form.menu_diet === opt.value;
                      var fg = opt.value === 'nonveg' ? K.danger : opt.value === 'veg' ? K.ok : K.brand;
                      return (
                        <button key={opt.value || 'both'} type="button" onClick={function(){ updateForm('menu_diet', opt.value); }}
                          className="kh-rip" onPointerDown={ripple}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: K.rPill,
                            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: K.fontBody,
                            background: isSel ? (opt.value ? fg : K.brand) : "#FFFFFF",
                            color: isSel ? "#FFFFFF" : K.textBody,
                            border: "1px solid " + (isSel ? (opt.value ? fg : K.brand) : K.line) }}>
                          {opt.value && <Icon name="apple" size={14} strokeWidth={2} />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </span>
                </div>

                {allPackages.length === 0 && (
                  <div style={{ padding: "16px 18px", background: K.warnBg, border: "1px dashed " + K.warnBorder,
                    borderRadius: 14, fontSize: 13.5, color: K.warn }}>
                    {T2("No menu packages yet. Create some in Menu Packages first.")}
                  </div>
                )}

                {allPackages.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(203px, 1fr))", gap: 10 }}>
                    <button type="button" onClick={function(){ updateForm('tier_package_id', null); }}
                      className="kh-rip kh-pressrow is-sage" onPointerDown={ripple}
                      style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px", borderRadius: 14,
                        background: !form.tier_package_id ? K.sageBg : "#FFFFFF",
                        border: "1.5px solid " + (!form.tier_package_id ? K.sage : K.line),
                        textAlign: "left", cursor: "pointer", fontFamily: K.fontBody, color: K.sage }}>
                      <span style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: K.brand, color: "#FFFFFF",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="plus" size={18} strokeWidth={2.1} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: K.hdrTitle, lineHeight: 1.25 }}>{T2("Start from scratch")}</span>
                        <span style={{ display: "block", fontSize: 12, color: K.hdrMeta, marginTop: 3 }}>{T2("Build menu without a template")}</span>
                      </span>
                    </button>
                    {filteredPackages.map(function(pkg){
                      var isSel = form.tier_package_id === pkg.id;
                      var isNV = pkg.diet === 'nonveg';
                      var dietFg = isNV ? K.danger : pkg.diet === 'veg' ? K.ok : K.textFaint;
                      var dietBg = isNV ? K.dangerBg : pkg.diet === 'veg' ? K.okBg : K.surfaceAlt;
                      var dietBd = isNV ? K.dangerBorder : pkg.diet === 'veg' ? K.okBorder : K.line;
                      var dietLabel = isNV ? T2("Non-Veg") : pkg.diet === 'veg' ? T2("Veg") : T2("Mixed");
                      return (
                        <button key={pkg.id || pkg.name} type="button" onClick={function(){ pickTemplate(pkg); }}
                          disabled={!pkg.id} className="kh-rip" onPointerDown={ripple}
                          title={!pkg.id ? T2('Package id not loaded yet — refresh?') : ''}
                          style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px", borderRadius: 14,
                            background: isSel ? K.brandBg : "#FFFFFF",
                            border: "1.5px solid " + (isSel ? K.brand : K.line),
                            textAlign: "left", cursor: pkg.id ? "pointer" : "not-allowed",
                            opacity: pkg.id ? 1 : 0.55, fontFamily: K.fontBody }}>
                          {/* A tinted tile, not a photograph: menu packages carry
                              no image of their own, and a stock picture would
                              claim to show a menu it has never seen. */}
                          <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                            background: dietBg, border: "1px solid " + dietBd, color: dietFg,
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="utensils" size={18} strokeWidth={1.8} />
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: K.hdrTitle, lineHeight: 1.25 }}>{pkg.name}</span>
                            <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: K.rPill,
                                background: dietBg, color: dietFg, border: "1px solid " + dietBd, whiteSpace: "nowrap" }}>{dietLabel}</span>
                              <span style={{ fontSize: 12, color: K.hdrMeta }}>{pkg.dishCount} {T2("dishes")}</span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {filteredPackages.length === 0 && (
                      <div style={{ gridColumn: "1 / -1", padding: "16px", textAlign: "center", fontSize: 13.5, color: K.hdrMeta }}>
                        {T2("No packages match this diet. Rename your package to include 'Veg' or 'Non-Veg', or pick a different diet.")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <span style={{ color: K.sbGold, display: "flex" }}><Icon name="note" size={17} strokeWidth={1.8} /></span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: K.hdrTitle }}>{T2("Internal notes")}</span>
                </div>
                <textarea value={form.notes} onChange={function(e){ updateForm('notes', e.target.value); }}
                  placeholder={T2("Any client requests, dietary notes, deadlines…")}
                  style={{ width: "100%", minHeight: 88, padding: "13px 15px", borderRadius: 14,
                    border: "1px solid " + K.line, background: "#FFFFFF", fontSize: 14, color: K.text,
                    boxSizing: "border-box", resize: "vertical", fontFamily: K.fontBody, outline: "none", lineHeight: 1.55 }} />
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 1, padding: "18px 28px 24px", borderTop: "1px solid " + K.modalLine,
              display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <KButton onClick={cancelForm} disabled={saving}
                style={{ padding: "14px 24px", borderRadius: K.rPill, fontSize: 14.5, background: K.surface, borderColor: K.modalLine }}>
                {T2("Cancel")}
              </KButton>
              <KButton icon="check" onClick={function(){ saveProposal(); }} disabled={saving}
                style={{ padding: "14px 24px", borderRadius: K.rPill, fontSize: 14.5, background: K.brandBg,
                  borderColor: K.brandBorder, color: K.brandText }}>
                {saving ? T2("Saving…") : (mode === 'edit' ? T2("Save changes") : T2("Save as draft"))}
              </KButton>
              {mode === 'edit' && (
                <KButton variant="brand" icon="utensils" disabled={saving}
                  onClick={function(){ var p = proposals.find(function(x){ return x.id === editingId; }); if (p) openMenuBuilder(p); }}
                  title={T2("Open the Menu Builder for this proposal")}
                  style={{ padding: "14px 26px", borderRadius: K.rPill, fontSize: 14.5 }}>
                  {T2("Build Menu")}
                </KButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <>
          {(function(){
            // minWidth, because each pill otherwise sizes to its own select and
            // "All statuses" came out visibly wider than "All reps" — two
            // controls doing the same job at two different widths.
            var pill = { display: "inline-flex", alignItems: "center", gap: 9, padding: "0 4px 0 16px",
              minWidth: 178, borderRadius: K.rPill, background: "#FFFFFF", border: "1px solid " + K.cardWarmLine,
              boxShadow: K.shadowCard, color: K.textBody, fontSize: 14, fontWeight: 600, flexShrink: 0 };
            var pillSel = { flex: 1, minWidth: 0, padding: "14px 10px 14px 0", border: "none", outline: "none",
              background: "transparent", fontSize: 14, fontWeight: 600, color: K.textBody, cursor: "pointer",
              fontFamily: K.fontBody };
            return (
              <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative", flex: "0 1 420px", minWidth: 220 }}>
                  <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
                    color: K.textFaint, display: "flex", pointerEvents: "none" }}>
                    <Icon name="search" size={18} strokeWidth={1.9} />
                  </span>
                  <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
                    placeholder={T2("Search guest name or phone…")}
                    style={{ width: "100%", padding: "15px 18px 15px 50px", borderRadius: K.rPill,
                      border: "1px solid " + K.cardWarmLine, fontSize: 14.5, color: K.text, background: "#FFFFFF",
                      boxSizing: "border-box", boxShadow: K.shadowCard, fontFamily: K.fontBody, outline: "none" }} />
                </div>
                <span style={pill}>
                  <Icon name="listCheck" size={17} strokeWidth={1.9} />
                  <select className="kh-select" value={statusFilter} onChange={function(e){ setStatusFilter(e.target.value); }} style={pillSel}>
                    <option value="all">{T2("All statuses")}</option>
                    <option value="draft">{T2("Draft")}</option>
                    <option value="sent">{T2("Sent")}</option>
                    <option value="won">{T2("Won")}</option>
                    <option value="lost">{T2("Lost")}</option>
                  </select>
                </span>
                {canViewAll && (
                  <span style={pill}>
                    <Icon name="users" size={17} strokeWidth={1.9} />
                    <select className="kh-select" value={repFilter} onChange={function(e){ setRepFilter(e.target.value); }} style={pillSel}>
                      <option value="all">{T2("All reps")}</option>
                      {uniqueReps.map(function(rid){ return <option key={rid} value={rid}>{repNameLookup[rid] || rid}</option>; })}
                    </select>
                  </span>
                )}
                <span style={{ fontSize: 14, color: K.hdrMeta, marginLeft: "auto" }}>
                  {filteredList.length} {filteredList.length === 1 ? T2("proposal") : T2("proposals")}
                </span>
              </div>
            );
          })()}

          {loading && (
            <div className="kh-cardart-sm" style={{ padding: "60px 20px", textAlign: "center", backgroundColor: K.cardWarm,
              border: "1px solid " + K.cardWarmLine, borderRadius: 20, boxShadow: K.shadowCard }}>
              <div style={{ color: K.textFaint, display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="refresh" size={28} strokeWidth={1.7} />
              </div>
              <div style={{ fontSize: 14, color: K.hdrMeta }}>{T2("Loading proposals…")}</div>
            </div>
          )}

          {!loading && filteredList.length === 0 && (
            <div className="kh-cardart-sm" style={{ backgroundColor: K.cardWarm, borderRadius: 20,
              border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard, padding: "60px 24px", textAlign: "center" }}>
              <div style={{ color: K.textFaint, display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <Icon name="note" size={38} strokeWidth={1.5} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.2px", color: K.hdrTitle, marginBottom: 6 }}>
                {proposals.length === 0 ? T2("No proposals yet") : T2("No matches")}
              </div>
              <div style={{ fontSize: 14, color: K.hdrMeta, maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>
                {proposals.length === 0
                  ? T2("Click New Proposal to capture your first prospect.")
                  : T2("Try clearing filters or search.")}
              </div>
            </div>
          )}

          {!loading && filteredList.length > 0 && (function(){
            // The actions column is a fixed width, and this is load-bearing.
            // The header and every row are separate grids, so a content-sized
            // track resolves differently in each of them: the header holds one
            // short word, the rows hold four controls, and the fr columns either
            // side then land in different places - which is how Draft ended up
            // under REP and Edit under STATUS. A fixed track is identical
            // everywhere, so the columns line up by construction.
            // Two widths, because a won proposal grows a Convert button (or a
            // Booked pill) and reserving room for it on every page would leave a
            // hole on the ones that have none.
            var wideActions = canConvert && pagedList.some(function(p){ return p.status === 'won'; });
            var actionsCol = wideActions ? "392px" : "284px";
            var cols = (canViewAll
              ? "minmax(210px,1.5fr) 0.8fr 1fr 0.6fr 0.9fr 0.8fr 0.9fr "
              : "minmax(210px,1.5fr) 0.8fr 1fr 0.6fr 0.9fr 0.9fr ") + actionsCol;
            // One header cell: a button, because it sorts. The arrows show which
            // column is active and which way, rather than sitting inert on all.
            var SortHead = function(props){
              var active = sortKey === props.k;
              return (
                <button onClick={function(){ toggleSort(props.k); }} className="kh-rip" onPointerDown={ripple}
                  title={T2("Sort by") + " " + props.label}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none",
                    padding: 0, cursor: "pointer", textAlign: props.right ? "right" : "left",
                    justifyContent: props.right ? "flex-end" : "flex-start",
                    ...type.label, fontSize: 11, color: active ? K.brandText : K.hdrMeta, fontFamily: K.fontBody }}>
                  {props.icon && <Icon name={props.icon} size={13} strokeWidth={2} />}
                  {props.label}
                  <span style={{ display: "flex", color: active ? K.brand : K.lineStrong }}>
                    <Icon name="chevronD" size={12} strokeWidth={2.4}
                      style={{ transform: active && sortDir === 'asc' ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </span>
                </button>
              );
            };
            return (
            <div className="kh-cardart-sm" style={{ backgroundColor: K.cardWarm, borderRadius: 20,
              border: "1px solid " + K.cardWarmLine, boxShadow: K.shadowCard, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 980 }}>
                  <div style={{ display: "grid", gridTemplateColumns: cols, gap: 14, alignItems: "center",
                    padding: "14px 18px", background: K.brandSoft, borderBottom: "1px solid " + K.cardWarmLine }}>
                    <SortHead k="guest_name" label={T2("Guest / Event")} />
                    <SortHead k="venue"      label={T2("Venue")} />
                    <SortHead k="event_date" label={T2("Date")} />
                    <SortHead k="pax"        label={T2("Pax")} />
                    <SortHead k="menu_diet"  label={T2("Diet")} />
                    {canViewAll && <SortHead k="rep" label={T2("Rep")} />}
                    <SortHead k="status"     label={T2("Status")} />
                    <span style={{ ...type.label, fontSize: 11, color: K.hdrMeta, justifySelf: "end" }}>{T2("Actions")}</span>
                  </div>

                  {pagedList.map(function(p){
                    var meta = STATUS_META[p.status] || STATUS_META.draft;
                    var pDiet = p.menu_diet || null;
                    var dietFg = pDiet === 'nonveg' ? K.danger : pDiet === 'veg' ? K.ok : K.textFaint;
                    var dietLabel = pDiet === 'nonveg' ? T2("Non-Veg") : pDiet === 'veg' ? T2("Veg") : T2("Not specified");
                    // Muted placeholder cells rather than a bare dash: "Not set"
                    // says the field is empty on purpose-unknown, a dash alone
                    // reads as a value.
                    var blank = function(label){ return (
                      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                        <span style={{ color: K.lineStrong, fontSize: 15 }}>—</span>
                        <span style={{ color: K.textFaint, fontSize: 12 }}>{label}</span>
                      </span>
                    ); };
                    return (
                      <div key={p.id} className="kh-proprow" style={{ display: "grid", gridTemplateColumns: cols, gap: 14,
                        alignItems: "center", padding: "14px 18px", background: "#FFFFFF",
                        borderBottom: "1px solid " + K.lineSoft }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
                          <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                            background: K.warnBg, border: "1px solid " + K.warnBorder,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: K.fontDisplay, fontSize: 20, fontWeight: 600, color: K.warn }}>
                            {String(p.guest_name || "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px",
                              color: K.hdrTitle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.guest_name}</span>
                            <span style={{ display: "block", fontSize: 13, color: K.hdrMeta, marginTop: 2,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.event_type || T2("Event")}{p.phone ? ' · ' + p.phone : ''}
                            </span>
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: K.text, minWidth: 0 }}>
                          {p.venue ? (<><Icon name="building" size={15} strokeWidth={1.9} style={{ color: K.textFaint }} />{p.venue}</>) : blank(T2("Not set"))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: K.text, minWidth: 0 }}>
                          {p.event_date ? (<><Icon name="calendar" size={15} strokeWidth={1.9} style={{ color: K.textFaint }} />{p.event_date}</>) : blank(T2("Not set"))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700,
                          color: K.text, fontVariantNumeric: "tabular-nums" }}>
                          {p.pax != null ? (<><Icon name="users" size={15} strokeWidth={1.9} style={{ color: K.textFaint }} />{p.pax}</>) : blank(T2("Not set"))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: dietFg, minWidth: 0 }}>
                          {pDiet ? (<><Icon name="apple" size={15} strokeWidth={1.9} />{dietLabel}</>) : blank(T2("Not specified"))}
                        </div>
                        {canViewAll && (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: K.text, minWidth: 0 }}>
                            <Icon name="contact" size={15} strokeWidth={1.9} style={{ color: K.textFaint }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {repNameLookup[p.rep_emp_id] || p.rep_emp_id}
                            </span>
                          </div>
                        )}
                        <div>
                          {/* The status pill IS the control. A separate select
                              beside a coloured chip made people read the chip and
                              miss that it could be changed. */}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "0 4px 0 12px",
                            borderRadius: K.rPill, background: meta.bg, border: "1px solid " + meta.border }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.fg, flexShrink: 0 }} />
                            <select className="kh-select" value={p.status} onChange={function(e){ updateStatus(p, e.target.value); }}
                              style={{ padding: "8px 6px 8px 0", border: "none", outline: "none", background: "transparent",
                                fontSize: 13.5, fontWeight: 700, color: meta.fg, cursor: "pointer", fontFamily: K.fontBody }}>
                              <option value="draft">{T2("Draft")}</option>
                              <option value="sent">{T2("Sent")}</option>
                              <option value="won">{T2("Won")}</option>
                              <option value="lost">{T2("Lost")}</option>
                            </select>
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <KButton size="sm" icon="note" onClick={function(){ openEdit(p); }} title={T2("View / Edit")}
                            style={{ padding: "10px 14px", borderRadius: 11, fontSize: 13.5, background: "#FFFFFF", borderColor: K.cardWarmLine }}>
                            {T2("Edit")}
                          </KButton>
                          <KButton size="sm" variant="brand" icon="utensils" onClick={function(){ openMenuBuilder(p); }} title={T2("Open Menu Builder")}
                            style={{ padding: "10px 14px", borderRadius: 11, fontSize: 13.5 }}>
                            {T2("Menu")}
                          </KButton>
                          {canConvert && p.status === 'won' && (
                            p.converted_event_id ? (
                              <span title={T2("Already converted to a booking")}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 11,
                                  background: K.okBg, border: "1px solid " + K.okBorder, color: K.ok, fontSize: 13, fontWeight: 700 }}>
                                <Icon name="check" size={14} strokeWidth={2.2} />{T2("Booked")}
                              </span>
                            ) : (
                              <KButton size="sm" icon="calendar" onClick={function(){ convertToBooking(p); }} title={T2("Convert to a booked function")}
                                style={{ padding: "10px 14px", borderRadius: 11, fontSize: 13.5, background: K.okBg, borderColor: K.okBorder, color: K.ok }}>
                                {T2("Convert")}
                              </KButton>
                            )
                          )}
                          <button onClick={function(){ duplicateProposal(p); }} title={T2("Duplicate")}
                            className="kh-rip kh-iconbtn" onPointerDown={ripple}
                            style={{ width: 38, height: 38, borderRadius: 11, background: "#FFFFFF", cursor: "pointer", padding: 0,
                              border: "1px solid " + K.cardWarmLine, color: K.textMuted,
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="layers" size={16} />
                          </button>
                          <button onClick={function(){ deleteProposal(p); }} title={T2("Delete")}
                            className="kh-rip" onPointerDown={ripple}
                            style={{ width: 38, height: 38, borderRadius: 11, background: K.dangerBg, cursor: "pointer", padding: 0,
                              border: "1px solid " + K.dangerBorder, color: K.danger,
                              display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "14px 18px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, color: K.hdrMeta }}>
                  {T2("Showing")} {pagedList.length} {T2("of")} {sortedList.length} {sortedList.length === 1 ? T2("proposal") : T2("proposals")}
                </span>
                {pageCount > 1 && (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={function(){ setPage(Math.max(1, pageSafe - 1)); }} disabled={pageSafe === 1}
                      title={T2("Previous")} className="kh-rip" onPointerDown={ripple}
                      style={{ width: 38, height: 38, borderRadius: 11, background: "#FFFFFF", padding: 0,
                        border: "1px solid " + K.cardWarmLine, color: pageSafe === 1 ? K.lineStrong : K.textBody,
                        cursor: pageSafe === 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="chevronL" size={16} strokeWidth={2.1} />
                    </button>
                    {Array.from({ length: pageCount }).map(function(_, i){
                      var n = i + 1, on = n === pageSafe;
                      return (
                        <button key={n} onClick={function(){ setPage(n); }} className="kh-rip" onPointerDown={ripple}
                          style={{ minWidth: 38, height: 38, borderRadius: 11, padding: "0 10px", cursor: "pointer",
                            background: on ? K.brand : "#FFFFFF", color: on ? "#FFFFFF" : K.textBody,
                            border: "1px solid " + (on ? K.brand : K.cardWarmLine), fontSize: 14, fontWeight: 700,
                            fontFamily: K.fontBody, fontVariantNumeric: "tabular-nums" }}>{n}</button>
                      );
                    })}
                    <button onClick={function(){ setPage(Math.min(pageCount, pageSafe + 1)); }} disabled={pageSafe === pageCount}
                      title={T2("Next")} className="kh-rip" onPointerDown={ripple}
                      style={{ width: 38, height: 38, borderRadius: 11, background: "#FFFFFF", padding: 0,
                        border: "1px solid " + K.cardWarmLine, color: pageSafe === pageCount ? K.lineStrong : K.textBody,
                        cursor: pageSafe === pageCount ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="chevronR" size={16} strokeWidth={2.1} />
                    </button>
                  </span>
                )}
              </div>
            </div>
            );
          })()}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: K.hdrMeta }}>
        {T2("Signed in as")} <b style={{ color: K.hdrTitle }}>{(currentUser && currentUser.name) || repId}</b> · {T2("role")}: <b style={{ color: C.text }}>{(currentUser && currentUser.role) || '—'}</b>
      </div>

      {/* One dialog for the whole screen: confirms carry an onConfirm, plain
          reports do not and their button just closes. */}
      <KModal
        open={!!dlg}
        toneName={dlg && dlg.tone}
        icon={dlg && dlg.icon}
        title={dlg && dlg.title}
        subhead={dlg && dlg.subhead}
        body={dlg && dlg.body}
        confirmLabel={dlg && dlg.confirmLabel}
        cancelLabel={T2("Cancel")}
        onConfirm={dlg && dlg.onConfirm}
        onClose={function(){ setDlg(null); }}
      />
    </div>
  );
}

// ── Small form field components ──
// The icon lives inside the field so the label above it stays a plain word, and
// a required field marks itself rather than carrying a " *" glued to its label.
const FIELD_SHELL = {
  display: "flex", alignItems: "center", background: "#FFFFFF", borderRadius: 12,
  border: "1px solid " + K.line, overflow: "hidden",
};
const FIELD_PRE = {
  display: "flex", alignItems: "center", alignSelf: "stretch", padding: "0 11px",
  color: K.textFaint, borderRight: "1px solid " + K.lineSoft,
};
const FIELD_INPUT = {
  flex: 1, minWidth: 0, padding: "10px 12px", border: "none", outline: "none",
  background: "transparent", fontSize: 14, color: K.text, fontFamily: K.fontBody,
};
function FieldLabel({ label, required }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: K.hdrTitle, marginBottom: 5 }}>
      {label}{required && <span style={{ color: K.danger }}> *</span>}
    </div>
  );
}
function Field({ label, value, onChange, placeholder, type, icon, required }) {
  return (
    <label style={{ display: "block" }}>
      <FieldLabel label={label} required={required} />
      <div style={FIELD_SHELL}>
        {icon && <span style={FIELD_PRE}><Icon name={icon} size={16} strokeWidth={1.8} /></span>}
        <input type={type || 'text'} value={value || ''} onChange={function(e){ onChange(e.target.value); }}
          placeholder={placeholder} style={FIELD_INPUT} />
      </div>
    </label>
  );
}
function SelectField({ label, value, onChange, options, placeholder, icon, required }) {
  return (
    <label style={{ display: "block" }}>
      <FieldLabel label={label} required={required} />
      <div style={FIELD_SHELL}>
        {icon && <span style={FIELD_PRE}><Icon name={icon} size={16} strokeWidth={1.8} /></span>}
        <select className="kh-select" value={value || ''} onChange={function(e){ onChange(e.target.value); }}
          style={{ ...FIELD_INPUT, cursor: "pointer", color: value ? K.text : K.textFaint }}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(function(o){
            if (typeof o === 'string') return <option key={o} value={o}>{o}</option>;
            return <option key={o.value} value={o.value}>{o.label}</option>;
          })}
        </select>
      </div>
    </label>
  );
}

export default ProposalsView;