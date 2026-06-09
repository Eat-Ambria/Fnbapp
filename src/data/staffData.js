// Ambria FnB — Staff list, Employee DB seed, Grooming checks
// Extracted from App.jsx

const STAFF_LIST = [
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
  {staffListId:"AM001",staff_id:"AM001",name:"Abhi",section:"Management",dept:"management",role:"admin",pin:"0000",is_active:true,joining:"2025-01-01"},
  {staffListId:"GATE-AP",staff_id:"GATE-AP",name:"Gate — Ambria Pushpanjali",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Pushpanjali"},
  {staffListId:"GATE-AE",staff_id:"GATE-AE",name:"Gate — Ambria Exotica",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Exotica"},
  {staffListId:"GATE-MKT",staff_id:"GATE-MKT",name:"Gate — Manaktala Farm",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Manaktala Farm"},
  {staffListId:"GATE-RST",staff_id:"GATE-RST",name:"Gate — Ambria Restro",section:"Gate",dept:"gate",role:"kiosk_gate",pin:"9999",is_active:true,joining:"2025-01-01",venue:"Ambria Restro"},
  {staffListId:"SW001",staff_id:"SW001",name:"Rajinder Singh Halwai",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW002",staff_id:"SW002",name:"Ramu Halwai",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW003",staff_id:"SW003",name:"Yogesh Halwai",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW004",staff_id:"SW004",name:"Anil Kumar Halwai",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW005",staff_id:"SW005",name:"Bacchan Singh",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW006",staff_id:"SW006",name:"Radheyshayam",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW007",staff_id:"SW007",name:"Abhishek",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW008",staff_id:"SW008",name:"Saurabh",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW009",staff_id:"SW009",name:"Deepu Hawai New",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"SW010",staff_id:"SW010",name:"Vrindavan",section:"Sweets",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT001",staff_id:"CT001",name:"Raghvendra Singh",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT002",staff_id:"CT002",name:"Satendra Chaat",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT003",staff_id:"CT003",name:"Purshottam",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT004",staff_id:"CT004",name:"Anurag Chaat",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT005",staff_id:"CT005",name:"Ajay",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT006",staff_id:"CT006",name:"Sahdev",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT007",staff_id:"CT007",name:"Balram",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT008",staff_id:"CT008",name:"Golu",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CT009",staff_id:"CT009",name:"Kuldeep",section:"Chaat",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CH001",staff_id:"CH001",name:"Kishore Chef",section:"Chinese",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CH002",staff_id:"CH002",name:"Lokesh",section:"Chinese",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CH003",staff_id:"CH003",name:"Sandeep Chef Helper",section:"Chinese",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CH004",staff_id:"CH004",name:"Vishesh",section:"Chinese",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD001",staff_id:"TD001",name:"Yatinder",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD002",staff_id:"TD002",name:"Gopal",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD003",staff_id:"TD003",name:"Vipin Kumar Tandoor",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD004",staff_id:"TD004",name:"Yatinder Rawat",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD005",staff_id:"TD005",name:"Noor Alam Tandoor",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD006",staff_id:"TD006",name:"Kushal Pal",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD007",staff_id:"TD007",name:"Surendra",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"TD008",staff_id:"TD008",name:"Prabhat",section:"Tandoor",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CN001",staff_id:"CN001",name:"Rahul",section:"Continental",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"CN002",staff_id:"CN002",name:"Kareen",section:"Continental",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN001",staff_id:"IN001",name:"Devendra",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN002",staff_id:"IN002",name:"Bhupal",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN003",staff_id:"IN003",name:"Jeetu Indian",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN004",staff_id:"IN004",name:"Roshan",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN005",staff_id:"IN005",name:"Hina",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"IN006",staff_id:"IN006",name:"Anas Khan",section:"Indian Curries",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"BK001",staff_id:"BK001",name:"Shobhan Singh",section:"Bakery",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  {staffListId:"BK002",staff_id:"BK002",name:"Disha",section:"Bakery",dept:"kitchen",role:"staff",pin:"1111",is_active:true,joining:"2025-01-01"},
  // ── HEAD CHEF (Yatender & Gopal shared login) ──
  {staffListId:"HC001",staff_id:"HC001",name:"Yatender / Gopal",section:"Management",dept:"kitchen",role:"head_chef",pin:"7777",is_active:true,joining:"2025-01-01"},
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

const GROOMING_CHECKS = [
  {id:"uniform",label:"Uniform clean & proper"},
  {id:"hair",   label:"Hair covered / groomed"},
  {id:"shave",  label:"Clean shaven / beard trimmed"},
  {id:"nails",  label:"Hands clean, nails trimmed"},
  {id:"shoes",  label:"Clean shoes / proper footwear"},
];

export { STAFF_LIST, EMPLOYEE_DB_INIT, GROOMING_CHECKS, getEmpByStaffId, yrsOfService };
