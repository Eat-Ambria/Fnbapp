// Ambria FnB — ODC Operations Module
// Full operational screen for Outdoor Catering events
// Reads from events prop (filtered to ODC venue), persists checklists to Supabase
import React, { useState, useEffect } from "react";
import { C } from '../data/constants.js';
import { T } from '../data/translations.js';
import { TODAY, TOMORROW, safeArr } from '../utils/helpers.js';
import { Card, Avatar, Chip } from './SharedUI.jsx';
import { supabase } from '../lib/supabase.js';
import { logActivity } from './ActivityLog.jsx';
import { dbUpsert, dbDelete } from '../lib/db.js';

// ── Hardcoded fallback (used only if DB has no odc_ checklist rows) ──
const FALLBACK_ITEMS = {
  site:[{id:"s1",label:"Power supply confirmed at venue"},{id:"s2",label:"Water availability checked"},{id:"s3",label:"Parking space for vehicles"},{id:"s4",label:"Kitchen area dimensions measured"},{id:"s5",label:"Generator placement identified"},{id:"s6",label:"Fire safety exits verified"},{id:"s7",label:"Gas cylinder storage area marked"},{id:"s8",label:"Client walkthrough completed"}],
  equipment:[{id:"e1",label:"Gas cylinders loaded & counted"},{id:"e2",label:"Tandoor packed & secured"},{id:"e3",label:"Cooking utensils counted against checklist"},{id:"e4",label:"Crockery crates sealed & labelled"},{id:"e5",label:"Tables & chairs count verified"},{id:"e6",label:"Serving station setup items packed"},{id:"e7",label:"Chafing dishes & fuel cans"},{id:"e8",label:"Cleaning supplies & dustbins"}],
  dispatch:[{id:"d1",label:"D-1 prep items loaded in fridge truck"},{id:"d2",label:"Cold chain items temperature verified"},{id:"d3",label:"Transport vehicle assigned & fuelled"},{id:"d4",label:"Driver briefed on route & timing"},{id:"d5",label:"Equipment manifest signed by Gopal"},{id:"d6",label:"Crockery count cross-checked with manifest"},{id:"d7",label:"Live dishes timing plan shared with kitchen"}],
  onsite:[{id:"o1",label:"Kitchen setup complete at venue"},{id:"o2",label:"Gas connections tested — no leaks"},{id:"o3",label:"Water supply connected & running"},{id:"o4",label:"First dish timing confirmed with client"},{id:"o5",label:"Service line layout approved by client"},{id:"o6",label:"Staff positions assigned"},{id:"o7",label:"Backup items accessible (extra plates, cutlery)"}],
  teardown:[{id:"t1",label:"All equipment counted back against manifest"},{id:"t2",label:"Leftover food handled per SOP"},{id:"t3",label:"Crockery crates sealed for return"},{id:"t4",label:"Generator returned / rental closed"},{id:"t5",label:"Venue cleaned — no items left behind"},{id:"t6",label:"Client sign-off / feedback collected"},{id:"t7",label:"Transport loaded & dispatched back to base"}],
};

const PHASE_META = {
  site:      {label:"Site Recce",  icon:"📍", color:C.green},
  equipment: {label:"Equipment",   icon:"🔧", color:C.amber},
  dispatch:  {label:"Dispatch",    icon:"🚛", color:C.blue},
  onsite:    {label:"On-site",     icon:"🍳", color:C.purple},
  teardown:  {label:"Teardown",    icon:"🧹", color:C.muted},
};
const PHASES = Object.keys(PHASE_META);

// Resolve checklist template: DB checklists (from prop) → fallback
function resolveTemplate(checklistsCfg) {
  const tpl = {};
  PHASES.forEach(ph => {
    const dbKey = "odc_" + ph;
    const rows = (checklistsCfg && checklistsCfg[dbKey]) || [];
    if (rows.length > 0) {
      tpl[ph] = rows.map(r => ({ id: r.item_key, label: r.label_en }));
    } else {
      tpl[ph] = FALLBACK_ITEMS[ph] || [];
    }
  });
  return tpl;
}

