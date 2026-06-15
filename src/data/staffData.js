// Ambria FnB — Staff list, Employee DB seed, Grooming checks
// Extracted from App.jsx

let STAFF_LIST = [
  {id:1, name:"Gopal",           role:"Head Chef",  section:"Management",     shift:"Morning"},
  {id:2, name:"Yatender",        role:"Head Chef",  section:"Management",     shift:"Evening"},
  {id:3, name:"Caonty",          role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:4, name:"Rahul",           role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:5, name:"Kareena",         role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:6, name:"Noor Alam",       role:"Chef",       section:"Beverages",           shift:"Morning"},
  {id:7, name:"Deepu (Café)",    role:"Chef",       section:"Beverages",           shift:"Evening"},
  {id:8, name:"Devendar",        role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:9, name:"Anas",            role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:10,name:"Bhopal",          role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:11,name:"Jeetu",           role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:12,name:"Hina",            role:"Chef",       section:"Indian Curries", shift:"Morning"},
  {id:13,name:"Roshan",          role:"Staff Khana",section:"Indian Curries", shift:"Morning"},
  {id:14,name:"Kishor",          role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:15,name:"Lokesh",          role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:16,name:"Monu",            role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:17,name:"Vichesh",         role:"Chef",       section:"Chinese",        shift:"Morning"},
  {id:18,name:"Sandeep",         role:"Chef",       section:"Chinese",        shift:"Evening"},
  {id:19,name:"Bipin",           role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:20,name:"Yetender",        role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:21,name:"Rawat",           role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:22,name:"Surender",        role:"Chef",       section:"Tandoor",        shift:"Morning"},
  {id:23,name:"Prabhash",        role:"Chef",       section:"Tandoor",        shift:"Evening"},
  {id:24,name:"Kushal Pal",      role:"Chef",       section:"Tandoor",        shift:"Evening"},
  {id:25,name:"Raghvendra",      role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:26,name:"Purushotam",      role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:27,name:"Balram",          role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:28,name:"Ajay",            role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:29,name:"Golu",            role:"Chef",       section:"Chaat",          shift:"Morning"},
  {id:30,name:"Kuldeep",         role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:31,name:"Anurag",          role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:32,name:"Satyendra",       role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:33,name:"Sahdev",          role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:34,name:"Badal",           role:"Chef",       section:"Chaat",          shift:"Evening"},
  {id:35,name:"Bachchan",        role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:36,name:"Anil",            role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:37,name:"Ramu",            role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:38,name:"Yogesh",          role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:39,name:"Vrindhavan",      role:"Chef",       section:"Sweets",         shift:"Morning"},
  {id:40,name:"Radheshyam",      role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:41,name:"Abhishek",        role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:42,name:"Deepu (Sweets)",  role:"Chef",       section:"Sweets",         shift:"Evening"},
  {id:43,name:"Saurab",          role:"Chef",       section:"Sweets",         shift:"Evening"},
  // ── SERVICE DEPT ──
  {id:44,name:"Ramesh (Captain)",role:"Captain",    section:"Service",        shift:"Morning"},
  {id:45,name:"Dinesh",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:46,name:"Mohan",           role:"Steward",    section:"Service",        shift:"Morning"},
  {id:47,name:"Suresh",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:48,name:"Vikram",          role:"Steward",    section:"Service",        shift:"Morning"},
  {id:49,name:"Pappu",           role:"Steward",    section:"Service",        shift:"Evening"},
  {id:50,name:"Ajay (Service)",  role:"Steward",    section:"Service",        shift:"Evening"},
  {id:51,name:"Rajan",           role:"Steward",    section:"Service",        shift:"Evening"},
  // ── CROCKERY DEPT ──
  {id:52,name:"Mukesh",          role:"Supervisor", section:"Crockery",       shift:"Morning"},
  {id:53,name:"Satish",          role:"Helper",     section:"Crockery",       shift:"Morning"},
  {id:54,name:"Bhola",           role:"Helper",     section:"Crockery",       shift:"Morning"},
  {id:55,name:"Kishan",          role:"Helper",     section:"Crockery",       shift:"Evening"},
  {id:56,name:"Ramu",            role:"Helper",     section:"Crockery",       shift:"Evening"},
  // ── TRANSPORTATION DEPT ──
  {id:57,name:"Harish (Driver)", role:"Driver",     section:"Transportation", shift:"Morning"},
  {id:58,name:"Kamal (Driver)",  role:"Driver",     section:"Transportation", shift:"Morning"},
  {id:59,name:"Sunil (Driver)",  role:"Driver",     section:"Transportation", shift:"Evening"},
  {id:60,name:"Prem (Loader)",   role:"Loader",     section:"Transportation", shift:"Morning"},
  {id:61,name:"Jitender (Loader)",role:"Loader",    section:"Transportation", shift:"Morning"},
  // ── ODC DEPT ──
  {id:62,name:"Akhtar",          role:"Equipment",  section:"ODC",            shift:"Morning"},
  {id:63,name:"Rajender Chef",   role:"Purchasing", section:"ODC",            shift:"Morning"},
  {id:64,name:"Sanjay (ODC)",    role:"Supervisor", section:"ODC",            shift:"Morning"},
  {id:65,name:"Bittu (ODC)",     role:"Helper",     section:"ODC",            shift:"Morning"},
  {id:66,name:"Rahul (ODC)",     role:"Helper",     section:"ODC",            shift:"Evening"},
];

