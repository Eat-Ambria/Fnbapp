// Ambria FnB — Constants & configuration data
// Extracted from App.jsx

const C = {
  navy:"#08070A",
  wine:"#C9A84C",   wineMid:"#A88B30",  wineBg:"#1A1810",   wineBorder:"#332E1E",
  bg:"#0A0908",     surface:"#131210",   surfaceHover:"#1A1918",
  border:"#252320", borderLight:"#1C1B18",
  text:"#F4F0E4",   muted:"#8E8678",     faint:"#5C5850",
  green:"#3EAA68",  greenBg:"#0E1E16",   greenBorder:"#1A3826",
  red:"#D64040",    redBg:"#1E0E0E",     redBorder:"#381A1A",
  amber:"#D4A843",  amberBg:"#1E1A0E",   amberBorder:"#382E16",
  blue:"#5B8FD0",   blueBg:"#0E1420",    blueBorder:"#1A2E42",
  purple:"#8A70C8", purpleBg:"#120E1E",  purpleBorder:"#281E40",
  teal:"#50B0A0",   tealBg:"#0E1E1A",    tealBorder:"#1A3830",
  gold:"#D4B44A",   goldBg:"#1A1710",    goldBorder:"#38321E",
  cream:"#F4F0E4",  darkCard:"#161514",  darkCardHover:"#1E1D1A",
  shadow:"rgba(0,0,0,.6)",
  glow:"rgba(212,180,74,.08)",
  glass:"rgba(20,18,16,.85)",
};

const AVATAR_COLORS = [
  "#E8961E","#2B7AB8","#C84040","#2B8A50","#7040A8",
  "#C07820","#1A7A6A","#A84060","#406888","#808040",
];

const SECTIONS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets"];
const ALL_DEPARTMENTS = ["Indian Curries","Tandoor","Chinese","Chaat","Sweets","Beverages","Service","Crockery","Transportation","ODC","Outdoor Staff","Management"];
const SECTION_META = {
  "Indian Curries": {color:"#D4A843", bg:"#1E1A10", dot:"#D4A843", icon:"🍛"},
  "Tandoor":        {color:"#D06040", bg:"#201410", dot:"#D06040", icon:"🔥"},
  "Chinese":        {color:"#8A70C8", bg:"#14101E", dot:"#8A70C8", icon:"🥢"},
  "Chaat":          {color:"#4DAA6A", bg:"#0E1E14", dot:"#4DAA6A", icon:"🌮"},
  "Sweets":         {color:"#D06080", bg:"#1E1014", dot:"#D06080", icon:"🍮"},
  "Beverages":      {color:"#50B0A0", bg:"#0E1E1A", dot:"#50B0A0", icon:"☕"},
  "Service":        {color:"#5B8FD0", bg:"#0E1620", dot:"#5B8FD0", icon:"🍽️"},
  "Crockery":       {color:"#8A70C8", bg:"#14101E", dot:"#8A70C8", icon:"🍶"},
  "Transportation": {color:"#D4A843", bg:"#1A1710", dot:"#D4A843", icon:"🚛"},
  "ODC":            {color:"#D06040", bg:"#201410", dot:"#D06040", icon:"🏕️"},
  "Management":     {color:"#C4A44A", bg:"#1A1710", dot:"#C4A44A", icon:"👑"},
  "Outdoor Staff":  {color:"#E8A040", bg:"#1E1810", dot:"#E8A040", icon:"👷"},
};
// ─── OUTSIDE VENDORS ──────────────────────────────────────────────
const OUTSIDE_VENDORS = [
  {id:"v1", name:"Ramesh Kumar",  specialty:"Indian Curries", phone:"98100-11111", rating:"4.8", rate:2500, active:true},
  {id:"v2", name:"Anil Yadav",    specialty:"Tandoor",        phone:"98200-22222", rating:"4.9", rate:2800, active:true},
  {id:"v3", name:"Suresh Tiwari", specialty:"Beverages",           phone:"98300-33333", rating:"4.5", rate:2200, active:true},
  {id:"v4", name:"Dinesh Sharma", specialty:"Chinese",        phone:"98400-44444", rating:"4.7", rate:2600, active:true},
  {id:"v5", name:"Manoj Gupta",   specialty:"Chaat",          phone:"98500-55555", rating:"4.6", rate:2000, active:true},
  {id:"v6", name:"Priya Caterers",specialty:"Sweets",         phone:"98600-66666", rating:"4.8", rate:3000, active:true},
];

// ─── VEHICLES ─────────────────────────────────────────────────────
const VEHICLES = [
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
const COLD_ITEMS = [
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


const VENDOR_CATEGORIES = ["Outside Chef","Vegetable Supplier","Dairy Supplier","Meat & Poultry","Dry Goods","Ice & Cold Storage","Equipment Rental","Tent & Decor","Flower Vendor","Gas & Fuel","Cleaning & Hygiene","Packaging"];


export { C, AVATAR_COLORS, SECTIONS, ALL_DEPARTMENTS, SECTION_META, OUTSIDE_VENDORS, VEHICLES, COLD_ITEMS, NAV_ADMIN, NAV, AMBRIA_VENUES, VENDOR_CATEGORIES };
