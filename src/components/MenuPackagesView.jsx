// Ambria FnB — Menu Packages View
import React, { useState } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { MENU_PACKAGES, MENU_PACKAGE_NAMES } from '../data/menuPackages.js';
import { Card } from './SharedUI.jsx';

function MenuPackagesView({lang="en"}) {
  const T2 = s => T(s, lang);
  const pkgNames = Object.keys(MENU_PACKAGES);
  const [selPkg, setSelPkg] = useState(null);
  const [openSections, setOpenSections] = useState({});
  function toggleSection(sec){setOpenSections(p=>({...p,[sec]:!p[sec]}));}

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

  // ── Package list (default view) ──
  if(!selPkg) return (
    <div>
      <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"var(--font-display)",marginBottom:4}}>📜 {T2("Menu")}</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:20}}>{pkgNames.length} {T2("packages")} · {T2("Full catering menus for all events")}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {pkgNames.map(pkg=>{
          const m=PKG_META[pkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
          const items=(MENU_PACKAGES[pkg]||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
          return (
            <button key={pkg} onClick={()=>setSelPkg(pkg)}
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

  // ── Selected package detail ──
  const pm = PKG_META[selPkg]||{icon:"📋",c:C.gold,bg:C.goldBg};
  const menu = (MENU_PACKAGES[selPkg]||[]).filter(d=>guessSectionForDish(d)!=="Beverages");
  const bySection = {};
  menu.filter(d=>guessSectionForDish(d)!=="Beverages").forEach(d=>{const sec=guessSectionForDish(d);if(!bySection[sec])bySection[sec]=[];bySection[sec].push(d);});

  return (
    <div>
      <button onClick={()=>setSelPkg(null)} style={{padding:"10px 18px",borderRadius:10,background:C.darkCard,border:`1px solid ${C.border}`,color:C.muted,fontSize:12,cursor:"pointer",marginBottom:16,minHeight:44}}>← {T2("All Packages")}</button>

      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:40}}>{pm.icon}</div>
        <div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{selPkg}</div>
          <div style={{fontSize:13,color:pm.c,marginTop:3}}>{menu.length} {T2("dishes")} · {Object.keys(bySection).length} {T2("sections")}</div>
        </div>
      </div>

      {Object.entries(bySection).filter(([sec])=>sec!=="Beverages").map(([sec,dishes])=>{
        const m2=SECTION_META[sec]||{color:C.muted,icon:"🍽"};
        const isOpen=!!openSections[sec];
        return (
          <div key={sec} style={{marginBottom:8,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <button onClick={()=>toggleSection(sec)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:isOpen?m2.color+"15":C.darkCard,border:"none",cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:13,fontWeight:700,color:m2.color}}>{m2.icon} {T2(sec)} <span style={{fontWeight:400,fontSize:12,color:C.muted}}>({dishes.length} items)</span></span>
              <span style={{fontSize:14,color:m2.color,transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
            </button>
            {isOpen&&(
              <div style={{padding:"8px 14px 12px"}}>
                {dishes.map((d,i)=>(
                  <div key={i} style={{padding:"6px 0",borderBottom:i<dishes.length-1?`1px solid ${C.borderLight}`:"none",fontSize:12,color:C.text,display:"flex",alignItems:"center",gap:6}}>
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
