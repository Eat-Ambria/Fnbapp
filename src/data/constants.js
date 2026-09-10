// Ambria FnB — Constants & configuration data
// App config (colors, sections, nav) stays here.
// Operational data (vendors, vehicles, cold items) → empty, hydrated from Supabase.

// ─── APP PALETTE ────────────────────────────────────────────────
// Blue / cool-neutral system. Values are kept in sync with the `K`
// tokens in utils/theme.js — change both together if you retheme.
//
// Key names are historical (the app used to be warm gold/cream), so a few
// read oddly against their values. What they actually mean now:
//   gold / goldBg / goldBorder → THE PRIMARY ACCENT (buttons, active states)
//   wine / wineMid             → deeper accent, used as gradient partners
//   cream                      → primary text colour
//   darkCard / darkCardHover   → card surfaces (light, despite the name)
// Renaming them is a large mechanical change across ~2,900 call sites, so the
// names were left alone deliberately.
const C = {
  navy:"#111C33",
  wine:"#1A46C4",   wineMid:"#14369B",  wineBg:"#EAF1FE",   wineBorder:"#C5D8FB",
  bg:"#F6F8FC",     surface:"#FFFFFF",   surfaceHover:"#F1F5FD",
  border:"#E5EAF3", borderLight:"#F0F3F9",
  text:"#111C33",   muted:"#61708C",     faint:"#96A2B8",
  green:"#129A6C",  greenBg:"#E6F7F0",   greenBorder:"#B4E8D3",
  red:"#D9463F",    redBg:"#FDECEB",     redBorder:"#F6C6C3",
  amber:"#C4790C",  amberBg:"#FDF3E2",   amberBorder:"#F5DBA6",
  blue:"#0EA5E9",   blueBg:"#E4F5FE",    blueBorder:"#B6E5FB",
  purple:"#7C5CE0", purpleBg:"#F0EBFC",  purpleBorder:"#DACFF7",
  teal:"#129A6C",   tealBg:"#E6F7F0",    tealBorder:"#B4E8D3",
  gold:"#2563EB",   goldBg:"#EAF1FE",    goldBorder:"#C5D8FB",
  cream:"#111C33",  darkCard:"#FFFFFF",  darkCardHover:"#F6F8FC",
  shadow:"rgba(17,28,51,.07)",
  glow:"rgba(37,99,235,.06)",
  glass:"rgba(255,255,255,.92)",
};

const AVATAR_COLORS = [
  "#E8961E","#2B7AB8","#C84040","#2B8A50","#7040A8",
  "#C07820","#1A7A6A","#A84060","#406888","#808040",
];

const SECTIONS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets"];
let ALL_DEPARTMENTS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Beverages","Service","Crockery","Transportation","ODC","Outdoor Staff","Management"]; // fallback; hydrated from team_sections
let TEAM_DEPTS = []; // Populated from team_departments + team_sections
const NON_KITCHEN_DEPTS = ["Service","Crockery","Transportation","ODC","Outdoor Staff","Management"];
let SECTION_META = {
  "Indian Curries": {color:"#BA7517", bg:"#FAEEDA", dot:"#BA7517", icon:"🍛"},
  "Tandoor":        {color:"#D85A30", bg:"#FAECE7", dot:"#D85A30", icon:"🔥"},
  "Chinese":        {color:"#7F77DD", bg:"#EEEDFE", dot:"#7F77DD", icon:"🥢"},
  "Chaat":          {color:"#1D9E75", bg:"#E1F5EE", dot:"#1D9E75", icon:"🌮"},
  "Sweets":         {color:"#D4537E", bg:"#FBEAF0", dot:"#D4537E", icon:"🍮"},
  "Beverages":      {color:"#1D9E75", bg:"#E1F5EE", dot:"#1D9E75", icon:"☕"},
  "Service":        {color:"#378ADD", bg:"#E6F1FB", dot:"#378ADD", icon:"🍽️"},
  "Crockery":       {color:"#7F77DD", bg:"#EEEDFE", dot:"#7F77DD", icon:"🍶"},
  "Transportation": {color:"#BA7517", bg:"#FAEEDA", dot:"#BA7517", icon:"🚛"},
  "ODC":            {color:"#D85A30", bg:"#FAECE7", dot:"#D85A30", icon:"🏕️"},
  "Management":     {color:"#2563EB", bg:"#EAF1FE", dot:"#2563EB", icon:"👑"},
  "Outdoor Staff":  {color:"#BA7517", bg:"#FAEEDA", dot:"#BA7517", icon:"👷"},
};

// ─── OPERATIONAL DATA — hydrated from Supabase on boot ──────────
let OUTSIDE_VENDORS = [];
let VEHICLES = [];
let COLD_ITEMS = [];
let VENDOR_CATEGORIES = [];

const NAV_ADMIN = [
  {id:"dashboard",  label:"Dashboard",           icon:"📊"},
  {id:"team",       label:"Team & Attendance",    icon:"👥"},
  {id:"kitchen",    label:"Kitchen",              icon:"👨‍🍳"},
  {id:"menus",      label:"Menu",        icon:"📜"},
  {id:"transport",  label:"Transport & Dispatch", icon:"🚛"},
  {id:"store",      label:"Store & Inventory",    icon:"📦"},

  {id:"vendors",    label:"Vendor Directory",      icon:"🤝"},
];
const NAV = NAV_ADMIN;

