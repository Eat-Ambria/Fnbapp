// Ambria FnB — Menu Packages View with Bulk Category Editor
import React, { useState } from "react";
import { C, SECTIONS, SECTION_META } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { getSectionForDish, RECIPE_DB } from '../data/recipeData.js';
import { Card } from './SharedUI.jsx';
import { supabase } from '../lib/supabase.js';

// No hardcoded sections — everything comes from RECIPE_DB.cats (Supabase)

function MenuPackagesView({lang="en", currentUser=null}) {
  const T2 = s => T(s, lang);
  const isAdmin = currentUser?.role === 'admin';
  const pkgNames = Object.keys(MENU_PACKAGES);
  const [selPkg, setSelPkg] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState({}); // {dishName: true}
  const [targetSec, setTargetSec] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🍽");
  const [customCats, setCustomCats] = useState([]);

  // Build section list directly from Supabase recipe_categories
  const allSections = (RECIPE_DB.cats || []).map(c => c.name).sort();

  function toggleSection(sec){setOpenSections(p=>({...p,[sec]:!p[sec]}));}

  // Toggle dish selection
  function toggleDish(d) { setSelected(p=>({...p,[d]:!p[d]})); }
  function selectAllInSec(dishes) {
    const all = dishes.every(d=>selected[d]);
    const upd = {...selected};
    dishes.forEach(d => { upd[d] = !all; });
    setSelected(upd);
  }
  const selCount = Object.values(selected).filter(Boolean).length;

  // Reverse map: section display name → category_id
  function secToCatId(secName) {
    const dbCat = (RECIPE_DB.cats || []).find(c => c.name === secName);
    if (dbCat) return dbCat.id;
    return secName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
  }

  // Create new category in Supabase
  async function createCategory() {
    if (!newCatName.trim()) return;
    const catId = newCatName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
    setSaving(true);
    try {
      // Insert into recipe_categories
      const { error } = await supabase.from('recipe_categories').insert({
        id: catId, name: newCatName.trim(), icon: newCatIcon || '🍽',
        sort_order: (RECIPE_DB.cats || []).length + 1
      });
      if (error && error.code !== '23505') throw error; // ignore duplicate
      // Add to local state so it appears in dropdown immediately
      setCustomCats(prev => [...prev, newCatName.trim()]);
      setTargetSec(newCatName.trim());
      setShowNewCat(false);
      setNewCatName("");
      setNewCatIcon("🍽");
    } catch(e) {
      alert('❌ Error creating category: ' + e.message);
    }
    setSaving(false);
  }

  // Move selected dishes to target section
  async function moveSelected() {
    if(!targetSec || selCount===0) return;
    setSaving(true);
    const catId = secToCatId(targetSec);
    const dishNames = Object.keys(selected).filter(k=>selected[k]);

    try {
      for(const name of dishNames) {
        // Check if recipe already exists
        const {data:existing} = await supabase
          .from('recipes')
          .select('id,dish_name,category_id')
          .ilike('dish_name', name)
          .limit(1);

        if(existing && existing.length > 0) {
          // Update category
          await supabase.from('recipes').update({category_id: catId}).eq('id', existing[0].id);
        } else {
          // Insert new minimal recipe
          await supabase.from('recipes').insert({
            dish_name: name, category_id: catId, sub:'', steps:'[]', ingredients:'{}'
          });
        }
      }
      alert(`✅ Moved ${dishNames.length} dish${dishNames.length>1?'es':''} to ${targetSec}`);
      setSelected({});
      setEditMode(false);
      // Clear caches and reload to re-hydrate RECIPE_DB
      try {
        localStorage.removeItem('ambria_cfg_recipes');
        localStorage.removeItem('ambria_cfg_recipe_categories');
        localStorage.removeItem('ambria_cfg_menu_packages');
      } catch(e){}
      window.location.reload();
    } catch(e) {
      alert('❌ Error: ' + e.message);
    }
    setSaving(false);
  }

  const PKG_META = {
    "Multi-Cuisine Veg":    {icon:"🌱",c:"#4DAA6A",bg:C.greenBg},
    "Multi-Cuisine Non-Veg":{icon:"🍗",c:"#D06040",bg:C.redBg},
    "Magnum Veg":           {icon:"⭐",c:"#D4A843",bg:C.goldBg},
    "Magnum Non-Veg":       {icon:"🌟",c:"#D06040",bg:C.redBg},
    "Double Magnum Veg":    {icon:"🏆",c:"#50B0A0",bg:C.tealBg},
    "Double Magnum Non-Veg":{icon:"🏅",c:"#5B8FD0",bg:C.blueBg},
    "Luxury Veg":           {icon:"👑",c:"#8A70C8",bg:C.purpleBg},
    "Luxury Non-Veg":       {icon:"💎",c:"#5B8FD0",bg:C.blueBg},
  };

  // ── Package list ──
  if(!selPkg) return (
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>📜 {T2("Menu")}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{pkgNames.length} {T2("packages")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {pkgNames.map(pkg=>{
          const m=PKG_META[pkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
          const items=(MENU_PACKAGES[pkg]||[]);
          return (
            <button key={pkg} onClick={()=>{setSelPkg(pkg);setEditMode(false);setSelected({});}}
              style={{background:C.surface,border:`2px solid ${m.c}30`,borderRadius:16,padding:"20px 18px",cursor:"pointer",textAlign:"left",display:"flex",gap:14,alignItems:"center",minHeight:80,transition:"all .15s"}}>
              <div style={{fontSize:32,flexShrink:0}}>{m.icon}</div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:C.text}}>{pkg}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:3}}>{items.length} {T2("dishes")}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Build section groups ──
  const allDishes = MENU_PACKAGES[selPkg] || [];
  const bySection = {};
  allDishes.forEach(d => {
    const sec = getSectionForDish(d);
    if(!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(d);
  });
  const pm = PKG_META[selPkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
  const nonBevDishes = allDishes.filter(d => getSectionForDish(d) !== "Beverages");

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>{setSelPkg(null);setEditMode(false);setSelected({});}} style={{padding:"10px 18px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",minHeight:44}}>← {T2("All Packages")}</button>
        {isAdmin && !editMode && (
          <button onClick={()=>setEditMode(true)} style={{padding:"10px 18px",borderRadius:10,background:C.amberBg,border:`1px solid ${C.amberBorder}`,color:C.amber,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✏️ Edit Categories</button>
        )}
        {editMode && (
          <button onClick={()=>{setEditMode(false);setSelected({});}} style={{padding:"10px 18px",borderRadius:10,background:C.redBg,border:`1px solid ${C.redBorder}`,color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44}}>✕ Cancel</button>
        )}
      </div>

      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:editMode?12:20}}>
        <div style={{fontSize:40}}>{pm.icon}</div>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{selPkg}</div>
          <div style={{fontSize:13,color:pm.c,marginTop:3}}>{nonBevDishes.length} {T2("dishes")} · {Object.keys(bySection).filter(s=>s!=="Beverages").length} {T2("sections")}</div>
        </div>
      </div>

      {/* ── Bulk Move Bar (sticky) ── */}
      {editMode && (
        <div style={{position:"sticky",top:0,zIndex:20,background:C.amberBg,border:`1.5px solid ${C.amberBorder}`,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:600,color:C.amber}}>{selCount} selected</span>
            <select value={targetSec} onChange={e=>{
              if(e.target.value==="__new__"){setShowNewCat(true);setTargetSec("");}
              else{setTargetSec(e.target.value);setShowNewCat(false);}
            }}
              style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface,minWidth:140}}>
              <option value="">Move to…</option>
              {allSections.map(s=><option key={s} value={s}>{(SECTION_META[s]||{icon:"🍽"}).icon} {s}</option>)}
              <option value="__new__">＋ New Section…</option>
            </select>
            <button onClick={moveSelected} disabled={!targetSec||selCount===0||saving}
              style={{padding:"8px 16px",borderRadius:8,background:selCount>0&&targetSec?C.green:C.faint,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:selCount>0&&targetSec?"pointer":"not-allowed",opacity:saving?0.5:1}}>
              {saving ? "Saving…" : `Move ${selCount} →`}
            </button>
          </div>
          {/* New section inline form */}
          {showNewCat && (
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:10,flexWrap:"wrap"}}>
              <input value={newCatIcon} onChange={e=>setNewCatIcon(e.target.value)} placeholder="🍽"
                style={{width:40,padding:"6px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:16,textAlign:"center",background:C.surface}} maxLength={2}/>
              <input value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="Section name e.g. Continental"
                style={{flex:1,minWidth:160,padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,fontSize:12,background:C.surface}}
                onKeyDown={e=>e.key==='Enter'&&createCategory()}/>
              <button onClick={createCategory} disabled={!newCatName.trim()||saving}
                style={{padding:"6px 14px",borderRadius:8,background:newCatName.trim()?C.green:C.faint,color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:newCatName.trim()?"pointer":"not-allowed"}}>
                {saving?"…":"Create"}
              </button>
              <button onClick={()=>{setShowNewCat(false);setNewCatName("");}}
                style={{padding:"6px 10px",borderRadius:8,background:"transparent",border:`1px solid ${C.border}`,color:C.muted,fontSize:11,cursor:"pointer"}}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Section groups ── */}
      {Object.entries(bySection).filter(([sec])=>sec!=="Beverages").sort(([a],[b])=>a.localeCompare(b)).map(([sec,dishes])=>{
        const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
        const isOpen=!!openSections[sec];
        const allSelected = dishes.every(d=>selected[d]);

        return (
          <div key={sec} style={{marginBottom:8,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <button onClick={()=>toggleSection(sec)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:isOpen?m2.color+"15":C.darkCard,border:"none",cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:13,fontWeight:700,color:m2.color}}>
                {m2.icon} {T2(sec)} <span style={{fontWeight:400,fontSize:12,color:C.muted}}>({dishes.length} items)</span>
              </span>
              <span style={{fontSize:14,color:m2.color,transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
            </button>
            {isOpen&&(
              <div style={{padding:"8px 14px 12px"}}>
                {/* Select all for this section */}
                {editMode && (
                  <div onClick={()=>selectAllInSec(dishes)} style={{padding:"6px 0 8px",borderBottom:`1px solid ${C.borderLight}`,fontSize:11,color:C.amber,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:18,height:18,borderRadius:4,border:`2px solid ${allSelected?C.green:C.border}`,background:allSelected?C.green:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",flexShrink:0}}>{allSelected?"✓":""}</span>
                    {allSelected ? "Deselect all" : "Select all"} ({dishes.length})
                  </div>
                )}
                {dishes.map((d,i)=>(
                  <div key={i} onClick={editMode?()=>toggleDish(d):undefined}
                    style={{padding:"6px 0",borderBottom:i<dishes.length-1?`1px solid ${C.borderLight}`:"none",fontSize:12,color:C.text,display:"flex",alignItems:"center",gap:6,cursor:editMode?"pointer":"default",background:selected[d]?C.amberBg+"80":"transparent",borderRadius:selected[d]?6:0,paddingLeft:selected[d]?6:0,transition:"all .1s"}}>
                    {editMode && (
                      <span style={{width:18,height:18,borderRadius:4,border:`2px solid ${selected[d]?C.green:C.border}`,background:selected[d]?C.green:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",flexShrink:0}}>{selected[d]?"✓":""}</span>
                    )}
                    <span style={{color:m2.color,fontSize:10}}>•</span>{d}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { MenuPackagesView };
