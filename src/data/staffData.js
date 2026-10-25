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

// ─── VENUE MASTER (Access Manager's "Manage Sections & Venues") ─────────
// Hydrated from Supabase `home_venues` table on boot. One list behind both
// VENUE_OPTIONS (staff "Home Venue" picker — short names, transport routing's
// fuzzy match) and EVENT_VENUES (the Edit Function/booking event-venue
// dropdowns — full names, e.g. "Ambria Pushpanjali"). These used to be
// separate hardcoded arrays per screen, which is exactly how "Ambria Restro"
// quietly went missing from the event-venue dropdown while every other list
// had it. HOME_VENUES keeps the full rows (id, name, fullName, code,
// isEventVenue, isStaffHome) for Access Manager's CRUD UI.
let HOME_VENUES = [];
const VENUE_OPTIONS = ["Pushpanjali","Exotica","Manaktala","Restro"];
const EVENT_VENUES = ["Ambria Pushpanjali","Ambria Exotica","Manaktala Farm","Ambria Restro","Outdoor Catering (ODC)"];

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
  if (config.homeVenues && config.homeVenues.length) {
    HOME_VENUES.length = 0;
    config.homeVenues.forEach(v => HOME_VENUES.push(v));
    VENUE_OPTIONS.length = 0;
    config.homeVenues.filter(v => v.isStaffHome).forEach(v => VENUE_OPTIONS.push(v.name));
    EVENT_VENUES.length = 0;
    config.homeVenues.filter(v => v.isEventVenue).forEach(v => EVENT_VENUES.push(v.fullName));
  }
}

export { STAFF_LIST, EMPLOYEE_DB_INIT, GROOMING_CHECKS, VENUE_OPTIONS, EVENT_VENUES, HOME_VENUES, getEmpByStaffId, yrsOfService, hydrateStaffData };