// ─── EMPLOYEE DATABASE ───────────────────────────────────────────
// PIN is 4-digit. Role: admin | headchef | staff
// IDs: AM = Ambria Management, KIT = Kitchen
const EMPLOYEE_DB_INIT = [
  // ── ADMIN ──
  {staffListId:"AM001",staff_id:"AM001",name:"Abhi",section:"Management",dept:"management",role:"admin",pin:"0000",is_active:true,joining:"2025-01-01"},
  // ── GATE KIOSKS (one per venue) ──
  {staffListId:"GATE-AP",staff_id:"GATE-AP",name:"Gate — Ambria Pushpanjali",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Pushpanjali"},
  {staffListId:"GATE-AE",staff_id:"GATE-AE",name:"Gate — Ambria Exotica",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Exotica"},
  {staffListId:"GATE-MKT",staff_id:"GATE-MKT",name:"Gate — Manaktala Farm",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Manaktala Farm"},
  {staffListId:"GATE-RST",staff_id:"GATE-RST",name:"Gate — Ambria Restro",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Restro"},
  // ── HEAD CHEF ──
  {staffListId:"HC001",staff_id:"HC001",name:"Head Chef",section:"Management",dept:"kitchen",role:"head_chef",pin:"7777",is_active:true,joining:"2025-01-01"},
  // ── SECTION TABLETS (shared login per section — one per kitchen station) ──
  {staffListId:"TAB-IN",staff_id:"TAB-IN",name:"Indian Curries Tablet",section:"Indian Curries",dept:"kitchen",role:"section_indian",pin:"1001",is_active:true,joining:"2025-01-01"},
  {staffListId:"TAB-TD",staff_id:"TAB-TD",name:"Tandoor Tablet",section:"Tandoor",dept:"kitchen",role:"section_tandoor",pin:"1002",is_active:true,joining:"2025-01-01"},
  {staffListId:"TAB-CH",staff_id:"TAB-CH",name:"Chinese Tablet",section:"Chinese",dept:"kitchen",role:"section_chinese",pin:"1003",is_active:true,joining:"2025-01-01"},
  {staffListId:"TAB-CT",staff_id:"TAB-CT",name:"Chaat Tablet",section:"Chaat",dept:"kitchen",role:"section_chaat",pin:"1004",is_active:true,joining:"2025-01-01"},
  {staffListId:"TAB-SW",staff_id:"TAB-SW",name:"Sweets Tablet",section:"Sweets",dept:"kitchen",role:"section_sweets",pin:"1005",is_active:true,joining:"2025-01-01"},
  {staffListId:"TAB-CN",staff_id:"TAB-CN",name:"Continental Tablet",section:"Continental",dept:"kitchen",role:"section_continental",pin:"1006",is_active:true,joining:"2025-01-01"},
];
function getEmpByStaffId(empDb, staffListId) {
  const s = STAFF_LIST.find(x=>x.id===staffListId);
  if(!s) return null;
  return empDb.find(e=>e.name===s.name)||null;
}

function yrsOfService(joining) {
  const diff = new Date() - new Date(joining);
  const yrs = Math.floor(diff / (1000*60*60*24*365));
  const mos = Math.floor((diff % (1000*60*60*24*365)) / (1000*60*60*24*30));
  return yrs > 0 ? `${yrs}y ${mos}m` : `${mos} months`;
}

let GROOMING_CHECKS = [
  {id:"uniform",label:"Uniform clean & proper"},
  {id:"hair",   label:"Hair covered / groomed"},
  {id:"shave",  label:"Clean shaven / beard trimmed"},
  {id:"nails",  label:"Hands clean, nails trimmed"},
  {id:"shoes",  label:"Clean shoes / proper footwear"},
];

const VENUE_OPTIONS = ["Pushpanjali","Exotica","Manaktala","Restro"];

function hydrateStaffData(config) {
  if (config.groomingChecks && config.groomingChecks.length) {
    GROOMING_CHECKS = config.groomingChecks.map(c => ({
      id: c.item_key,
      label: c.label_en,
    }));
  }
}

export { STAFF_LIST, EMPLOYEE_DB_INIT, GROOMING_CHECKS, VENUE_OPTIONS, getEmpByStaffId, yrsOfService, hydrateStaffData };
