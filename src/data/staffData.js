// Ambria FnB — Staff list, Employee DB seed, Grooming checks
// ALL STAFF DATA NOW LIVES IN SUPABASE — this file provides empty shells + helper functions

// ─── STAFF LIST ─────────────────────────────────────────────────
// Hydrated from Supabase `staff` table on boot via hydrateStaffData()
let STAFF_LIST = [];

// ─── EMPLOYEE DATABASE (login accounts) ─────────────────────────
// Hydrated from Supabase `staff` table on boot
// PINs, roles, venues all managed in Access Manager → Supabase
const EMPLOYEE_DB_INIT = [];

function getEmpByStaffId(empDb, staffListId) {
  const s = STAFF_LIST.find(x=>x.id===staffListId);
  if(!s) return null;
  return empDb.find(e=>e.name===s.name)||null;
}

function yrsOfService(joining) {
  if (!joining) return '—';
  const j = new Date(joining);
  if (isNaN(j.getTime())) return '—';
  const diff = new Date() - j;
  if (diff < 0) return '—';
  const yrs = Math.floor(diff / (1000*60*60*24*365));
  const mos = Math.floor((diff % (1000*60*60*24*365)) / (1000*60*60*24*30));
  return yrs > 0 ? `${yrs}y ${mos}m` : `${mos} months`;
}

// ─── GROOMING CHECKS ────────────────────────────────────────────
// Hydrated from Supabase `checklists` table on boot
let GROOMING_CHECKS = [];

const VENUE_OPTIONS = ["Pushpanjali","Exotica","Manaktala","Restro"];

function hydrateStaffData(config) {
  if (config.groomingChecks && config.groomingChecks.length) {
    GROOMING_CHECKS = config.groomingChecks.map(c => ({
      id: c.item_key,
      label: c.label_en,
    }));
  }
  // Hydrate STAFF_LIST from Supabase staff table
  if (config.staffList && config.staffList.length) {
    STAFF_LIST.length = 0;
    config.staffList.forEach(s => STAFF_LIST.push(s));
  }
}

export { STAFF_LIST, EMPLOYEE_DB_INIT, GROOMING_CHECKS, VENUE_OPTIONS, getEmpByStaffId, yrsOfService, hydrateStaffData };
