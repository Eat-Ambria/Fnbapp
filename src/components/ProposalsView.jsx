// Ambria FnB — Proposals View (Sales)
// V70 Phase 2: list + create form + row actions + realtime
// Place in: src/components/ProposalsView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { hasPermission } from '../data/permissions.js';
import { AMBRIA_VENUES } from '../data/constants.js';
import { MENU_PACKAGES } from '../data/menuPackages.js';
import { detectPackageDiet } from '../utils/helpers.js';
import { supabase } from '../lib/supabase.js';
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

const STATUS_META = {
  draft: { label: "Draft", bg: "#F0F0F0", fg: "#666",     border: "#D0D0D0" },
  sent:  { label: "Sent",  bg: "#E5F0FA", fg: "#1858A5", border: "#B8D4F0" },
  won:   { label: "Won",   bg: "#E5F5EA", fg: "#2A7A48", border: "#B8E0C6" },
  lost:  { label: "Lost",  bg: "#FAE5E5", fg: "#A52828", border: "#F0B8B8" },
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
      var q = supabase.from('proposals').select('*').order('created_at', { ascending: false });
      if (!canViewAll) q = q.eq('rep_emp_id', repId);
      var res = await q;
      if (res.error) throw res.error;
      setProposals(res.data || []);
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

  function pickTemplate(pkg) {
    updateForm('tier_package_id', pkg.id);
  }

  async function saveProposal(newStatus) {
    if (!form.guest_name.trim()) { alert(T2('Guest name is required.')); return; }
    if (!form.venue) { alert(T2('Pick a venue.')); return; }
    if (saving) return;
    setSaving(true);
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
      setProposals(function(prev){
        var idx = prev.findIndex(function(p){ return p.id === saved.id; });
        if (idx >= 0) { var copy = prev.slice(); copy[idx] = saved; return copy; }
        return [saved].concat(prev);
      });
      cancelForm();
    } catch (e) {
      console.error('[Proposals] save failed:', e);
      alert(T2('Save failed:') + ' ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function duplicateProposal(p) {
    if (!window.confirm(T2('Duplicate this proposal as a new draft?'))) return;
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
      alert(T2('Duplicate failed:') + ' ' + (e.message || e));
    }
  }

  async function deleteProposal(p) {
    if (!window.confirm(T2('Delete proposal for') + ' "' + p.guest_name + '"?')) return;
    try {
      var res = await supabase.from('proposals').delete().eq('id', p.id);
      if (res.error) throw res.error;
      setProposals(function(prev){ return prev.filter(function(x){ return x.id !== p.id; }); });
    } catch (e) {
      alert(T2('Delete failed:') + ' ' + (e.message || e));
    }
  }

  async function updateStatus(p, newStatus) {
    try {
      var res = await supabase.from('proposals').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', p.id).select().single();
      if (res.error) throw res.error;
      setProposals(function(prev){ return prev.map(function(x){ return x.id===p.id ? res.data : x; }); });
    } catch (e) {
      alert(T2('Status change failed:') + ' ' + (e.message || e));
    }
  }

  // ── RENDER: menu builder takes over the full viewport ──
  if (mode === 'menu_builder' && menuBuilderProposal) {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: C.bg }}>
        <MenuBuilderView proposal={menuBuilderProposal} onClose={closeMenuBuilder} lang={lang} currentUser={currentUser} />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", letterSpacing: 0.3 }}>
            📝 {T2("Proposals")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {canViewAll
              ? T2("All reps' proposals — filter, edit, track status.")
              : T2("Your proposals — create new, edit drafts, track status.")}
          </div>
        </div>
        {mode === 'list' && canCreate && (
          <button onClick={openNew}
            style={{ padding: "10px 18px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 3px " + C.shadow }}>
            + {T2("New Proposal")}
          </button>
        )}
        {mode !== 'list' && (
          <button onClick={cancelForm}
            style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ← {T2("Back to list")}
          </button>
        )}
      </div>

      {/* ── FORM (new / edit) ── */}
      {mode !== 'list' && (
        <div style={{ background: C.surface, borderRadius: 14, border: "1px solid " + C.border, padding: "20px 22px", marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 14 }}>
            {mode === 'edit' ? T2("Edit proposal") : T2("New proposal")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Field label={T2("Guest name") + " *"} value={form.guest_name} onChange={function(v){ updateForm('guest_name', v); }} placeholder="Rohan & Priya" />
            <Field label={T2("Phone")} value={form.phone} onChange={function(v){ updateForm('phone', v); }} placeholder="+91 98…" />
            <Field label={T2("Email")} value={form.email} onChange={function(v){ updateForm('email', v); }} placeholder="guest@…" type="email" />
            <SelectField label={T2("Event type")} value={form.event_type} onChange={function(v){ updateForm('event_type', v); }} options={EVENT_TYPES} placeholder={T2("Select…")} />
            <SelectField label={T2("Venue") + " *"} value={form.venue} onChange={function(v){ updateForm('venue', v); }}
              options={SALES_VENUES.map(function(v){ return { value: v.code, label: v.code + ' — ' + v.name.replace('Ambria ','') }; })}
              placeholder={T2("Pick venue")} />
            <Field label={T2("Event date")} value={form.event_date} onChange={function(v){ updateForm('event_date', v); }} type="date" />
            <Field label={T2("Pax")} value={form.pax} onChange={function(v){ updateForm('pax', v.replace(/[^0-9]/g,'')); }} placeholder="250" />
            <SelectField label={T2("Source")} value={form.source} onChange={function(v){ updateForm('source', v); }} options={SOURCES} placeholder={T2("How did they find us?")} />
          </div>

          {/* V71 — Menu diet + template picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {T2("Menu template")} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {T2("optional starting point")}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{T2("Guest diet")}:</span>
                {DIET_OPTIONS.map(function(opt){
                  var isSel = form.menu_diet === opt.value;
                  return (
                    <button key={opt.value || 'both'} type="button" onClick={function(){ updateForm('menu_diet', opt.value); }}
                      style={{
                        padding: "4px 10px", borderRadius: 14, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: isSel ? (opt.value === 'nonveg' ? '#FAE5E5' : opt.value === 'veg' ? '#E5F5EA' : '#F5F0E8') : C.surface,
                        color:      isSel ? (opt.value === 'nonveg' ? '#A52828' : opt.value === 'veg' ? '#2A7A48' : C.text) : C.muted,
                        border: "1px solid " + (isSel ? (opt.value === 'nonveg' ? '#F0B8B8' : opt.value === 'veg' ? '#B8E0C6' : (C.gold || '#D4A843')) : C.border),
                      }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {allPackages.length === 0 && (
              <div style={{ padding: "16px 14px", background: C.amberBg || "#FFF4D9", border: "1px dashed " + (C.amberBorder || "#F2D98A"), borderRadius: 10, fontSize: 12, color: C.muted }}>
                {T2("No menu packages yet. Create some in Menu Packages first.")}
              </div>
            )}
            {allPackages.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                <button type="button" onClick={function(){ updateForm('tier_package_id', null); }}
                  style={{
                    padding: "14px 12px", borderRadius: 10,
                    background: !form.tier_package_id ? "#F5F0E8" : C.surface,
                    border: !form.tier_package_id ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
                    textAlign: "left", cursor: "pointer",
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>✨ {T2("Start from scratch")}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{T2("Build menu without a template")}</div>
                </button>
                {filteredPackages.map(function(pkg){
                  var isSel = form.tier_package_id === pkg.id;
                  var dietBg = pkg.diet === 'nonveg' ? '#FAE5E5' : pkg.diet === 'veg' ? '#E5F5EA' : '#F0F0F0';
                  var dietFg = pkg.diet === 'nonveg' ? '#A52828' : pkg.diet === 'veg' ? '#2A7A48' : '#666';
                  var dietLabel = pkg.diet === 'nonveg' ? '🍗 Non-Veg' : pkg.diet === 'veg' ? '🥬 Veg' : '❓';
                  return (
                    <button key={pkg.id || pkg.name} type="button" onClick={function(){ pickTemplate(pkg); }}
                      disabled={!pkg.id}
                      title={!pkg.id ? T2('Package id not loaded yet — refresh?') : ''}
                      style={{
                        padding: "14px 12px", borderRadius: 10,
                        background: isSel ? "#F5F0E8" : C.surface,
                        border: isSel ? ("1.5px solid " + (C.gold || "#D4A843")) : ("1px solid " + C.border),
                        textAlign: "left", cursor: pkg.id ? "pointer" : "not-allowed",
                        opacity: pkg.id ? 1 : 0.55,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{pkg.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: dietBg, color: dietFg, whiteSpace: "nowrap" }}>
                          {dietLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{pkg.dishCount} {T2("dishes")}</div>
                    </button>
                  );
                })}
                {filteredPackages.length === 0 && (
                  <div style={{ gridColumn: "1 / -1", padding: "14px", textAlign: "center", fontSize: 12, color: C.muted, background: C.bg, borderRadius: 10, border: "1px dashed " + C.border }}>
                    {T2("No packages match this diet. Rename your package to include 'Veg' or 'Non-Veg', or pick a different diet.")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{T2("Internal notes")}</div>
            <textarea value={form.notes} onChange={function(e){ updateForm('notes', e.target.value); }}
              placeholder={T2("Any client requests, dietary notes, deadlines…")}
              style={{ width: "100%", minHeight: 60, padding: "8px 10px", borderRadius: 8, border: "1px solid " + C.border, background: C.bg, fontSize: 13, color: C.text, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
          </div>

          {/* Action bar */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", borderTop: "1px solid " + C.border, paddingTop: 14 }}>
            <button onClick={cancelForm} disabled={saving}
              style={{ padding: "9px 16px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {T2("Cancel")}
            </button>
            <button onClick={function(){ saveProposal(); }} disabled={saving}
              style={{ padding: "9px 18px", borderRadius: 8, background: C.green, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? T2("Saving…") : (mode === 'edit' ? T2("Save changes") : T2("Save as draft"))}
            </button>
            {mode === 'edit' && (
              <button onClick={function(){ var p = proposals.find(function(x){ return x.id === editingId; }); if (p) openMenuBuilder(p); }}
                title={T2("Open the Menu Builder for this proposal")}
                style={{ padding: "9px 18px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 3px " + C.shadow }}>
                {T2("Build Menu")} →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
              placeholder={T2("Search guest name or phone…")}
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
            <select value={statusFilter} onChange={function(e){ setStatusFilter(e.target.value); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text, cursor: "pointer", fontWeight: 600 }}>
              <option value="all">{T2("All statuses")}</option>
              <option value="draft">{T2("Draft")}</option>
              <option value="sent">{T2("Sent")}</option>
              <option value="won">{T2("Won")}</option>
              <option value="lost">{T2("Lost")}</option>
            </select>
            {canViewAll && (
              <select value={repFilter} onChange={function(e){ setRepFilter(e.target.value); }}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text, cursor: "pointer", fontWeight: 600 }}>
                <option value="all">{T2("All reps")}</option>
                {uniqueReps.map(function(rid){ return <option key={rid} value={rid}>{repNameLookup[rid] || rid}</option>; })}
              </select>
            )}
            <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
              {filteredList.length} {filteredList.length === 1 ? T2("proposal") : T2("proposals")}
            </span>
          </div>

          {loading && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13 }}>{T2("Loading proposals…")}</div>
            </div>
          )}

          {!loading && filteredList.length === 0 && (
            <div style={{ background: C.surface, borderRadius: 14, border: "1px dashed " + C.border, padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>🗂️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
                {proposals.length === 0 ? T2("No proposals yet") : T2("No matches")}
              </div>
              <div style={{ fontSize: 13, color: C.muted, maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>
                {proposals.length === 0
                  ? T2("Click New Proposal to capture your first prospect.")
                  : T2("Try clearing filters or search.")}
              </div>
            </div>
          )}

          {!loading && filteredList.length > 0 && (
            <div style={{ background: C.surface, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: canViewAll ? "1.4fr 0.7fr 1fr 0.5fr 0.7fr 0.7fr 0.8fr 1fr" : "1.6fr 0.8fr 1.1fr 0.5fr 0.8fr 0.8fr 1fr", gap: 8, padding: "10px 14px", background: C.bg, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid " + C.border }}>
                <div>{T2("Guest / Event")}</div>
                <div>{T2("Venue")}</div>
                <div>{T2("Date")}</div>
                <div style={{ textAlign: "right" }}>{T2("Pax")}</div>
                <div>{T2("Diet")}</div>
                {canViewAll && <div>{T2("Rep")}</div>}
                <div>{T2("Status")}</div>
                <div style={{ textAlign: "right" }}>{T2("Actions")}</div>
              </div>

              {filteredList.map(function(p){
                var meta = STATUS_META[p.status] || STATUS_META.draft;
                var pDiet = p.menu_diet || null;
                var dietBg = pDiet === 'nonveg' ? '#FAE5E5' : pDiet === 'veg' ? '#E5F5EA' : '#F0F0F0';
                var dietFg = pDiet === 'nonveg' ? '#A52828' : pDiet === 'veg' ? '#2A7A48' : C.muted;
                var dietLabel = pDiet === 'nonveg' ? '🍗 Non-Veg' : pDiet === 'veg' ? '🥬 Veg' : '—';
                return (
                  <div key={p.id}
                    style={{ display: "grid", gridTemplateColumns: canViewAll ? "1.4fr 0.7fr 1fr 0.5fr 0.7fr 0.7fr 0.8fr 1fr" : "1.6fr 0.8fr 1.1fr 0.5fr 0.8fr 0.8fr 1fr", gap: 8, padding: "12px 14px", fontSize: 13, color: C.text, borderBottom: "1px solid " + C.border, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.guest_name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {p.event_type || '—'}{p.phone ? ' · ' + p.phone : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 12 }}>{p.venue || '—'}</div>
                    <div style={{ fontSize: 12 }}>{p.event_date || <span style={{color:C.muted}}>—</span>}</div>
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.pax != null ? p.pax : '—'}</div>
                    <div style={{ fontSize: 11 }}>
                      {pDiet
                        ? <span style={{ padding: "2px 6px", borderRadius: 4, background: dietBg, color: dietFg, fontWeight: 700, whiteSpace: "nowrap" }}>{dietLabel}</span>
                        : <span style={{ color: C.muted }}>—</span>}
                    </div>
                    {canViewAll && (
                      <div style={{ fontSize: 11, color: C.muted }}>{repNameLookup[p.rep_emp_id] || p.rep_emp_id}</div>
                    )}
                    <div>
                      <select value={p.status} onChange={function(e){ updateStatus(p, e.target.value); }}
                        style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid " + meta.border, background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button onClick={function(){ openEdit(p); }} title={T2("View / Edit")}
                        style={{ padding: "5px 10px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        ✎ {T2("Edit")}
                      </button>
                      <button onClick={function(){ openMenuBuilder(p); }} title={T2("Open Menu Builder")}
                        style={{ padding: "5px 10px", borderRadius: 6, background: "#8A70C8", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        🍽 {T2("Menu")}
                      </button>
                      <button onClick={function(){ duplicateProposal(p); }} title={T2("Duplicate")}
                        style={{ padding: "5px 8px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        ⧉
                      </button>

                      <button onClick={function(){ deleteProposal(p); }} title={T2("Delete")}
                        style={{ padding: "5px 8px", borderRadius: 6, background: C.surface, border: "1px solid " + (C.redBorder||'#F0B8B8'), color: C.red||'#A52828', fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: C.muted }}>
        {T2("Signed in as")} <b style={{ color: C.text }}>{(currentUser && currentUser.name) || repId}</b> · {T2("role")}: <b style={{ color: C.text }}>{(currentUser && currentUser.role) || '—'}</b>
      </div>
    </div>
  );
}

// ── Small form field components ──
function Field({ label, value, onChange, placeholder, type }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 3 }}>{label}</div>
      <input type={type || 'text'} value={value || ''} onChange={function(e){ onChange(e.target.value); }}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DDD", background: "#FFF", fontSize: 13, color: "#222", boxSizing: "border-box" }} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 3 }}>{label}</div>
      <select value={value || ''} onChange={function(e){ onChange(e.target.value); }}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #DDD", background: "#FFF", fontSize: 13, color: "#222", cursor: "pointer", boxSizing: "border-box" }}>
        <option value="">{placeholder || '—'}</option>
        {options.map(function(o){
          if (typeof o === 'string') return <option key={o} value={o}>{o}</option>;
          return <option key={o.value} value={o.value}>{o.label}</option>;
        })}
      </select>
    </label>
  );
}

export default ProposalsView;