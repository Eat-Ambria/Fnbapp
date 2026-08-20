// Ambria FnB — Menu Builder View (Sales)
// V70 Phase 3: Kitchen dept Items tab fully functional; other 6 depts placeholders.
// Place in: src/components/MenuBuilderView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_META } from '../data/menuPackages.js';
import { getAllDishes, getCatIdForDish, RECIPE_DB, resolveDishHindi } from '../data/recipeData.js';
import { SALES_DEPTS, SALES_DEPT_MAP, ITEM_HAVING_DEPTS, DIET_TAGS, DEFAULT_DIET, DEFAULT_DEPT } from '../data/salesConfig.js';
import { supabase } from '../lib/supabase.js';

export function MenuBuilderView({ proposal, onClose, lang = "en", currentUser = null }) {
  var T2 = function(s) { return T(s, lang); };

  var [activeDept, setActiveDept]   = useState('kit');
  var [activeSubTab, setActiveSubTab] = useState('items'); // 'items' | 'configs' | 'total'
  var [dishItems, setDishItems]     = useState([]);        // proposal_items rows
  var [salesMeta, setSalesMeta]     = useState({});        // { [dish_name]: {diet_tag, sales_dept, sales_description, hero_image_url} }
  var [loading, setLoading]         = useState(true);
  var [seeding, setSeeding]         = useState(false);
  var [searchQ, setSearchQ]         = useState('');
  var [dietFilter, setDietFilter]   = useState('all');
  var [showAddons, setShowAddons]   = useState(false);

  // ── Template dishes: resolved from proposal.tier_package_id ──
  var templateInfo = useMemo(function(){
    if (!proposal || !proposal.tier_package_id) return { name: null, dishes: [], tier: null };
    var name = Object.keys(MENU_PACKAGE_META).find(function(n){ return MENU_PACKAGE_META[n].id === proposal.tier_package_id; });
    if (!name) return { name: null, dishes: [], tier: null };
    return { name: name, dishes: MENU_PACKAGES[name] || [], tier: MENU_PACKAGE_META[name].tier };
  }, [proposal]);

  var templateSet = useMemo(function(){
    var s = {}; templateInfo.dishes.forEach(function(d){ s[d] = true; }); return s;
  }, [templateInfo.dishes]);

  // ── All dishes (from dishes_master via getAllDishes) ──
  var allDishes = useMemo(function(){
    var raw = getAllDishes ? getAllDishes({ includeInactive: false }) : [];
    // Enrich each dish with resolved category + hindi
    return raw.map(function(d){
      var catId = getCatIdForDish(d.dish_name) || 'other';
      var catObj = (RECIPE_DB.cats || []).find(function(c){ return c.id === catId; });
      return {
        name:    d.dish_name,
        hindi:   resolveDishHindi ? resolveDishHindi(d.dish_name) : '',
        catId:   catId,
        catName: catObj ? catObj.name : 'Other',
        catIcon: catObj ? (catObj.icon || '🍽') : '🍽',
        image:   d.image_url || '',
        notes:   d.notes || '',
      };
    });
  }, []);

  // ── Load sales_items_meta ──
  async function loadSalesMeta() {
    try {
      var res = await supabase.from('sales_items_meta').select('*');
      if (res.error) throw res.error;
      var m = {};
      (res.data || []).forEach(function(r){
        m[r.dish_name] = {
          diet_tag:          r.diet_tag || DEFAULT_DIET,
          sales_dept:        r.sales_dept || DEFAULT_DEPT,
          sales_description: r.sales_description || '',
          hero_image_url:    r.hero_image_url || '',
        };
      });
      setSalesMeta(m);
    } catch (e) {
      console.error('[MenuBuilder] loadSalesMeta failed:', e);
      setSalesMeta({});
    }
  }

  // ── Load proposal_items ──
  async function loadItems() {
    if (!proposal || !proposal.id) return;
    try {
      var res = await supabase.from('proposal_items').select('*').eq('proposal_id', proposal.id);
      if (res.error) throw res.error;
      return res.data || [];
    } catch (e) {
      console.error('[MenuBuilder] loadItems failed:', e);
      return [];
    }
  }

  // ── First-open template seeder ──
  async function seedTemplateIfNeeded() {
    if (!proposal || !proposal.id) return [];
    // Refetch to make sure we have the current flag (proposals state can be stale)
    var propRes = await supabase.from('proposals').select('menu_initialized').eq('id', proposal.id).single();
    if (propRes.error) throw propRes.error;
    if (propRes.data.menu_initialized) return await loadItems(); // already seeded, just load

    // Load existing items to be safe
    var existing = await loadItems();
    if (existing.length > 0) {
      // Items already present — mark initialized and bail
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return existing;
    }

    // No items yet + not initialized + template has dishes → seed
    if (templateInfo.dishes.length === 0) {
      // Nothing to seed (no template picked), still mark initialized so we don't retry
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return [];
    }

    setSeeding(true);
    try {
      var rows = templateInfo.dishes.map(function(d, i){
        return { proposal_id: proposal.id, dish_name: d, is_addon: false, ordering: i };
      });
      var ins = await supabase.from('proposal_items').insert(rows).select();
      if (ins.error) throw ins.error;
      await supabase.from('proposals').update({ menu_initialized: true }).eq('id', proposal.id);
      return ins.data || [];
    } finally {
      setSeeding(false);
    }
  }

  useEffect(function(){
    var cancelled = false;
    async function boot(){
      setLoading(true);
      try {
        await loadSalesMeta();
        var items = await seedTemplateIfNeeded();
        if (!cancelled) setDishItems(items || []);
      } catch (e) {
        console.error('[MenuBuilder] boot failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return function(){ cancelled = true; };
  // eslint-disable-next-line
  }, [proposal && proposal.id]);

  // ── Realtime for proposal_items on this proposal ──
  useEffect(function(){
    if (!proposal || !proposal.id) return;
    var chan = supabase.channel('pitems_rt_' + proposal.id)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'proposal_items', filter: 'proposal_id=eq.' + proposal.id },
        function(payload){
          if (payload.eventType === 'INSERT' && payload.new) {
            setDishItems(function(prev){ if (prev.some(function(x){return x.dish_name===payload.new.dish_name;})) return prev; return prev.concat([payload.new]); });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setDishItems(function(prev){ return prev.filter(function(x){ return x.dish_name !== payload.old.dish_name; }); });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setDishItems(function(prev){ return prev.map(function(x){ return x.dish_name === payload.new.dish_name ? payload.new : x; }); });
          }
        })
      .subscribe();
    return function(){ supabase.removeChannel(chan); };
  }, [proposal && proposal.id]);

  // ── Selection lookups ──
  var selectedSet = useMemo(function(){
    var s = {}; dishItems.forEach(function(x){ s[x.dish_name] = true; }); return s;
  }, [dishItems]);

  // ── Toggle dish: insert or delete ──
  async function toggleDish(dishName) {
    var isSelected = !!selectedSet[dishName];
    var inTemplate = !!templateSet[dishName];
    if (isSelected) {
      // Optimistic remove
      setDishItems(function(prev){ return prev.filter(function(x){ return x.dish_name !== dishName; }); });
      try {
        var res = await supabase.from('proposal_items').delete().eq('proposal_id', proposal.id).eq('dish_name', dishName);
        if (res.error) throw res.error;
      } catch (e) {
        console.error('[MenuBuilder] toggle-off failed:', e);
        // Rollback
        await loadItems().then(setDishItems);
        alert(T2('Failed to remove dish:') + ' ' + (e.message || e));
      }
    } else {
      var row = { proposal_id: proposal.id, dish_name: dishName, is_addon: !inTemplate, ordering: dishItems.length };
      // Optimistic add
      setDishItems(function(prev){ return prev.concat([row]); });
      try {
        var res2 = await supabase.from('proposal_items').insert(row).select().single();
        if (res2.error) throw res2.error;
        setDishItems(function(prev){ return prev.map(function(x){ return x.dish_name === dishName ? res2.data : x; }); });
      } catch (e) {
        console.error('[MenuBuilder] toggle-on failed:', e);
        await loadItems().then(setDishItems);
        alert(T2('Failed to add dish:') + ' ' + (e.message || e));
      }
    }
  }

  // ── Selected counts per dept ──
  var deptCounts = useMemo(function(){
    var counts = {};
    SALES_DEPTS.forEach(function(d){ counts[d.id] = { sel: 0, total: 0 }; });
    allDishes.forEach(function(d){
      var meta = salesMeta[d.name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      if (!counts[dept]) counts[dept] = { sel: 0, total: 0 };
      counts[dept].total += 1;
      if (selectedSet[d.name]) counts[dept].sel += 1;
    });
    return counts;
  }, [allDishes, salesMeta, selectedSet]);

  // ── Dishes for active dept (dishes without meta fall to DEFAULT_DEPT = 'kit') ──
  var deptDishes = useMemo(function(){
    return allDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [allDishes, salesMeta, activeDept]);

  // ── Template dishes scoped to active dept ──
  var templateDishesInDept = useMemo(function(){
    return templateInfo.dishes.filter(function(name){
      var meta = salesMeta[name];
      var dept = (meta && meta.sales_dept) || DEFAULT_DEPT;
      return dept === activeDept;
    });
  }, [templateInfo.dishes, salesMeta, activeDept]);

  // ── Diet-annotated + filtered + searched ──
  var visibleDishes = useMemo(function(){
    var q = (searchQ || '').trim().toLowerCase();
    return deptDishes.filter(function(d){
      var meta = salesMeta[d.name];
      var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
      if (dietFilter !== 'all' && diet !== dietFilter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !(d.hindi || '').toLowerCase().includes(q)) return false;
      // Hide dishes that aren't in template AND aren't selected, unless showAddons is true
      var inT = !!templateSet[d.name];
      var isSel = !!selectedSet[d.name];
      if (!inT && !isSel && !showAddons) return false;
      return true;
    });
  }, [deptDishes, salesMeta, dietFilter, searchQ, templateSet, selectedSet, showAddons]);

  // ── Group visible dishes by category ──
  var groupedByCat = useMemo(function(){
    var groups = {};
    visibleDishes.forEach(function(d){
      if (!groups[d.catId]) groups[d.catId] = { name: d.catName, icon: d.catIcon, dishes: [] };
      groups[d.catId].dishes.push(d);
    });
    // Sort by RECIPE_DB.cats order
    var order = (RECIPE_DB.cats || []).map(function(c){ return c.id; });
    var sorted = order.filter(function(id){ return !!groups[id]; }).map(function(id){ return { id: id, ...groups[id] }; });
    // Append any groups not in the cats order (e.g., 'other')
    Object.keys(groups).forEach(function(id){ if (order.indexOf(id) < 0) sorted.push({ id: id, ...groups[id] }); });
    return sorted;
  }, [visibleDishes]);

  // ── RENDER ──
  var tierMeta = templateInfo.tier
    ? { color: templateInfo.tier === 'magnum' ? '#8A70C8' : '#D4A843', bg: templateInfo.tier === 'magnum' ? '#EADFF5' : '#F5EBD7' }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      {/* ── Top bar ── */}
      <div style={{ flexShrink: 0, background: C.surface, borderBottom: "1px solid " + C.border, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", boxShadow: "0 1px 3px " + C.shadow }}>
        <button onClick={onClose}
          style={{ padding: "8px 14px", borderRadius: 8, background: C.surface, border: "1px solid " + C.border, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← {T2("Back to proposals")}
        </button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)" }}>
            🍽 {T2("Menu for")} <span style={{ color: C.gold || "#D4A843" }}>{proposal.guest_name}</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {(proposal.event_type || T2("Event")) + " · " + (proposal.venue || '—') + (proposal.event_date ? ' · ' + proposal.event_date : '') + (proposal.pax ? ' · ' + proposal.pax + ' pax' : '')}
            {templateInfo.name && (
              <>
                {' · '}
                <span style={{ padding: "1px 6px", borderRadius: 3, background: (tierMeta && tierMeta.color) || '#999', color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{templateInfo.tier}</span>
                {' ' + templateInfo.name}
              </>
            )}
          </div>
        </div>
        <button disabled title={T2("Preview ships in Phase 6")}
          style={{ padding: "8px 16px", borderRadius: 8, background: "#8A70C8", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "not-allowed", opacity: 0.55 }}>
          👁 {T2("Preview")}
        </button>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Dept sidebar ── */}
        <div style={{ flexShrink: 0, width: 200, background: C.surface, borderRight: "1px solid " + C.border, padding: "12px 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "6px 10px", marginBottom: 4 }}>
            {T2("Departments")}
          </div>
          {SALES_DEPTS.map(function(d){
            var isActive = activeDept === d.id;
            var counts = deptCounts[d.id] || { sel: 0, total: 0 };
            var isFunctional = ITEM_HAVING_DEPTS.indexOf(d.id) >= 0; // Phase 4: kit/bev/bak/frt
            return (
              <button key={d.id} onClick={function(){ setActiveDept(d.id); setActiveSubTab('items'); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "10px 12px", marginBottom: 3, borderRadius: 8,
                  background: isActive ? d.bg : "transparent",
                  border: "1px solid " + (isActive ? d.color : "transparent"),
                  color: C.text, fontSize: 13, fontWeight: isActive ? 700 : 500,
                  cursor: "pointer", textAlign: "left",
                  opacity: isFunctional ? 1 : 0.75,
                }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }}></span>
                <span style={{ flex: 1 }}>{d.icon} {d.name}</span>
                {isFunctional && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: counts.sel > 0 ? d.color : C.muted, background: isActive ? "#fff" : C.bg, padding: "2px 6px", borderRadius: 10 }}>
                    {counts.sel}
                  </span>
                )}
                {!isFunctional && (
                  <span style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>{T2("soon")}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Main area ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{seeding ? '🌱' : '⏳'}</div>
              <div style={{ fontSize: 13 }}>{seeding ? T2("Seeding template dishes…") : T2("Loading menu builder…")}</div>
            </div>
          )}

          {!loading && ITEM_HAVING_DEPTS.indexOf(activeDept) >= 0 && (
            <ItemsTab
              T2={T2}
              activeDept={activeDept}
              searchQ={searchQ} setSearchQ={setSearchQ}
              dietFilter={dietFilter} setDietFilter={setDietFilter}
              showAddons={showAddons} setShowAddons={setShowAddons}
              deptDishes={deptDishes}
              groupedByCat={groupedByCat}
              templateSet={templateSet}
              selectedSet={selectedSet}
              salesMeta={salesMeta}
              onToggle={toggleDish}
              templateInfo={templateInfo}
              templateDishesInDept={templateDishesInDept}
              deptCounts={deptCounts[activeDept]}
            />
          )}

          {!loading && ITEM_HAVING_DEPTS.indexOf(activeDept) < 0 && (
            <ComingSoonPlaceholder T2={T2} dept={SALES_DEPT_MAP[activeDept]} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ITEMS TAB — works for any item-having dept (kit/bev/bak/frt)
// ═══════════════════════════════════════════════════════════════
function ItemsTab({ T2, activeDept, searchQ, setSearchQ, dietFilter, setDietFilter, showAddons, setShowAddons, deptDishes, groupedByCat, templateSet, selectedSet, salesMeta, onToggle, templateInfo, templateDishesInDept, deptCounts }) {
  var totalSel = deptCounts ? deptCounts.sel : 0;
  var templateCountInDept = templateDishesInDept ? templateDishesInDept.length : 0;
  var deptTotal = deptCounts ? deptCounts.total : 0;
  var addonsAvailable = Math.max(0, deptTotal - templateCountInDept);

  return (
    <div>
      {/* Sub-tab strip (Phase 3: only Items functional) */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: "1px solid " + C.border }}>
        <SubTab label={"🍛 " + T2("Items") + (totalSel > 0 ? " · " + totalSel : '')} active={true} />
        <SubTab label={"⚙ " + T2("Configs")} disabled title={T2("Ships in Phase 5")} />
        <SubTab label={"📊 " + T2("Total")} disabled title={T2("Ships in Phase 5")} />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input value={searchQ} onChange={function(e){ setSearchQ(e.target.value); }}
          placeholder={T2("Search dish…")}
          style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8, border: "1px solid " + C.border, background: C.surface, fontSize: 13, color: C.text }} />

        {/* Diet chips */}
        <div style={{ display: "flex", gap: 4 }}>
          <DietChip active={dietFilter === 'all'} onClick={function(){ setDietFilter('all'); }} color={C.muted} label={T2("All")} />
          {DIET_TAGS.map(function(dt){
            return <DietChip key={dt.id} active={dietFilter === dt.id} onClick={function(){ setDietFilter(dt.id); }} color={dt.color} label={dt.icon + ' ' + dt.label} />;
          })}
        </div>

        {/* Show add-ons toggle */}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, background: showAddons ? "#EADFF5" : C.surface, border: "1px solid " + (showAddons ? "#8A70C8" : C.border), fontSize: 12, fontWeight: 600, color: showAddons ? "#5A3EA0" : C.text, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={showAddons} onChange={function(e){ setShowAddons(e.target.checked); }}
            style={{ margin: 0, cursor: "pointer" }} />
          {T2("Show add-ons")}
        </label>
      </div>

      {/* Template summary bar (per-dept scoped counts) */}
      {templateInfo.name && (
        <div style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: C.bg, border: "1px solid " + C.border, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>📋 <b style={{ color: C.text }}>{templateInfo.name}</b> · {templateCountInDept} {T2("template dishes in this dept")} <span style={{ opacity: 0.7 }}>({templateInfo.dishes.length} {T2("total")})</span></span>
          <span style={{ marginLeft: "auto" }}>
            ✓ {totalSel} {T2("selected")} · ✨ {addonsAvailable} {T2("add-ons available")}
          </span>
        </div>
      )}

      {/* Category groups */}
      {groupedByCat.length === 0 && (
        <div style={{ padding: "60px 20px", textAlign: "center", color: C.muted, background: C.surface, borderRadius: 12, border: "1px dashed " + C.border }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{T2("No dishes match")}</div>
          <div style={{ fontSize: 12 }}>
            {!showAddons && templateInfo.name
              ? T2("Enable Show add-ons to browse the full catalogue.")
              : T2("Try clearing filters or search.")}
          </div>
        </div>
      )}

      {groupedByCat.map(function(grp){
        return (
          <div key={grp.id} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, padding: "0 2px" }}>
              {grp.icon} {grp.name} <span style={{ color: C.muted, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· {grp.dishes.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {grp.dishes.map(function(d){
                var inT = !!templateSet[d.name];
                var isSel = !!selectedSet[d.name];
                var meta = salesMeta[d.name];
                var diet = (meta && meta.diet_tag) || DEFAULT_DIET;
                var dietMeta = DIET_TAGS.find(function(x){ return x.id === diet; });
                var desc = (meta && meta.sales_description) || '';
                var img = (meta && meta.hero_image_url) || d.image || '';

                var borderStyle;
                var bg;
                if (inT && isSel)      { borderStyle = "1.5px solid #2A7A48"; bg = "#F0F9F3"; }
                else if (inT && !isSel){ borderStyle = "1px solid " + C.border; bg = C.surface; }
                else if (!inT && isSel){ borderStyle = "1.5px dashed #8A70C8"; bg = "#F8F4FC"; }
                else                    { borderStyle = "1px dashed " + C.border; bg = C.surface; }

                return (
                  <button key={d.name} onClick={function(){ onToggle(d.name); }}
                    style={{
                      position: "relative", padding: 0, borderRadius: 10,
                      background: bg, border: borderStyle,
                      cursor: "pointer", textAlign: "left", overflow: "hidden",
                      transition: "transform 0.08s ease",
                    }}>
                    {/* ADD-ON badge */}
                    {!inT && isSel && (
                      <span style={{ position: "absolute", top: 6, left: 6, zIndex: 2, padding: "1px 6px", borderRadius: 4, background: "#8A70C8", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
                        ADD-ON
                      </span>
                    )}
                    {/* Checkbox */}
                    <span style={{
                      position: "absolute", top: 6, right: 6, zIndex: 2,
                      width: 22, height: 22, borderRadius: 5,
                      background: isSel ? (inT ? "#2A7A48" : "#8A70C8") : "rgba(255,255,255,0.9)",
                      border: "1.5px solid " + (isSel ? (inT ? "#2A7A48" : "#8A70C8") : "#BBB"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                    }}>
                      {isSel ? "✓" : ""}
                    </span>

                    {/* Image area */}
                    <div style={{ height: 90, background: img ? "transparent" : "#EEE", backgroundImage: img ? "url(" + img + ")" : "none", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!img && <span style={{ fontSize: 32, opacity: 0.4 }}>{d.catIcon}</span>}
                    </div>

                    {/* Text area */}
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        {dietMeta && (
                          <span style={{ fontSize: 10, color: dietMeta.color }} title={dietMeta.label}>{dietMeta.icon}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.25, wordBreak: "break-word" }}>{d.name}</span>
                      </div>
                      {desc && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.3, marginTop: 2 }}>{desc.length > 60 ? desc.slice(0, 58) + '…' : desc}</div>}
                      {!desc && d.hindi && <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>{d.hindi}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMING SOON PLACEHOLDER (non-Kitchen depts)
// ═══════════════════════════════════════════════════════════════
function ComingSoonPlaceholder({ T2, dept }) {
  if (!dept) return null;
  return (
    <div style={{ padding: "60px 20px", textAlign: "center", background: C.surface, borderRadius: 14, border: "1px dashed " + C.border }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{dept.icon}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.text, fontFamily: "var(--font-display)", marginBottom: 6 }}>
        {dept.name} — {T2("Phase 5")}
      </div>
      <div style={{ fontSize: 13, color: C.muted, maxWidth: 460, margin: "0 auto", lineHeight: 1.5 }}>
        {T2("Service, Crockery, and Transport are configuration-only departments (no items to pick). Their config tabs — glassware, ratios, vehicles, uniforms — ship in Phase 5.")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Small UI bits
// ═══════════════════════════════════════════════════════════════
function SubTab({ label, active, disabled, title }) {
  var style = {
    padding: "10px 14px", background: "transparent", border: "none",
    borderBottom: "2.5px solid " + (active ? (C.gold || "#D4A843") : "transparent"),
    color: active ? C.text : (disabled ? C.muted : C.text),
    fontSize: 13, fontWeight: active ? 700 : 500,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    marginBottom: -1,
  };
  return <button style={style} disabled={disabled} title={title || ''}>{label}</button>;
}

function DietChip({ active, onClick, color, label }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "6px 10px", borderRadius: 16,
        background: active ? color : "transparent",
        border: "1px solid " + (active ? color : "#DDD"),
        color: active ? "#fff" : color,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
      }}>{label}</button>
  );
}

export default MenuBuilderView;