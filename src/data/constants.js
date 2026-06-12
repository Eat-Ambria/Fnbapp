// Ambria FnB — Constants & configuration data
// Extracted from App.jsx

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
const ALL_DEPARTMENTS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Beverages","Service","Crockery","Transportation","ODC","Outdoor Staff","Management"];
const SECTION_META = {
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
// ─── OUTSIDE VENDORS ──────────────────────────────────────────────
let OUTSIDE_VENDORS = [
  {id:"v1", name:"Ramesh Kumar",  specialty:"Indian Curries", phone:"98100-11111", rating:"4.8", rate:2500, active:true},
  {id:"v2", name:"Anil Yadav",    specialty:"Tandoor",        phone:"98200-22222", rating:"4.9", rate:2800, active:true},
  {id:"v3", name:"Suresh Tiwari", specialty:"Beverages",           phone:"98300-33333", rating:"4.5", rate:2200, active:true},
  {id:"v4", name:"Dinesh Sharma", specialty:"Chinese",        phone:"98400-44444", rating:"4.7", rate:2600, active:true},
  {id:"v5", name:"Manoj Gupta",   specialty:"Chaat",          phone:"98500-55555", rating:"4.6", rate:2000, active:true},
  {id:"v6", name:"Priya Caterers",specialty:"Sweets",         phone:"98600-66666", rating:"4.8", rate:3000, active:true},
];

// ─── VEHICLES ─────────────────────────────────────────────────────
let VEHICLES = [
  {id:"DL1LAJ1250", name:"DL1LAJ 1250", icon:"🚛", type:"dry",   note:"Truck open body — main food + equipment runs"},
  {id:"DL1LAN1814", name:"DL1LAN 1814", icon:"🚛", type:"dry",   note:"Truck open body — secondary load carrier"},
  {id:"DL1LAN2125", name:"DL1LAN 2125", icon:"❄🚛",type:"cold",  note:"Truck close body AC — dairy, sweets, cold items"},
  {id:"DL1LW5357",  name:"DL1LW 5357",  icon:"🛺", type:"quick", note:"Chhota Hathi — medium loads, quick runs"},
  {id:"DL9CBD3260",  name:"DL9CBD 3260", icon:"🚙", type:"quick", note:"Eeco — staff + small items transport"},
  {id:"DL9CAR4073",  name:"DL9CAR 4073", icon:"🚙", type:"quick", note:"Eeco — staff + small items transport"},
  {id:"DL4ERB3958",  name:"DL4ERB 3958", icon:"🛺", type:"quick", note:"E-Riksha — local short runs"},
  {id:"DL4ERB4678",  name:"DL4ERB 4678", icon:"🛺", type:"quick", note:"E-Riksha — local short runs"},
];

// ─── COLD ITEMS (require fridge truck) ────────────────────────────
let COLD_ITEMS = [
  "cream","chhena","paneer","rabri","rasmalai","kulfi","ice cream",
  "butter","dairy","milk","curd","raita","lassi","mousse","parfait",
  "cheesecake","tiramisu","gajar halwa","kheer",
];

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


let VENDOR_CATEGORIES = ["Outside Chef","Vegetable Supplier","Dairy Supplier","Meat & Poultry","Dry Goods","Ice & Cold Storage","Equipment Rental","Tent & Decor","Flower Vendor","Gas & Fuel","Cleaning & Hygiene","Packaging"];


function hydrateConstants(config) {
  if (config.vehicles && config.vehicles.length) VEHICLES = config.vehicles;
  if (config.coldItems && config.coldItems.length) COLD_ITEMS = config.coldItems;
  if (config.vendors) {
    const outsideChefs = config.vendors.filter(v => v.type === 'outside_chef' || v.cat === 'Outside Chef');
    if (outsideChefs.length) OUTSIDE_VENDORS = outsideChefs.map(v => ({id:v.id,name:v.name,specialty:v.section,phone:v.phone,rating:String(v.rating),rate:v.rate_per_day,active:v.is_active!==false}));
  }
  if (config.vendorCategories && config.vendorCategories.length) VENDOR_CATEGORIES = config.vendorCategories;
}

export { C, AVATAR_COLORS, SECTIONS, ALL_DEPARTMENTS, SECTION_META, OUTSIDE_VENDORS, VEHICLES, COLD_ITEMS, NAV_ADMIN, NAV, AMBRIA_VENUES, VENDOR_CATEGORIES, hydrateConstants };