function ODCModule({ events=[], lang="en", currentUser=null, checklistsCfg=null }) {
  const T2 = s => T(s, lang);
  const isAdmin = currentUser?.role === 'admin';

  // ── Checklist template (from DB or fallback) ──
  const [template, setTemplate] = useState(() => resolveTemplate(checklistsCfg));
  useEffect(() => { setTemplate(resolveTemplate(checklistsCfg)); }, [checklistsCfg]);

  // ── Admin editing state ──
  const [editingPhase, setEditingPhase] = useState(null); // null = not editing, "site" etc
  const [editItems, setEditItems] = useState([]);
  const [newItemLabel, setNewItemLabel] = useState("");

  // Filter to ODC events only, upcoming + recent
  const odcEvs = safeArr(events)
    .filter(e => e.venue === "Outdoor Catering (ODC)" && e.date)
    .sort((a,b) => a.date.localeCompare(b.date));

  const upcomingOdc = odcEvs.filter(e => e.date >= TODAY);
  const pastOdc = odcEvs.filter(e => e.date < TODAY).slice(-5).reverse();

  const [selEvId, setSelEvId] = useState(null);
  const [phase, setPhase] = useState("site");
  const [checklists, setChecklists] = useState({}); // { evId: { phase: {items, notes} } }
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Auto-select first upcoming event
  useEffect(() => {
    if (!selEvId && upcomingOdc.length > 0) setSelEvId(upcomingOdc[0].id);
  }, [events]);

  const selEv = odcEvs.find(e => e.id === selEvId) || null;

  // ── Load checklists from Supabase for selected event ──
  useEffect(() => {
    if (!selEvId || !supabase) return;
    if (checklists[selEvId]) {
      // Already loaded — restore note for current phase
      setNoteText((checklists[selEvId]?.[phase]?.notes) || "");
      return;
    }
    setLoading(true);
    supabase.from("odc_checklists").select("*").eq("ev_id", selEvId)
      .then(({ data }) => {
        const byPhase = {};
        (data || []).forEach(row => {
          byPhase[row.phase] = {
            items: (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) || [],
            notes: row.notes || "",
          };
        });
        setChecklists(prev => ({ ...prev, [selEvId]: byPhase }));
        setNoteText(byPhase[phase]?.notes || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selEvId]);

  // When phase changes, update note text
  useEffect(() => {
    setNoteText((checklists[selEvId]?.[phase]?.notes) || "");
  }, [phase, selEvId]);

  // ── Get items for current event+phase (merge defaults with saved state) ──
  function getItems(evId, ph) {
    const saved = checklists[evId]?.[ph]?.items || [];
    const defaults = template[ph] || [];
    // Merge: use saved state for items that exist, add any new defaults
    const savedMap = {};
    saved.forEach(s => { savedMap[s.id] = s; });
    return defaults.map(d => savedMap[d.id] || { ...d, checked: false, checkedBy: null, checkedAt: null });
  }

  // ── Toggle a checklist item ──
  function toggleItem(evId, ph, itemId) {
    const items = getItems(evId, ph);
    const updated = items.map(item => {
      if (item.id !== itemId) return item;
      const nowChecked = !item.checked;
      return {
        ...item,
        checked: nowChecked,
        checkedBy: nowChecked ? (currentUser?.name || "Staff") : null,
        checkedAt: nowChecked ? new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null,
      };
    });
    // Update local state
    setChecklists(prev => ({
      ...prev,
      [evId]: {
        ...(prev[evId] || {}),
        [ph]: { items: updated, notes: prev[evId]?.[ph]?.notes || "" },
      },
    }));
    // Persist to Supabase
    if (supabase) {
      supabase.from("odc_checklists").upsert({
        ev_id: evId, phase: ph, items: updated,
        notes: checklists[evId]?.[ph]?.notes || "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "ev_id,phase" }).catch(e => console.error("ODC checklist save:", e));
    }
  }

  // ── Save notes ──
  function saveNotes(evId, ph, text) {
    setChecklists(prev => ({
      ...prev,
      [evId]: {
        ...(prev[evId] || {}),
        [ph]: { items: getItems(evId, ph), notes: text },
      },
    }));
    if (supabase) {
      supabase.from("odc_checklists").upsert({
        ev_id: evId, phase: ph,
        items: checklists[evId]?.[ph]?.items || getItems(evId, ph),
        notes: text,
        updated_at: new Date().toISOString(),
      }, { onConflict: "ev_id,phase" }).catch(e => console.error("ODC notes save:", e));
    }
  }

  // ── Progress calculations ──
  function phasePct(evId, ph) {
    const items = getItems(evId, ph);
    if (items.length === 0) return 0;
    return Math.round(items.filter(i => i.checked).length / items.length * 100);
  }
  function overallPct(evId) {
    let done = 0, total = 0;
    PHASES.forEach(ph => {
      const items = getItems(evId, ph);
      total += items.length;
      done += items.filter(i => i.checked).length;
    });
    return total > 0 ? Math.round(done / total * 100) : 0;
  }

  // ── Admin checklist template editing ──
  function openEditPhase(ph) {
    setEditingPhase(ph);
    setEditItems((template[ph] || []).map((it, i) => ({ ...it, sort_order: i + 1 })));
    setNewItemLabel("");
  }
  function closeEdit() { setEditingPhase(null); setEditItems([]); setNewItemLabel(""); }
  function addEditItem() {
    const label = newItemLabel.trim();
    if (!label) return;
    const prefix = editingPhase.charAt(0);
    const nextNum = editItems.length + 1;
    const id = "odc-" + prefix + nextNum + "-" + Date.now();
    setEditItems(prev => [...prev, { id, label, sort_order: prev.length + 1 }]);
    setNewItemLabel("");
  }
  function removeEditItem(id) { setEditItems(prev => prev.filter(it => it.id !== id).map((it, i) => ({ ...it, sort_order: i + 1 }))); }
  function moveEditItem(idx, dir) {
    setEditItems(prev => {
      const arr = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return arr;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr.map((it, i) => ({ ...it, sort_order: i + 1 }));
    });
  }
  async function saveEditPhase() {
    if (!editingPhase) return;
    const dbType = "odc_" + editingPhase;
    // Delete old rows for this type
    if (supabase) {
      await supabase.from("checklists").delete().eq("type", dbType);
      // Insert new rows
      const rows = editItems.map(it => ({
        id: it.id.startsWith("odc-") ? it.id : "odc-" + it.id,
        type: dbType,
        name: it.label,
        sort_order: it.sort_order,
        is_active: true,
      }));
      if (rows.length > 0) {
        await supabase.from("checklists").upsert(rows, { onConflict: "id" });
      }
    }
    // Update local template
    setTemplate(prev => ({ ...prev, [editingPhase]: editItems.map(it => ({ id: it.id.startsWith("odc-") ? it.id : "odc-" + it.id, label: it.label })) }));
    logActivity('odc', 'Updated ODC checklist: ' + PHASE_META[editingPhase].label + ' (' + editItems.length + ' items)', 'odc_checklist_edit', { phase: editingPhase }, currentUser?.id);
    closeEdit();
  }

  const daysDiff = (d) => Math.round((new Date(d+"T00:00") - new Date(TODAY+"T00:00")) / 864e5);
  const daysLabel = (n) => n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 0 ? `in ${n}d` : `${Math.abs(n)}d ago`;

  // ── Empty state ──
  if (odcEvs.length === 0) {
    return (
      <div>
        <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:4,fontFamily:"var(--font-display)"}}>🏕 {T2("Outdoor Catering")}</div>
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🏕</div>
          <div style={{fontSize:18,fontWeight:500,color:C.text,marginBottom:8}}>{T2("No ODC events")}</div>
          <div style={{fontSize:13,color:C.muted}}>{T2("ODC events from LMS will appear here when outdoor catering contracts are synced.")}</div>
        </div>
      </div>
    );
  }

  const items = selEv ? getItems(selEvId, phase) : [];
  const doneCount = items.filter(i => i.checked).length;
  const curPhaseMeta = PHASE_META[phase];

  return (
    <div>
      {/* ── Header ── */}
      <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:4,fontFamily:"var(--font-display)"}}>🏕 {T2("Outdoor Catering")}</div>

      {/* ── Gopal/Yatender routing banner ── */}
      {upcomingOdc.some(e => e.date === TODAY) && (
        <div style={{background:C.wineBg,border:`1.5px solid ${C.wineBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
          <Avatar name="Gopal" size={36} index={0}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:C.gold}}>Gopal — ODC Lead (on-site today)</div>
            <div style={{fontSize:11,color:C.gold,opacity:.8}}>Venue rounds suspended. Yatender anchoring AP base kitchen.</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,color:C.muted}}>AP Anchor</div>
            <div style={{fontSize:12,fontWeight:600,color:C.text}}>Yatender</div>
          </div>
        </div>
      )}

      {/* ── Event selector ── */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:6}}>Upcoming ODC events</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {upcomingOdc.map(ev => {
            const isSel = selEvId === ev.id;
            const dd = daysDiff(ev.date);
            const pct = overallPct(ev.id);
            const menuOk = ev.odc_menu_confirmed;
            return (
              <button key={ev.id} onClick={() => { setSelEvId(ev.id); setPhase("site"); }}
                style={{padding:"10px 14px",borderRadius:12,cursor:"pointer",textAlign:"left",minWidth:180,flex:"1 1 180px",maxWidth:280,
                  background:isSel?C.purple+"12":C.surface,
                  border:`1.5px solid ${isSel?C.purple:C.border}`,
                  borderLeft:`4px solid ${isSel?C.purple:menuOk?C.green:C.amber}`,
                }}>
                <div style={{fontSize:13,fontWeight:isSel?700:500,color:C.text}}>{ev.guest}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ev.odc_location || "Location TBD"} · {ev.pax} pax</div>
                <div style={{fontSize:11,color:dd<=1?C.red:C.muted,fontWeight:dd<=1?600:400,marginTop:2}}>{ev.date} · {daysLabel(dd)}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4}}>
                  <div style={{flex:1,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.green:C.purple,borderRadius:2,transition:"width .3s"}}/>
                  </div>
                  <span style={{fontSize:10,color:pct===100?C.green:C.muted,fontWeight:600}}>{pct}%</span>
                  {!menuOk && <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:4,background:C.amberBg,color:C.amber,border:`1px solid ${C.amberBorder}`}}>⚠ menu</span>}
                </div>
              </button>
            );
          })}
        </div>
        {pastOdc.length > 0 && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:11,fontWeight:700,color:C.faint,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Recent</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {pastOdc.map(ev => (
                <button key={ev.id} onClick={() => { setSelEvId(ev.id); setPhase("site"); }}
                  style={{padding:"6px 12px",borderRadius:8,cursor:"pointer",background:selEvId===ev.id?C.bg:"transparent",border:`1px solid ${C.borderLight}`,fontSize:11,color:C.muted}}>
                  {ev.guest} · {ev.date}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Selected event detail ── */}
      {selEv && (
        <Card style={{marginBottom:16,padding:"16px 18px"}}>
          {/* Menu not confirmed warning */}
          {!selEv.odc_menu_confirmed && (
            <div style={{marginBottom:12,padding:"8px 12px",borderRadius:8,background:C.amberBg,border:`1px solid ${C.amberBorder}`,fontSize:12,color:C.amber,fontWeight:600}}>
              ⚠ Menu not confirmed — kitchen prep may have incorrect dishes. Confirm menu in Dashboard.
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:C.text,fontFamily:"var(--font-display)"}}>{selEv.guest}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{selEv.type} · {selEv.date} · {selEv.time || "TBD"} · {selEv.pax} pax</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:28,fontWeight:700,color:overallPct(selEvId)===100?C.green:C.purple}}>{overallPct(selEvId)}%</div>
              <div style={{fontSize:11,color:C.muted}}>overall</div>
            </div>
          </div>

          {/* Info grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
            <div style={{background:C.purpleBg,borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase"}}>Location</div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:2}}>{selEv.odc_location || "TBD"}</div>
              {selEv.odc_address && <div style={{fontSize:11,color:C.muted}}>{selEv.odc_address}</div>}
            </div>
            <div style={{background:C.wineBg,borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.gold,textTransform:"uppercase"}}>ODC Lead</div>
              <div style={{fontSize:12,fontWeight:600,color:C.gold,marginTop:2}}>{selEv.odc_lead || "Gopal"}</div>
              <div style={{fontSize:11,color:C.muted}}>Recce: {selEv.site_recce || "Not done"}</div>
            </div>
            <div style={{background:C.blueBg,borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase"}}>Client contact</div>
              <div style={{fontSize:12,fontWeight:600,color:C.text,marginTop:2}}>{selEv.odc_contact_phone || "—"}</div>
              <div style={{fontSize:11,color:C.muted}}>{selEv.menuPackage || "Custom menu"}</div>
            </div>
          </div>

          {/* Menu summary */}
          {Array.isArray(selEv.menu) && selEv.menu.length > 0 && (
            <div style={{marginBottom:14,padding:"8px 12px",borderRadius:8,background:C.greenBg,border:`1px solid ${C.greenBorder}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.green,marginBottom:4}}>{selEv.menu.length} dishes confirmed</div>
              <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>{selEv.menu.join(" · ")}</div>
            </div>
          )}

          {/* ── Phase tabs ── */}
          <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
            {PHASES.map(ph => {
              const m = PHASE_META[ph];
              const pct = phasePct(selEvId, ph);
              const active = phase === ph;
              return (
                <button key={ph} onClick={() => setPhase(ph)}
                  style={{padding:"7px 14px",borderRadius:20,fontSize:11,fontWeight:active?600:400,cursor:"pointer",
                    background:active?m.color:"transparent",color:active?"#fff":C.muted,
                    border:`1.5px solid ${active?m.color:C.border}`,display:"flex",alignItems:"center",gap:4}}>
                  {m.icon} {m.label}
                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:10,
                    background:active?"rgba(255,255,255,.25)":pct===100?C.greenBg:C.bg,
                    color:active?"#fff":pct===100?C.green:C.muted}}>{pct}%</span>
                </button>
              );
            })}
          </div>

          {/* ── Progress bar ── */}
          <div style={{height:6,background:C.border,borderRadius:3,marginBottom:14,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${phasePct(selEvId,phase)}%`,background:curPhaseMeta.color,borderRadius:3,transition:"width .3s"}}/>
          </div>

          {/* ── Checklist items ── */}
          {loading ? (
            <div style={{textAlign:"center",padding:20,color:C.muted,fontSize:12}}>Loading checklist…</div>
          ) : (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.5,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>{curPhaseMeta.icon} {curPhaseMeta.label} — {doneCount}/{items.length}</span>
                {isAdmin && !editingPhase && <button onClick={() => openEditPhase(phase)} style={{fontSize:10,padding:"3px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,cursor:"pointer",fontWeight:600}}>✏ Edit items</button>}
              </div>
              {items.map(item => {
                const done = !!item.checked;
                return (
                  <label key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid ${C.borderLight}`,cursor:"pointer",minHeight:44}}>
                    <input type="checkbox" checked={done} onChange={() => toggleItem(selEvId, phase, item.id)}
                      style={{width:22,height:22,accentColor:curPhaseMeta.color,cursor:"pointer",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13,color:done?C.muted:C.text,textDecoration:done?"line-through":"none"}}>{item.label}</span>
                      {done && item.checkedBy && (
                        <div style={{fontSize:10,color:C.faint,marginTop:1}}>✓ {item.checkedBy}{item.checkedAt ? " · " + item.checkedAt : ""}</div>
                      )}
                    </div>
                    {done && <Chip label="✓" color={C.green} bg={C.greenBg} size={10}/>}
                  </label>
                );
              })}
            </div>
          )}

          {/* ── Admin edit panel ── */}
          {editingPhase === phase && isAdmin && (
            <div style={{margin:"12px 0",padding:"14px 16px",borderRadius:10,background:C.amberBg,border:`1.5px solid ${C.amberBorder}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:700,color:C.amber}}>✏ Editing: {PHASE_META[editingPhase].label} checklist</span>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={closeEdit} style={{fontSize:11,padding:"5px 12px",borderRadius:6,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,cursor:"pointer"}}>Cancel</button>
                  <button onClick={saveEditPhase} style={{fontSize:11,padding:"5px 14px",borderRadius:6,border:"none",background:C.green,color:"#fff",cursor:"pointer",fontWeight:600}}>Save</button>
                </div>
              </div>
              {editItems.map((it, idx) => (
                <div key={it.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:12,color:C.faint,width:20,textAlign:"center",flexShrink:0}}>{idx+1}</span>
                  <span style={{fontSize:12,color:C.text,flex:1}}>{it.label}</span>
                  <button onClick={() => moveEditItem(idx,-1)} disabled={idx===0} style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:idx===0?C.faint:C.muted,cursor:idx===0?"not-allowed":"pointer"}}>▲</button>
                  <button onClick={() => moveEditItem(idx,1)} disabled={idx===editItems.length-1} style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.border}`,background:C.surface,color:idx===editItems.length-1?C.faint:C.muted,cursor:idx===editItems.length-1?"not-allowed":"pointer"}}>▼</button>
                  <button onClick={() => removeEditItem(it.id)} style={{fontSize:10,padding:"2px 6px",borderRadius:4,border:`1px solid ${C.redBorder}`,background:C.redBg,color:C.red,cursor:"pointer"}}>✕</button>
                </div>
              ))}
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={newItemLabel} onChange={e => setNewItemLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addEditItem(); }}
                  placeholder="New checklist item…"
                  style={{flex:1,padding:"7px 10px",borderRadius:6,border:`1px solid ${C.border}`,fontSize:12,color:C.text,background:C.surface,boxSizing:"border-box"}}/>
                <button onClick={addEditItem} disabled={!newItemLabel.trim()}
                  style={{padding:"7px 14px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,
                    background:newItemLabel.trim()?C.amber:C.border,color:newItemLabel.trim()?"#fff":C.faint,
                    cursor:newItemLabel.trim()?"pointer":"not-allowed"}}>+ Add</button>
              </div>
            </div>
          )}

          {/* ── Field notes ── */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:12,fontWeight:600,color:C.text,marginBottom:4}}>{curPhaseMeta.icon} {T2("Field notes")} — {curPhaseMeta.label}</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              onBlur={() => saveNotes(selEvId, phase, noteText)}
              placeholder={T2("Site observations, issues, client requests…")}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,
                fontSize:12,resize:"none",height:70,fontFamily:"inherit",color:C.text,background:C.bg,boxSizing:"border-box"}}/>
          </div>
        </Card>
      )}
    </div>
  );
}

export { ODCModule };