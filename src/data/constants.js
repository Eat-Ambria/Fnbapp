// Ambria FnB — Constants & configuration data
// App config (colors, sections, nav) stays here.
// Operational data (vendors, vehicles, cold items) → empty, hydrated from Supabase.

const C = {
  navy:"#1A1816",
  wine:"#8B5E2F",   wineMid:"#6D4A25",  wineBg:"#FDF6EE",   wineBorder:"#E8D5BD",
  bg:"#F7F5F0",     surface:"#FFFFFF",   surfaceHover:"#F2F0EB",
  border:"#E2DFD8", borderLight:"#ECEAE4",
  text:"#1A1816",   muted:"#8E8678",     faint:"#B8B2A6",
  green:"#1D9E75",  greenBg:"#E1F5EE",   greenBorder:"#9FE1CB",
  red:"#D64040",    redBg:"#FCEBEB",     redBorder:"#F7C1C1",
  amber:"#BA7517",  amberBg:"#FAEEDA",   amberBorder:"#FAC775",
  blue:"#378ADD",   blueBg:"#E6F1FB",    blueBorder:"#B5D4F4",
  purple:"#7F77DD", purpleBg:"#EEEDFE",  purpleBorder:"#CECBF6",
  teal:"#1D9E75",   tealBg:"#E1F5EE",    tealBorder:"#9FE1CB",
  gold:"#8B5E2F",   goldBg:"#FDF6EE",    goldBorder:"#E8D5BD",
  cream:"#1A1816",  darkCard:"#FFFFFF",  darkCardHover:"#F7F5F0",
  shadow:"rgba(0,0,0,.08)",
  glow:"rgba(139,94,47,.06)",
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
  "Management":     {color:"#8B5E2F", bg:"#FDF6EE", dot:"#8B5E2F", icon:"👑"},
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
  {id:"repair",     label:"Repair & Maintenance",  icon:"🔧"},
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
      newMeta[c.name] = {color:c.color||'#8E8678', bg:(c.color||'#8E8678')+'18', dot:c.color||'#8E8678', icon:c.icon||'📋'};
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