const AMBRIA_VENUES = [
  {id:"ap",  code:"AP",  name:"Ambria Pushpanjali", location:"Dwarka, Delhi",
   capacity:1500, area:"3 Acres", banquet:"14,000 sq.ft", lawn:"40,000 sq.ft",
   parking:"125+ cars", color:C.gold, bg:C.redBg,
   sections:["Indoor Banquet","Grand Lawn","Walkway (120 ft)"],
   highlight:"Exclusive single-event · Near IGI Airport"},
  {id:"am",  code:"AM",  name:"Ambria Manaktala",   location:"Kapasher, Delhi",
   capacity:2500, area:"3 Acres", banquet:"24,000 sq.ft", lawn:"43,000 sq.ft",
   parking:"250+ cars", color:"#185FA5", bg:"#EEF4FD",
   sections:["Emerald Lawn (Glasshouse + Lawn)","Alstonia Lawn (Open + Covered)","Hanger (8,000 sq.ft)"],
   highlight:"Two venues · 400 ft driveway · Valet parking"},
  {id:"ae",  code:"AE",  name:"Ambria Exotica",     location:"Dwarka, Delhi",
   capacity:1800, area:"4 Acres", banquet:"20,500 sq.ft", lawn:"35,000 sq.ft",
   parking:"300–350 cars", color:"#854F0B", bg:C.goldBg,
   sections:["Aura (Glasshouse + Lawn + Porch)","Valencia (Glasshouse + Lawn + Poolside)"],
   highlight:"Two glasshouses · Poolside venue · 20,000 sq.ft walkway"},
  {id:"ar",  code:"AR",  name:"Ambria Restro",      location:"Dwarka, Delhi",
   capacity:400, area:"0.75 Acres", banquet:"1,500 sq.ft", lawn:"8,000 sq.ft",
   parking:"100+ cars", color:"#0F6E56", bg:"#0E1E1A",
   sections:["Glasshouse (8,000 sq.ft)","Lawn (1,500 sq.ft)","Rooftop","Café / Restro","Pickle Ball Court"],
   highlight:"Rooftop · Café · Pickle Ball Court · Intimate events"},
  {id:"odc", code:"ODC", name:"Outdoor Catering",   location:"Client location",
   capacity:null, area:"Varies", banquet:"N/A", lawn:"N/A",
   parking:"N/A", color:"#5A3FA0", bg:"#F0EDFC",
   sections:["Off-premise events","Client farmhouses","Corporate venues","Banquet halls"],
   highlight:"Gopal leads all ODC events personally"},
];

function hydrateConstants(config) {
  if (config.vehicles && config.vehicles.length) VEHICLES = config.vehicles;
  if (config.coldItems && config.coldItems.length) COLD_ITEMS = config.coldItems;
  if (config.vendors) {
    const outsideChefs = config.vendors.filter(v => v.type === 'outside_chef' || v.cat === 'Outside Chef');
    if (outsideChefs.length) OUTSIDE_VENDORS = outsideChefs.map(v => ({id:v.id,name:v.name,specialty:v.section,phone:v.phone,rating:String(v.rating),rate:v.rate_per_day,active:v.is_active!==false}));
  }
  if (config.vendorCategories && config.vendorCategories.length) VENDOR_CATEGORIES = config.vendorCategories;
  // ── Rebuild section metadata from Supabase recipe_categories ──
  if (config.recipeCategories && config.recipeCategories.length) {
    var cats = config.recipeCategories;
    // Rebuild SECTION_META from Supabase, preserving all initial keys (kitchen legacy names + non-kitchen depts)
    var newMeta = {};
    cats.forEach(function(c){
      newMeta[c.name] = {color:c.color||'#61708C', bg:(c.color||'#61708C')+'18', dot:c.color||'#61708C', icon:c.icon||'📋'};
    });
    Object.keys(SECTION_META).forEach(function(k){ if(!newMeta[k]) newMeta[k] = SECTION_META[k]; });
    SECTION_META = newMeta;
  }
  // ── Team sections (independent of recipe_categories) drive ALL_DEPARTMENTS + TEAM_DEPTS ──
  if (config.teamDepts && config.teamDepts.length) {
    TEAM_DEPTS = config.teamDepts;
    var flat = config.teamDepts.reduce(function(acc,d){ return acc.concat(d.sections || []); }, []);
    if (flat.length) ALL_DEPARTMENTS = flat;
  }
}

/* ── Ambria Ops Inventory (separate Supabase project for decor/catering inventory) ── */
const OPS_SUPABASE_URL = import.meta.env.VITE_OPS_SUPABASE_URL || "";
const OPS_SUPABASE_KEY = import.meta.env.VITE_OPS_SUPABASE_ANON_KEY || "";
const OPS_IMG_BASE = OPS_SUPABASE_URL ? OPS_SUPABASE_URL + "/storage/v1/object/public/images/" : "";

export { C, AVATAR_COLORS, ALL_DEPARTMENTS, TEAM_DEPTS, SECTION_META, OUTSIDE_VENDORS, VEHICLES, COLD_ITEMS, NAV_ADMIN, NAV, AMBRIA_VENUES, VENDOR_CATEGORIES, hydrateConstants, OPS_SUPABASE_URL, OPS_SUPABASE_KEY, OPS_IMG_BASE };
