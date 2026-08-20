// Ambria FnB — Sales Catalogue Admin (Sales Manager+ only)
// V70 Phase 8: enrich dishes_master with sales_items_meta (description, image, diet, dept)
// Place in: src/components/SalesCatalogueView.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { hasPermission } from '../data/permissions.js';
import { getAllDishes, getCatIdForDish, RECIPE_DB, resolveDishHindi } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, DIET_TAGS, DIET_TAG_MAP, DEFAULT_DIET, DEFAULT_DEPT } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';

const STORAGE_BUCKET = 'sales-hero-images';

export function SalesCatalogueView({ lang = "en", currentUser = null }) {
  var T2 = function(s){ return T(s, lang); };
  var canEdit = hasPermission(currentUser, 'sales_catalogue.edit');
  var repId   = (currentUser && (currentUser.staff_id || currentUser.staffListId || 'unknown')) || 'unknown';

  var [meta, setMeta]         = useState({});       // { dish_name: {diet_tag, sales_dept, sales_description, hero_image_url} }
  var [loading, setLoading]   = useState(true);
  var [saving, setSaving]     = useState({});       // { [dish_name]: 'saving' | 'saved' | 'error' }
  var [selected, setSelected] = useState({});       // { [dish_name]: true }
  var [uploading, setUploading] = useState({});     // { [dish_name]: true }
  // Filters
  var [searchQ, setSearchQ]         = useState('');
  var [deptFilter, setDeptFilter]   = useState('all');
  var [dietFilter, setDietFilter]   = useState('all');
  var [metaFilter, setMetaFilter]   = useState('all'); // 'all' | 'enriched' | 'bare'
  // Editing description locally (debounced save)
  var [descDrafts, setDescDrafts]   = useState({});  // { dish_name: 'text being typed' }
  var saveTimers = useRef({});

  // ── All dishes from dishes_master ──
  var allDishes = useMemo(function(){
    var raw = getAllDishes ? getAllDishes({ includeInactive: false }) : [];
    return raw.map(function(d){
      var catId  = getCatIdForDish(d.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      return {
        name:    d.dish_name,
        hindi:   resolveDishHindi ? resolveDishHindi(d.dish_name) : '',
        catId:   catId,
        catName: catObj ? catObj.name : 'Other',
        catIcon: catObj ? (catObj.icon || '🍽') : '🍽',
      };
    });
  }, []);

  // ── Load sales_items_meta ──
  async function loadMeta() {
    setLoading(true);
    try {
      var res = await supabase.from('sales_items_meta').select('*');
      if (res.error) throw res.error;
      var m = {};
      (res.data || []).forEach(function(r){
        m[r.dish_name] = {
          diet_tag:          r.diet_tag || null,
          sales_dept:        r.sales_dept || null,
          sales_description: r.sales_description || '',
          hero_image_url:    r.hero_image_url || '',
          updated_at:        r.updated_at || null,
        };
      });
      setMeta(m);
    } catch (e) {
      console.error('[SalesCatalogue] loadMeta failed:', e);
      setMeta({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(function(){ loadMeta(); }, []);

  // ── Realtime ──
  useEffect(function(){
    var chan = supabase.channel('sim_rt_' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_items_meta' }, function(payload){
        var row = payload.new || payload.old;
        if (!row) return;
        setMeta(function(prev){
          var next = { ...prev };
          if (payload.eventType === 'DELETE') delete next[row.dish_name];
          else next[row.dish_name] = {
            diet_tag:          payload.new.diet_tag || null,
            sales_dept:        payload.new.sales_dept || null,
            sales_description: payload.new.sales_description || '',
            hero_image_url:    payload.new.hero_image_url || '',
            updated_at:        payload.new.updated_at || null,
          };
          return next;
        });
      })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  }, []);

  // ── Filtered dishes ──
  var filteredDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return allDishes.filter(function(d){
      var m = meta[d.name];
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      if (deptFilter !== 'all') {
        var dept = (m && m.sales_dept) || DEFAULT_DEPT;
        if (dept !== deptFilter) return false;
      }
      if (dietFilter !== 'all') {
        var diet = (m && m.diet_tag) || DEFAULT_DIET;
        if (diet !== dietFilter) return false;
      }
      if (metaFilter === 'enriched' && !m) return false;
      if (metaFilter === 'bare' && m) return false;
      return true;
    });
  }, [allDishes, meta, searchQ, deptFilter, dietFilter, metaFilter]);

  // ── Stats ──
  var stats = useMemo(function(){
    var total = allDishes.length;
    var enriched = allDishes.filter(function(d){ return !!meta[d.name]; }).length;
    var withImage = allDishes.filter(function(d){ return !!(meta[d.name] && meta[d.name].hero_image_url); }).length;
    var withDesc = allDishes.filter(function(d){ return !!(meta[d.name] && meta[d.name].sales_description); }).length;
    return { total: total, enriched: enriched, withImage: withImage, withDesc: withDesc };
  }, [allDishes, meta]);

  var selectedList = useMemo(function(){ return Object.keys(selected).filter(function(k){ return selected[k]; }); }, [selected]);

  // ── Save one row (upsert) ──
  async function saveRow(dishName, patch) {
    var current = meta[dishName] || {};
    var payload = {
      dish_name: dishName,
      diet_tag:          patch.diet_tag != null          ? patch.diet_tag          : (current.diet_tag || DEFAULT_DIET),
      sales_dept:        patch.sales_dept != null        ? patch.sales_dept        : (current.sales_dept || DEFAULT_DEPT),
      sales_description: patch.sales_description != null ? patch.sales_description : (current.sales_description || null),
      hero_image_url:    patch.hero_image_url != null    ? patch.hero_image_url    : (current.hero_image_url || null),
      updated_by:        repId,
      updated_at:        new Date().toISOString(),
    };
    // Optimistic local
    setMeta(function(prev){ return { ...prev, [dishName]: { ...current, ...patch, updated_at: payload.updated_at } }; });
    setSaving(function(prev){ return { ...prev, [dishName]: 'saving' }; });
    try {
      var res = await supabase.from('sales_items_meta').upsert(payload, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      setSaving(function(prev){ var n = { ...prev }; n[dishName] = 'saved'; return n; });
      setTimeout(function(){
        setSaving(function(prev){ var n = { ...prev }; delete n[dishName]; return n; });
      }, 1200);
    } catch (e) {
      console.error('[SalesCatalogue] saveRow failed:', dishName, e);
      setSaving(function(prev){ return { ...prev, [dishName]: 'error' }; });
      alert(T2('Save failed:') + ' ' + (e.message || e));
    }
  }

  // Debounced save for text fields
  function updateDescDraft(dishName, val) {
    setDescDrafts(function(prev){ return { ...prev, [dishName]: val }; });
    if (saveTimers.current[dishName]) clearTimeout(saveTimers.current[dishName]);
    saveTimers.current[dishName] = setTimeout(function(){
      saveRow(dishName, { sales_description: val || null });
    }, 500);
  }

  // ── Image upload ──
  async function uploadHeroImage(dishName, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert(T2('Image must be under 5 MB.')); return; }
    setUploading(function(prev){ return { ...prev, [dishName]: true }; });
    try {
      var safeName = dishName.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase().slice(0, 60);
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = safeName + '_' + Date.now() + '.' + ext;
      var upRes = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upRes.error) throw upRes.error;
      var urlRes = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      var url = urlRes.data.publicUrl;
      await saveRow(dishName, { hero_image_url: url });
    } catch (e) {
      console.error('[SalesCatalogue] upload failed:', dishName, e);
      alert(T2('Image upload failed:') + ' ' + (e.message || e));
    } finally {
      setUploading(function(prev){ var n = { ...prev }; delete n[dishName]; return n; });
    }
  }

  async function removeHeroImage(dishName) {
    if (!window.confirm(T2('Remove hero image for') + ' "' + dishName + '"?')) return;
    await saveRow(dishName, { hero_image_url: null });
  }

  // ── Bulk actions ──
  async function bulkSetDiet(newDiet) {
    if (selectedList.length === 0) return;
    if (!window.confirm(T2('Set diet to') + ' "' + newDiet + '" ' + T2('for') + ' ' + selectedList.length + ' ' + T2('dishes') + '?')) return;
    var rows = selectedList.map(function(name){
      var cur = meta[name] || {};
      return {
        dish_name: name,
        diet_tag: newDiet,
        sales_dept: cur.sales_dept || DEFAULT_DEPT,
        sales_description: cur.sales_description || null,
        hero_image_url: cur.hero_image_url || null,
        updated_by: repId,
        updated_at: new Date().toISOString(),
      };
    });
    try {
      var res = await supabase.from('sales_items_meta').upsert(rows, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      // Optimistic local update
      setMeta(function(prev){
        var next = { ...prev };
        selectedList.forEach(function(name){ next[name] = { ...(next[name]||{}), diet_tag: newDiet }; });
        return next;
      });
      setSelected({});
    } catch (e) {
      alert(T2('Bulk save failed:') + ' ' + (e.message || e));
    }
  }

  async function bulkSetDept(newDept) {
    if (selectedList.length === 0) return;
    if (!window.confirm(T2('Set dept to') + ' "' + newDept + '" ' + T2('for') + ' ' + selectedList.length + ' ' + T2('dishes') + '?')) return;
    var rows = selectedList.map(function(name){
      var cur = meta[name] || {};
      return {
        dish_name: name,
        diet_tag: cur.diet_tag || DEFAULT_DIET,
        sales_dept: newDept,
        sales_description: cur.sales_description || null,
        hero_image_url: cur.hero_image_url || null,
        updated_by: repId,
        updated_at: new Date().toISOString(),
      };
    });
    try {
      var res = await supabase.from('sales_items_meta').upsert(rows, { onConflict: 'dish_name' });
      if (res.error) throw res.error;
      setMeta(function(prev){
        var next = { ...prev };
        selectedList.forEach(function(name){ next[name] = { ...(next[name]||{}), sales_dept: newDept }; });
        return next;
      });
      setSelected({});
    } catch (e) {
      alert(T2('Bulk save failed:') + ' ' + (e.message || e));
    }
  }

  // ── RENDER ──
  return (
    <div style={{ padding: "24px 20px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", letterSpacing: 0.3 }}>
          🏷️ {T2("Sales Catalogue")}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {T2("Enrich dishes with sales copy, hero images, diet tags, and department routing. Changes reflect immediately in the Menu Builder.")}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <StatPill icon="🍽" label={stats.total + " " + T2("total dishes")} />
        <StatPill icon="✨" label={stats.enriched + " " + T2("enriched")} accent={stats.enriched > 0 ? "#2A7A48" : C.muted} />
        <StatPill icon="🖼" label={stats.withImage + " " + T2("with image")} accent={stats.withImage > 0 ? "#8A70C8" : C.muted} />
        <StatPill icon="📝" label={stats.withDesc + " " + T2("with description")} accent={stats.withDesc > 0 ? (C.gold || "#D4A843") : C.muted} />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
          placeholder={T2("Search dish (English or Hindi)…")}
          style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />
        <select value={deptFilter} onChange={function(e){ setDeptFilter(e.target.value); }}
          style={filterSelectStyle()}>
          <option value="all">{T2("All departments")}</option>
          {SALES_DEPTS.map(function(d){ return <option key={d.id} value={d.id}>{d.icon} {d.name}</option>; })}
        </select>
        <select value={dietFilter} onChange={function(e){ setDietFilter(e.target.value); }}
          style={filterSelectStyle()}>
          <option value="all">{T2("All diets")}</option>
          {DIET_TAGS.map(function(dt){ return <option key={dt.id} value={dt.id}>{dt.icon} {dt.label}</option>; })}
        </select>
        <select value={metaFilter} onChange={function(e){ setMetaFilter(e.target.value); }}
          style={filterSelectStyle()}>
          <option value="all">{T2("All (enriched + bare)")}</option>
          <option value="enriched">{T2("Enriched only")}</option>
          <option value="bare">{T2("Bare only")}</option>
        </select>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
          {filteredDishes.length} {T2("of")} {allDishes.length}
        </span>
      </div>

      {/* Bulk action bar (appears when items selected) */}
      {selectedList.length > 0 && canEdit && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: (C.gold || "#D4A843") + "22", border: "1px solid " + (C.gold || "#D4A843") }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selectedList.length} {T2("selected")}</span>
          <div style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>{T2("Set diet")}:</span>
            {DIET_TAGS.map(function(dt){
              return <button key={dt.id} onClick={function(){ bulkSetDiet(dt.id); }}
                style={{ padding: "4px 10px", borderRadius: 12, background: C.surface, border: "1px solid " + dt.color, color: dt.color, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {dt.icon} {dt.label}
              </button>;
            })}
          </div>
          <div style={{ marginLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>{T2("Set dept")}:</span>
            <select onChange={function(e){ if (e.target.value) bulkSetDept(e.target.value); e.target.value=''; }}
              value=""
              style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 12, color: C.text, cursor: "pointer" }}>
              <option value="">{T2("Pick…")}</option>
              {SALES_DEPTS.map(function(d){ return <option key={d.id} value={d.id}>{d.icon} {d.name}</option>; })}
            </select>
          </div>
          <button onClick={function(){ setSelected({}); }}
            style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            ✕ {T2("Clear")}
          </button>
        </div>
      )}

      {/* Table */}
      {loading && (
        <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ fontSize: 13 }}>{T2("Loading catalogue…")}</div>
        </div>
      )}

      {!loading && filteredDishes.length === 0 && (
        <div style={{ padding: "60px 24px", textAlign: "center", background: C.surface, borderRadius: 12, border: "1px dashed " + C.border, color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{T2("No matches")}</div>
          <div style={{ fontSize: 12 }}>{T2("Try clearing filters or search.")}</div>
        </div>
      )}

      {!loading && filteredDishes.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "36px 60px 1.4fr 90px 100px 110px 1.5fr 40px", gap: 8, padding: "10px 14px", background: C.bg, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid " + C.border, alignItems: "center" }}>
            <input type="checkbox"
              checked={filteredDishes.every(function(d){ return selected[d.name]; })}
              onChange={function(e){
                if (e.target.checked) { var s = {}; filteredDishes.forEach(function(d){ s[d.name] = true; }); setSelected(s); }
                else                  setSelected({});
              }}
              style={{ cursor: "pointer", width: 16, height: 16 }} />
            <div>{T2("Image")}</div>
            <div>{T2("Dish")}</div>
            <div>{T2("Diet")}</div>
            <div>{T2("Dept")}</div>
            <div>{T2("Category")}</div>
            <div>{T2("Sales description")}</div>
            <div style={{ textAlign: "center" }}>{T2("Save")}</div>
          </div>

          {filteredDishes.map(function(d){
            var m = meta[d.name] || {};
            var isSel = !!selected[d.name];
            var isSaving = saving[d.name];
            var isUploading = uploading[d.name];
            var descVal = descDrafts[d.name] != null ? descDrafts[d.name] : (m.sales_description || '');
            var deptMeta = SALES_DEPT_MAP[m.sales_dept || DEFAULT_DEPT];
            var dietMeta = DIET_TAG_MAP[m.diet_tag || DEFAULT_DIET];

            return (
              <div key={d.name}
                style={{ display: "grid", gridTemplateColumns: "36px 60px 1.4fr 90px 100px 110px 1.5fr 40px", gap: 8, padding: "10px 14px", fontSize: 13, color: C.text, borderBottom: "1px solid " + C.border, alignItems: "center", background: isSel ? "#FFFBF0" : "transparent" }}>
                {/* Checkbox */}
                <input type="checkbox" checked={isSel}
                  onChange={function(e){
                    setSelected(function(prev){ var n = { ...prev }; if (e.target.checked) n[d.name] = true; else delete n[d.name]; return n; });
                  }}
                  disabled={!canEdit}
                  style={{ cursor: canEdit ? "pointer" : "not-allowed", width: 16, height: 16 }} />

                {/* Image */}
                <div style={{ position: "relative" }}>
                  {m.hero_image_url ? (
                    <div style={{ position: "relative", width: 48, height: 48 }}>
                      <img src={m.hero_image_url} alt=""
                        style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid " + C.border, display: "block" }} />
                      {canEdit && (
                        <button onClick={function(){ removeHeroImage(d.name); }}
                          title={T2("Remove image")}
                          style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#A52828", color: "#fff", border: "1.5px solid #fff", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: 0, lineHeight: "14px" }}>×</button>
                      )}
                    </div>
                  ) : (
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 6, background: C.bg, border: "1.5px dashed " + C.border, cursor: canEdit ? "pointer" : "not-allowed", fontSize: 18, color: C.muted }}>
                      {isUploading ? "⏳" : "＋"}
                      {canEdit && !isUploading && (
                        <input type="file" accept="image/*"
                          onChange={function(e){ if (e.target.files && e.target.files[0]) uploadHeroImage(d.name, e.target.files[0]); }}
                          style={{ display: "none" }} />
                      )}
                    </label>
                  )}
                </div>

                {/* Dish name + Hindi */}
                <div>
                  <div style={{ fontWeight: 700, color: C.text }}>{d.name}</div>
                  {d.hindi && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", marginTop: 2 }}>{d.hindi}</div>}
                </div>

                {/* Diet select */}
                <select value={m.diet_tag || ''}
                  onChange={function(e){ saveRow(d.name, { diet_tag: e.target.value || null }); }}
                  disabled={!canEdit}
                  style={{
                    padding: "5px 8px", borderRadius: 5,
                    border: "1px solid " + ((dietMeta && dietMeta.color) || C.border),
                    background: C.surface,
                    color: (dietMeta && dietMeta.color) || C.text,
                    fontSize: 11, fontWeight: 700, cursor: canEdit ? "pointer" : "not-allowed",
                  }}>
                  <option value="">{T2("—")}</option>
                  {DIET_TAGS.map(function(dt){ return <option key={dt.id} value={dt.id}>{dt.icon} {dt.label}</option>; })}
                </select>

                {/* Dept select */}
                <select value={m.sales_dept || ''}
                  onChange={function(e){ saveRow(d.name, { sales_dept: e.target.value || null }); }}
                  disabled={!canEdit}
                  style={{
                    padding: "5px 8px", borderRadius: 5,
                    border: "1px solid " + ((deptMeta && deptMeta.color) || C.border),
                    background: C.surface,
                    color: (deptMeta && deptMeta.color) || C.text,
                    fontSize: 11, fontWeight: 700, cursor: canEdit ? "pointer" : "not-allowed",
                  }}>
                  <option value="">{T2("—")}</option>
                  {SALES_DEPTS.map(function(sd){ return <option key={sd.id} value={sd.id}>{sd.icon} {sd.name}</option>; })}
                </select>

                {/* Category (readonly) */}
                <div style={{ fontSize: 11, color: C.muted }}>
                  {d.catIcon} {d.catName}
                </div>

                {/* Description */}
                <textarea value={descVal}
                  onChange={function(e){ updateDescDraft(d.name, e.target.value); }}
                  disabled={!canEdit}
                  placeholder={T2("A short line for the client-facing menu…")}
                  style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid " + C.border, background: C.surface, fontSize: 12, color: C.text, fontFamily: "inherit", resize: "vertical", minHeight: 30, maxHeight: 80, boxSizing: "border-box", width: "100%" }} />

                {/* Save indicator */}
                <div style={{ textAlign: "center", fontSize: 12 }}>
                  {isSaving === 'saving' && <span style={{ color: C.gold || "#D4A843" }} title={T2("Saving")}>⋯</span>}
                  {isSaving === 'saved'  && <span style={{ color: "#2A7A48" }} title={T2("Saved")}>✓</span>}
                  {isSaving === 'error'  && <span style={{ color: "#A52828" }} title={T2("Save failed")}>!</span>}
                  {!isSaving && m.updated_at && <span style={{ color: C.muted, fontSize: 10 }} title={T2("Enriched")}>●</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Read-only footer for non-editors */}
      {!canEdit && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: C.bg, border: "1px solid " + C.border, fontSize: 12, color: C.muted, textAlign: "center", fontStyle: "italic" }}>
          {T2("You have read-only access. Ask a Sales Manager or Admin to edit catalogue meta.")}
        </div>
      )}
    </div>
  );
}

// ── Small UI bits ──
function StatPill({ icon, label, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: C.surface, border: "1px solid " + C.border }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent || C.text }}>{label}</span>
    </div>
  );
}

function filterSelectStyle() {
  return { padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text, cursor: "pointer", fontWeight: 600 };
}

export default SalesCatalogueView;