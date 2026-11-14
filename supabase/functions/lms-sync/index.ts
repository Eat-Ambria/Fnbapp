// ══════════════════════════════════════════════════════════════════
// AMBRIA FnB — LMS Sync Edge Function
// File: supabase/functions/lms-sync/index.ts
//
// Deploy: supabase functions deploy lms-sync
// Call:   supabase.functions.invoke('lms-sync', { body: { triggered_by: 'AM001' } })
//
// What it does:
//   1. Reads config (lms_user_id, sync window) from app_config
//   2. Fetches master data (venues, menus, functions) — caches in lms_masters
//   3. Paginates through venue + catering contract APIs
//   4. Transforms each contract detail row into an FnB event
//   5. Upserts to events table (preserving manual events)
//   6. Logs the sync run to lms_sync_log
// ══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LMS_BASE = "https://gyv.inqcrm.in";
const PAGE_SIZE = 10; // LMS returns 10 per page
// 2026-11-14: was 50 (500 rows) -- venue contract volume has sat at 522-525
// rows for at least the last two weeks (lms_sync_log.venue_count), meaning
// EVERY sync since then silently dropped everything past row 500 with zero
// indication anything was wrong. Worse: the "clean up cancelled/removed LMS
// events" pass below deletes any previously-synced event that didn't come
// back in this run's fetch -- so a contract that happened to sort past the
// cutoff wasn't just missing from the app, it got its events/event_items/
// event_function_plans rows permanently hard-deleted (ON DELETE CASCADE,
// no tombstone) as a false "cancelled in LMS" the very next sync. Confirmed
// against a real incident: a finalized, sent-to-kitchen FP was wiped this
// way. 500 rows of headroom here is cheap; silently truncating a sync that
// feeds a delete pass is not.
const MAX_PAGES = 500; // safety cap (5000 rows) -- see note above

// Strip financial fields from LMS raw data before storing
function stripFinancials(row: any): any {
  if (!row || typeof row !== "object") return row;
  const stripped = { ...row };
  const FINANCIAL_KEYS = [
    "fisc_total_amt", "fisc_cash_part", "fisc_cheque",
    "fisc_tax_c_amt", "fisc_tax_d_amt", "fisc_tax_percent_c",
    "fisc_tax_percent_d", "fisc_tax_amt", "fisc_net_amt",
    "fisc_advance_cash", "fisc_advance_chq", "fisc_balance",
    "fisc_factor_0", "fisc_gst_no", "fisc_billing_name",
    "fisc_billing_address",
    "chc_total_amt", "chc_net_amt", "chc_balance",
    "chc_advance_cash", "chc_advance_chq",
  ];
  for (const key of FINANCIAL_KEYS) delete stripped[key];
  return stripped;
}

// ── Supabase client (uses service role for full access) ──
function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

// ── Date helpers ──
function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const LMS_MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
// LMS's function-date fields (fiscd_function_date / chcd_date) don't come back
// as clean "YYYY-MM-DD" — seen both as a SQL-style "YYYY-MM-DD HH:mm:ss"
// datetime and as "17-Oct-2025". events.date was being stored exactly as LMS
// sent it, which the Dashboard's safeEvs filter (requires a 10-char ISO
// string) silently drops while BookedFunctionsView's own looser date parser
// still shows them — the same events "missing" on the Dashboard but present
// in Booked Functions. Normalize to YYYY-MM-DD here so every consumer gets
// the same canonical shape; "" (same as empty input) makes the caller skip
// the row, same as before this existed.
function normalizeLmsDate(raw: string): string {
  if (!raw) return "";
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/.exec(s);
  if (m) {
    const mi = LMS_MONTH_MAP[m[2].slice(0, 3).toLowerCase()];
    if (mi != null) return fmtDate(new Date(+m[3], mi, +m[1]));
  }
  m = /^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/.exec(s);
  if (m) return fmtDate(new Date(+m[3], +m[2] - 1, +m[1]));
  const t = Date.parse(s);
  if (!isNaN(t)) return fmtDate(new Date(t));
  return "";
}

// ── LMS API caller ──
async function lmsPost(endpoint: string, body: Record<string, string>): Promise<any> {
  const url = `${LMS_BASE}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LMS ${endpoint} returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ── Paginated fetch ──
// truncated=true means the loop exhausted MAX_PAGES while the LAST page
// fetched was still full (PAGE_SIZE rows) -- i.e. there was more data this
// run never saw, as opposed to legitimately running out of pages. Callers
// must treat this as a reason NOT to trust "missing from this fetch" as
// "cancelled in LMS" (see the cleanup pass below) -- see MAX_PAGES's own
// comment for the incident this caused.
async function fetchAllPages(
  endpoint: string,
  baseBody: Record<string, string>,
  responseKey: string
): Promise<{ rows: any[]; truncated: boolean }> {
  const all: any[] = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = { ...baseBody, page_limit: String(page) };
    const json = await lmsPost(endpoint, body);
    const rows = json[responseKey] || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break; // last page
    if (page === MAX_PAGES) truncated = true;
  }
  return { rows: all, truncated };
}

// ── Master data: fetch + cache ──
async function getMasters(sb: any, userId: string): Promise<{
  venues: Record<string, string>;
  menus: Record<string, string>;
  functions: Record<string, string>;
}> {
  // Check cache age (refresh if older than 24h)
  const { data: cached } = await sb
    .from("lms_masters")
    .select("key, data, fetched_at")
    .in("key", ["venues", "menus", "functions"]);

  const cacheMap: Record<string, any> = {};
  const stale = new Date(Date.now() - 24 * 60 * 60 * 1000);
  (cached || []).forEach((r: any) => {
    if (new Date(r.fetched_at) > stale) cacheMap[r.key] = r.data;
  });

  // Venues
  let venues: Record<string, string> = cacheMap.venues || {};
  if (!cacheMap.venues) {
    try {
      const json = await lmsPost("/api/v1/createcommon_api/get_venue_list", { lead_type: "I" });
      const list = json.venueData || json.data || json || [];
      venues = {};
      (Array.isArray(list) ? list : []).forEach((v: any) => {
        if (v.id && v.name) venues[String(v.id)] = v.name;
        if (v.venue_id && v.venue_name) venues[String(v.venue_id)] = v.venue_name;
      });
      await sb.from("lms_masters").upsert({ key: "venues", data: venues, fetched_at: new Date().toISOString() });
    } catch (e) {
      console.error("Failed to fetch venues:", e);
    }
  }

  // Menus
  let menus: Record<string, string> = cacheMap.menus || {};
  if (!cacheMap.menus) {
    try {
      const json = await lmsPost("/api/v1/createcommon_api/get_catering_list", { filterbyid: "" });
      const list = json.cateringData || json.data || json || [];
      menus = {};
      (Array.isArray(list) ? list : []).forEach((m: any) => {
        if (m.id && m.name) menus[String(m.id)] = m.name;
        if (m.menu_id && m.menu_name) menus[String(m.menu_id)] = m.menu_name;
      });
      await sb.from("lms_masters").upsert({ key: "menus", data: menus, fetched_at: new Date().toISOString() });
    } catch (e) {
      console.error("Failed to fetch menus:", e);
    }
  }

  // Function types
  let functions: Record<string, string> = cacheMap.functions || {};
  if (!cacheMap.functions) {
    try {
      const json = await lmsPost("/api/v1/createcommon_api/get_function_detail", { functype: "" });
      const list = json.functionData || json.data || json || [];
      functions = {};
      (Array.isArray(list) ? list : []).forEach((f: any) => {
        if (f.id && f.name) functions[String(f.id)] = f.name;
        if (f.func_id && f.func_name) functions[String(f.func_id)] = f.func_name;
      });
      await sb.from("lms_masters").upsert({ key: "functions", data: functions, fetched_at: new Date().toISOString() });
    } catch (e) {
      console.error("Failed to fetch functions:", e);
    }
  }

  return { venues, menus, functions };
}

// ── Venue name normalization (LMS → FnB) ──
function normalizeVenue(lmsVenue: string): string {
  const v = (lmsVenue || "").toLowerCase();
  if (v.includes("pushpanjali") || v.includes("push")) return "Ambria Pushpanjali";
  if (v.includes("exotica") || v.includes("exo")) return "Ambria Exotica";
  if (v.includes("manaktala") || v.includes("mkt") || v.includes("banana")) return "Manaktala Farm";
  if (v.includes("restro") || v.includes("rst")) return "Ambria Restro";
  return lmsVenue || "Unknown Venue";
}

// ── Menu package → dish list mapping ──
// The FnB app resolves menu_package to a dish array via MENU_PACKAGES
// We store the menuname string; the app does the lookup client-side
function resolveMenuName(menuId: string, menuname: string, menus: Record<string, string>): string {
  // Prefer the resolved name from LMS response
  if (menuname && menuname.trim()) return menuname.trim();
  // Fall back to master lookup
  if (menuId && menus[menuId]) return menus[menuId];
  return "";
}

// ── Transform: Venue Contract → FnB Events ──
function transformVenueContract(row: any, masters: any): any[] {
  const events: any[] = [];
  const contractNo = row.fisc_entryno || "";
  const guestName = row.fisc_guest_name || "Unknown";
  const status = row.fisc_status || "";
  const balance = parseFloat(row.fisc_balance) || 0;
  const cancelled = !!(row.fisc_cancel_remarks && row.fisc_cancel_remarks.trim());

  if (cancelled) return [];

  // The API flattens header + detail into one row per function date
  const funcDate = normalizeLmsDate(row.fiscd_function_date || "");
  if (!funcDate) return []; // skip placeholder entries

  const venueName = row.venue1 || normalizeVenue(row.fisc_location || "");
  const funcName = row.functionname || masters.functions[row.fiscd_function_type] || "Function";
  const menuName = resolveMenuName(row.fiscd_menu, row.menuname || "", masters.menus);
  const pax = parseInt(row.fiscd_pax_no) || 0;
  const time = row.fiscd_function_timings || "";
  const session = row.fiscd_session || "";

  // Base event ID: V-{contract}-{date}. A contract with more than one function
  // on the SAME date (e.g. Haldi + Wedding both 19-Sep) used to collide here —
  // this id has no function identity, so the second transformed row silently
  // overwrote the first in the dedup Map below, and only one of the two ever
  // reached the events table. The main handler disambiguates any id shared by
  // more than one row (using each row's own LMS detail id, see _lmsDetailId)
  // AFTER all rows are transformed, since a single row has no visibility into
  // its siblings — so this stays the base id every single-function contract
  // (the overwhelming majority) keeps using, unchanged.
  const eventId = `LMS-V-${contractNo}-${funcDate}`;

  // Determine veg/nonveg split from menu name
  const isNonVeg = /non.?veg/i.test(menuName);

  events.push({
    id: eventId,
    guest: guestName,
    venue: normalizeVenue(venueName),
    date: funcDate,
    time: time || (session === "Lunch" ? "12:00" : session === "Sundowner" ? "16:00" : "19:00"),
    type: funcName,
    pax: pax,
    veg: isNonVeg ? 0 : pax,
    nonveg: isNonVeg ? pax : 0,
    menu_package: menuName,
    lms_menu_package: menuName,  // last-reported-by-LMS snapshot, see preserve check below
    menu: [],  // resolved client-side from menu_package via MENU_PACKAGES
    special: null,
    extras: [],
    lms_contract: contractNo,
    lms_source: "venue",
    lms_status: status,
    lms_synced_at: new Date().toISOString(),
    lms_raw: stripFinancials(row),
    _lmsDetailId: row.id != null ? String(row.id) : null,
  });

  return events;
}

// ── Transform: Catering Contract → FnB Events ──
function transformCateringContract(row: any, masters: any): any[] {
  const events: any[] = [];
  const contractNo = row.chc_entry_no || "";
  const guestName = row.chc_guest_name || "Unknown";
  const balance = parseFloat(row.chc_balance) || 0;
  const cancelled = !!(row.chc_cancel_remarks && row.chc_cancel_remarks.trim());

  if (cancelled) return [];

  const funcDate = normalizeLmsDate(row.chcd_date || "");
  if (!funcDate) return [];

  const isOutdoor = (row.chcd_lead_type || "").toUpperCase() === "O";
  const odcLocation = row.chcd_venue2 || row.chc_location || "";
  const odcAddress = row.chcd_address2 || "";
  const odcContactPhone = row.chc_contact_no || "";
  const odcTransportCost = parseFloat(row.chcd_transport_cost) || 0;
  const funcName = row.functionname || masters.functions[row.chcd_function] || "Function";
  const menuName = resolveMenuName(row.chcd_menu, row.menuname || "", masters.menus);
  const pax = parseInt(row.chcd_pax) || 0;
  const time = row.chcd_time || "";
  const session = row.chcd_session || "";
  const catering = row.chcd_catering || "";

  // ODC events always get venue = "Outdoor Catering (ODC)"
  // In-house catering contracts use normalizeVenue to match the venue name
  const venue = isOutdoor ? "Outdoor Catering (ODC)" : normalizeVenue(odcLocation || "Unknown Venue");

  const eventId = `LMS-C-${contractNo}-${funcDate}`;
  const isNonVeg = /non.?veg/i.test(catering) || /non.?veg/i.test(menuName);

  events.push({
    id: eventId,
    guest: guestName,
    venue: venue,
    date: funcDate,
    time: time || (session === "Lunch" ? "12:00" : session === "Sundowner" ? "16:00" : "19:00"),
    type: funcName,
    pax: pax,
    veg: isNonVeg ? 0 : pax,
    nonveg: isNonVeg ? pax : 0,
    menu_package: menuName,
    lms_menu_package: menuName,  // last-reported-by-LMS snapshot, see preserve check below
    menu: [],
    special: null,
    extras: [],
    lms_contract: contractNo,
    lms_source: "catering",
    lms_status: null,
    lms_synced_at: new Date().toISOString(),
    lms_raw: stripFinancials(row),
    // ODC-specific fields (null for in-house catering)
    ...(isOutdoor ? {
      odc_location: odcLocation || null,
      odc_address: odcAddress || null,
      odc_contact_phone: odcContactPhone || null,
      odc_transport_cost: odcTransportCost || null,
      odc_lead: "Gopal",
      site_recce: "Not done",
      odc_menu_confirmed: false,
    } : {}),
    _lmsDetailId: row.id != null ? String(row.id) : null,
  });

  return events;
}

// ── Tables keyed by event id — kept in sync when an event is renamed ──
// (see migrateEventId below). Two tables are handled separately, not through
// this generic loop:
//   - transport_dispatch_assignments: its own primary key embeds the event
//     id (`${event_id}::${vehicle_id}`), so a plain column update would
//     leave a stale/mismatched id.
//   - kitchen_tracking: dish_key embeds the event id too (`${ev_id}|${dish}`,
//     see dk() in EventDayTab.jsx/KitchenHub.jsx) — a plain update of just
//     the ev_id column left every row's dish_key still pointing at the OLD
//     id, so every lookup (which composes dk(newId, dish) to find a row)
//     missed, making all of that function's kitchen tracking look reset
//     even though the rows technically still existed under the stale key.
const EVENT_CHILD_TABLES: Array<[string, string]> = [
  ["event_items", "event_id"],
  ["event_function_plans", "event_id"],
  ["event_configs", "event_id"],
  ["event_fruit_selections", "event_id"],
  ["production_plans", "event_id"],
  ["production_closings", "event_id"],
  ["store_issues", "event_id"],
  ["store_issue_assignments", "event_id"],
  ["ingredient_usage_log", "event_id"],
  ["dept_checks", "event_id"],
  ["odc_checklists", "ev_id"],
  ["transport_queue", "ev_id"],
  ["notifications", "event_id"],
];

// ── Rename an event id in place, carrying all of its work over ──
// 2026-10-29: contract 00785's Exotica function had its LMS-reported date
// corrupted by an LMS UI bug (2026-11-15 -> 0202-11-15) while the user was
// editing an unrelated field (complimentary plate count). Since our event
// id is built from that date (LMS-V-{contract}-{date}), the old id vanished
// from the next sync's feed and the code below ("clean up cancelled")
// couldn't tell that apart from "this function was actually removed" — it
// hard-deleted the old row, taking its event_items and (to-be-built)
// Function Plan with it, with zero way to recover them afterward.
// This function is the fix: when the caller has already matched an old row
// to a specific new id (see the 1:1-swap detection below), move every
// table that references the old id onto the new one, carry over the old
// row's own customization fields (the new row was just inserted fresh from
// LMS — blank menu, no flags), and only then remove the old row.
async function migrateEventId(sb: any, oldRow: any, newId: string): Promise<void> {
  const { data: newRow } = await sb.from("events").select("id").eq("id", newId).maybeSingle();
  if (!newRow) {
    console.error(`migrateEventId: target ${newId} does not exist yet, skipping migration for ${oldRow.id}`);
    return;
  }

  for (const [table, col] of EVENT_CHILD_TABLES) {
    const { error } = await sb.from(table).update({ [col]: newId }).eq(col, oldRow.id);
    if (error) console.error(`migrateEventId: ${table}.${col} ${oldRow.id} -> ${newId} failed:`, error);
  }

  // kitchen_tracking: rewrite dish_key's embedded event-id prefix alongside
  // ev_id itself, for both the current dk() format (`${evId}|${dish}`) and
  // the older dkLegacy format (`${evId}|${idx}`) — both share the exact same
  // `${oldId}|` prefix, so one string-prefix swap covers either. Meta rows
  // (`__sec_<catId>`, `__dispatch_ready`, ...) have no event id baked into
  // dish_key at all and pass through unchanged. Paginated since a single
  // function can accumulate thousands of tracking rows over a long shift.
  {
    const ktPrefix = `${oldRow.id}|`;
    let ktFrom = 0;
    const ktPage = 1000;
    let ktOk = true;
    while (true) {
      const { data: ktRows, error: ktSelErr } = await sb
        .from("kitchen_tracking").select("*").eq("ev_id", oldRow.id).range(ktFrom, ktFrom + ktPage - 1);
      if (ktSelErr) { console.error(`migrateEventId: kitchen_tracking select ${oldRow.id} failed:`, ktSelErr); ktOk = false; break; }
      if (!ktRows || ktRows.length === 0) break;
      const renamed = ktRows.map((r: any) => ({
        ...r,
        ev_id: newId,
        dish_key: typeof r.dish_key === "string" && r.dish_key.startsWith(ktPrefix)
          ? newId + r.dish_key.slice(oldRow.id.length)
          : r.dish_key,
        // Without this, the copied row keeps the ORIGINAL writer's client_id
        // — the realtime INSERT echo for the new id then hits that same
        // tablet's own "skip my own echo" check in App.jsx, while the
        // DELETE echo for the old id clears its local state for the old
        // key. That tablet shows these dishes as un-ticked until it
        // reloads, even though the server's copy under the new id is
        // correct. Nulling it means the echo is treated as foreign (merged
        // normally) on every tablet, including the one that originally
        // wrote it.
        client_id: null,
      }));
      const { error: ktUpErr } = await sb.from("kitchen_tracking").upsert(renamed, { onConflict: "ev_id,dish_key" });
      if (ktUpErr) { console.error(`migrateEventId: kitchen_tracking upsert ${oldRow.id} -> ${newId} failed:`, ktUpErr); ktOk = false; break; }
      if (ktRows.length < ktPage) break;
      ktFrom += ktPage;
    }
    // Only clean up the old rows once EVERY page copied across successfully —
    // deleting unconditionally here would, on a mid-pagination failure, wipe
    // old-id rows that were never actually migrated to newId, which is
    // exactly the data loss this function exists to prevent.
    if (ktOk) {
      const { error: ktDelErr } = await sb.from("kitchen_tracking").delete().eq("ev_id", oldRow.id);
      if (ktDelErr) console.error(`migrateEventId: kitchen_tracking cleanup ${oldRow.id} failed:`, ktDelErr);
    } else {
      console.error(`migrateEventId: kitchen_tracking migration incomplete for ${oldRow.id} -> ${newId}, leaving old rows in place for retry`);
    }
  }

  // dept_checks: beverages/fruits rows key item_key as `bev_${evId}_${idx}` /
  // `fruit_${evId}_${idx}` (see DeptView.jsx's persistCheck call sites) —
  // the generic EVENT_CHILD_TABLES rewrite above only updates the event_id
  // column, leaving item_key still carrying the OLD event id baked in. The
  // loader reads these back flat by item_key, so a renamed event's
  // Beverages/Fruits ticks look reset — the exact same bug class the
  // kitchen_tracking dish_key fix above exists for. service/crockery/
  // transport_load/odc rows are unaffected: their item_key never embeds an
  // event id.
  {
    const bevPrefix = `bev_${oldRow.id}_`;
    const fruitPrefix = `fruit_${oldRow.id}_`;
    const { data: dcRows, error: dcSelErr } = await sb
      .from("dept_checks").select("event_id,dept,item_key").eq("event_id", newId).in("dept", ["beverages", "fruits"]);
    if (dcSelErr) {
      console.error(`migrateEventId: dept_checks select ${newId} failed:`, dcSelErr);
    } else {
      for (const r of dcRows || []) {
        const isBev = typeof r.item_key === "string" && r.item_key.startsWith(bevPrefix);
        const isFruit = !isBev && typeof r.item_key === "string" && r.item_key.startsWith(fruitPrefix);
        if (!isBev && !isFruit) continue;
        const suffix = r.item_key.slice((isBev ? bevPrefix : fruitPrefix).length);
        const newItemKey = (isBev ? "bev_" : "fruit_") + newId + "_" + suffix;
        const { error: dcUpErr } = await sb.from("dept_checks")
          .update({ item_key: newItemKey })
          .eq("event_id", newId).eq("dept", r.dept).eq("item_key", r.item_key);
        if (dcUpErr) console.error(`migrateEventId: dept_checks item_key rewrite ${r.item_key} -> ${newItemKey} failed:`, dcUpErr);
      }
    }
  }

  const { data: tdRows } = await sb.from("transport_dispatch_assignments").select("*").eq("event_id", oldRow.id);
  if (tdRows && tdRows.length > 0) {
    const renamed = tdRows.map((r: any) => {
      const sep = typeof r.id === "string" ? r.id.indexOf("::") : -1;
      const vehiclePart = sep >= 0 ? r.id.slice(sep + 2) : r.id;
      const { id, event_id, ...rest } = r;
      return { ...rest, id: `${newId}::${vehiclePart}`, event_id: newId };
    });
    const { error: insErr } = await sb.from("transport_dispatch_assignments").upsert(renamed);
    if (insErr) console.error(`migrateEventId: transport_dispatch_assignments insert ${oldRow.id} -> ${newId} failed:`, insErr);
    else {
      const { error: delErr } = await sb.from("transport_dispatch_assignments").delete().eq("event_id", oldRow.id);
      if (delErr) console.error(`migrateEventId: transport_dispatch_assignments cleanup ${oldRow.id} failed:`, delErr);
    }
  }

  // Carry the old row's own "work already done" fields onto the new row —
  // event_items alone isn't the whole story (menu_package overrides, ODC
  // details, outsourced dishes, section overrides all live on the events
  // row itself).
  const carryOver: Record<string, any> = {};
  const CARRY_FIELDS = [
    "menu", "custom_menu_confirmed", "event_items_initialized",
    "menu_section_overrides", "outsourced_dishes",
    "external_caterer", "external_caterer_name",
    "odc_location", "odc_address", "odc_contact_phone", "odc_transport_cost",
    "odc_lead", "site_recce", "odc_menu_confirmed",
  ];
  CARRY_FIELDS.forEach((f) => {
    if (oldRow[f] !== undefined && oldRow[f] !== null) carryOver[f] = oldRow[f];
  });
  // Only carry the package name forward if it had actually been picked
  // away from what LMS last told us for the OLD id — otherwise let the new
  // row keep whatever the (possibly just-corrected) current sync gave it.
  if (oldRow.menu_package && oldRow.lms_menu_package && oldRow.menu_package !== oldRow.lms_menu_package) {
    carryOver.menu_package = oldRow.menu_package;
  }
  if (Object.keys(carryOver).length > 0) {
    const { error } = await sb.from("events").update(carryOver).eq("id", newId);
    if (error) console.error(`migrateEventId: carry-over update ${newId} failed:`, error);
  }

  // The old row is fully drained now — delete it immediately rather than
  // leaving it for the "clean up cancelled" pass below, which would delete
  // it anyway but without this context (and without having saved anything
  // off it first).
  const { error: delErr } = await sb.from("events").delete().eq("id", oldRow.id);
  if (delErr) console.error(`migrateEventId: delete old row ${oldRow.id} failed:`, delErr);
}

// ══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = getSupabase();
  let logId: string | null = null;

  try {
    // Parse request
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const triggeredBy = body.triggered_by || "system";

    // V83: the app auto-triggers this on every boot, gated only by a
    // client-side localStorage cooldown — a fresh incognito window (no
    // localStorage history) or simply a different staff member's device
    // bypasses that entirely, so several syncs could otherwise run back to
    // back or concurrently, each one a fresh chance to race a live Build
    // Menu edit. A short server-side cooldown, checked here regardless of
    // which browser/device triggered it, caps how often this whole class of
    // race can even occur. Manual "Sync now" clicks still go through the
    // same 2-minute gate — repeated impatient clicking shouldn't stack syncs.
    const { data: lastRun } = await sb
      .from("lms_sync_log")
      .select("started_at")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun?.started_at && Date.now() - new Date(lastRun.started_at).getTime() < 2 * 60 * 1000) {
      return new Response(JSON.stringify({ status: "skipped", message: "Synced less than 2 minutes ago" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create sync log entry
    const { data: logRow } = await sb
      .from("lms_sync_log")
      .insert({ triggered_by: triggeredBy, status: "running" })
      .select("id")
      .single();
    logId = logRow?.id || null;

    // Load config
    const { data: configRows } = await sb.from("app_config").select("key, value");
    const config: Record<string, string> = {};
    (configRows || []).forEach((r: any) => { config[r.key] = r.value; });

    const userId = config.lms_user_id || "1";
    const daysBack = parseInt(config.lms_sync_days_back) || 7;
    const daysForward = parseInt(config.lms_sync_days_forward) || 45;

    const now = new Date();
    const fromDate = fmtDate(addDays(now, -daysBack));
    const uptoDate = fmtDate(addDays(now, daysForward));

    console.log(`LMS Sync: ${fromDate} → ${uptoDate}, user=${userId}, triggered by ${triggeredBy}`);

    // Fetch master data
    const masters = await getMasters(sb, userId);
    console.log(`Masters: ${Object.keys(masters.venues).length} venues, ${Object.keys(masters.menus).length} menus, ${Object.keys(masters.functions).length} functions`);

    // ── Fetch Venue Contracts ──
    const { rows: venueRows, truncated: venueTruncated } = await fetchAllPages(
      "/api/v1/processerp_api/get_venue_contract_information_list",
      { loggeduserid: userId, fromdate: fromDate, uptodated: uptoDate, venue_datetype: "function_date" },
      "Contractinfo"
    );
    console.log(`Venue contracts fetched: ${venueRows.length} rows${venueTruncated ? " (TRUNCATED -- hit MAX_PAGES)" : ""}`);

    // ── Fetch Catering Contracts ──
    const { rows: cateringRows, truncated: cateringTruncated } = await fetchAllPages(
      "/api/v1/processerp_api/get_catering_contract_information_list",
      { loggeduserid: userId, fromdate: fromDate, uptodated: uptoDate, cater_datetype: "function_date" },
      "Contractinfo"
    );
    console.log(`Catering contracts fetched: ${cateringRows.length} rows${cateringTruncated ? " (TRUNCATED -- hit MAX_PAGES)" : ""}`);
    const fetchTruncated = venueTruncated || cateringTruncated;

    // ── Transform all rows to FnB events ──
    const allEvents: any[] = [];
    let skipped = 0;

    for (const row of venueRows) {
      const evs = transformVenueContract(row, masters);
      if (evs.length === 0) skipped++;
      allEvents.push(...evs);
    }
    for (const row of cateringRows) {
      const evs = transformCateringContract(row, masters);
      if (evs.length === 0) skipped++;
      allEvents.push(...evs);
    }

    // ── Disambiguate multi-function-same-date contracts ──
    // A contract with two functions on the same date (Haldi 08:30 + Wedding
    // 18:00, both 19-Sep) produces the same base id (LMS-V-{contract}-{date})
    // for both, since that id carries no function identity — so the dedup Map
    // right below used to keep only whichever one was transformed last,
    // silently dropping the other from the app entirely. Group by base id
    // FIRST: a group of one (the vast majority of contracts) keeps its plain
    // id exactly as before; a group of more than one gets each member's id
    // suffixed with that row's own LMS detail id (a real per-function primary
    // key from the source system, so it's guaranteed stable and unique) —
    // falling back to a slugified function name only if LMS ever omits it.
    const byBaseId = new Map<string, any[]>();
    for (const ev of allEvents) {
      const list = byBaseId.get(ev.id);
      if (list) list.push(ev); else byBaseId.set(ev.id, [ev]);
    }
    const disambiguated: any[] = [];
    for (const [baseId, group] of byBaseId) {
      if (group.length === 1) { disambiguated.push(group[0]); continue; }
      for (const ev of group) {
        const suffix = ev._lmsDetailId || String(ev.type || "fn").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        ev.id = `${baseId}-${suffix}`;
        disambiguated.push(ev);
      }
    }
    disambiguated.forEach((ev) => { delete ev._lmsDetailId; });

    // Dedup by event ID (same contract+date could appear on multiple pages)
    const deduped = new Map<string, any>();
    disambiguated.forEach((ev) => { deduped.set(ev.id, ev); });

    // V72 soft-delete: fetch tombstones and exclude them from the upsert so
    // user-deleted events don't resurrect on the next LMS sync.
    const { data: tombstones } = await sb
      .from("events")
      .select("id")
      .eq("is_deleted", true);
    const deletedIds = new Set<string>((tombstones || []).map((r: any) => r.id));
    console.log(`Tombstones to skip: ${deletedIds.size}`);

    const finalEvents = Array.from(deduped.values()).filter((ev) => !deletedIds.has(ev.id));

    console.log(`Events to upsert: ${finalEvents.length} (skipped: ${skipped}, tombstoned: ${deduped.size - finalEvents.length})`);

    // ── Upsert in batches of 50, never clobbering an admin-customized menu ──
    // V83: the previous fix still had a real gap — it read a row's current
    // menu/menu_package, decided "customized, preserve it", then WROTE THAT
    // SAME SNAPSHOT BACK as part of the batch upsert. If a Build Menu edit
    // landed in the gap between that read and this write (very plausible:
    // this sync runs on every app boot, independently per browser/device,
    // gated only by a client-side localStorage cooldown that a fresh
    // incognito window always bypasses), the upsert would overwrite the
    // user's newer edit with the slightly-stale snapshot this function had
    // just read — a race either way, just narrower.
    // Fix: for a row already flagged customized, don't touch menu/menu_package
    // at all — literally omit those two keys from that row's write, via a
    // separate per-row UPDATE, so whatever is in the DB right now (even if it
    // changed after our read) is left completely alone. Only rows that are
    // brand-new or were never customized go through the bulk upsert with the
    // full LMS payload.
    let upserted = 0;
    let preservedCount = 0;
    for (let i = 0; i < finalEvents.length; i += 50) {
      const batch = finalEvents.slice(i, i + 50);
      const batchIds = batch.map(e => e.id);
      const { data: existing, error: exErr } = await sb
        .from("events")
        .select("id, menu, menu_package, custom_menu_confirmed, lms_menu_package")
        .in("id", batchIds);
      if (exErr) console.error(`Preserve fetch batch ${i} error:`, exErr);
      const customizedIds = new Set<string>();
      (existing || []).forEach((ex: any) => {
        // V84: a row an admin has explicitly confirmed (KitchenHub's "Mark
        // menu as built", sets custom_menu_confirmed=true) must stay
        // protected forever, independent of what menu/menu_package happen
        // to look like right now — the old heuristic below only inferred
        // "customized" from menu_package being null/"" AND menu being
        // non-empty, so a confirmed row with a still-empty menu (admin
        // confirmed before finishing in Menu Editor, or menu_package was
        // stamped "Custom"/"(Custom)" instead of "") fell through the gate
        // on the very next sync: menu got reset to [] and, since nothing
        // ever re-sets custom_menu_confirmed once it's true, the row LOOKED
        // untouched but was actually blank again — exactly the "I confirmed
        // this and it came back unconfirmed" report. custom_menu_confirmed
        // is the authoritative "hands off" signal; check it first.
        // Also broaden the package-name check to match Dashboard's own
        // isCustom() definition (null/""/"(Custom)"/"Custom"), not just
        // null/"" — Menu Editor can stamp any of those on a custom build.
        const isConfirmed = ex.custom_menu_confirmed === true;
        const pkg = ex.menu_package;
        const isCustomPkgName = pkg === null || pkg === "" || pkg === "(Custom)" || pkg === "Custom";
        const hasCustomMenu = isCustomPkgName && Array.isArray(ex.menu) && ex.menu.length > 0;
        // Both checks above only ever caught the admin going fully custom/
        // blank or explicitly confirming. Picking a different NAMED package
        // in Dashboard (e.g. "Double Magnum Non Veg" -> "...Veg") matched
        // neither, so the row went through the plain upsert below with the
        // LMS's original package name and silently reverted the admin's
        // change on the very next sync (every app boot, 15-min cooldown).
        // lms_menu_package is a snapshot of what WE last wrote from the LMS
        // side only (see transformVenueContract/transformCateringContract) —
        // if the live menu_package has since drifted from that snapshot, it
        // was the admin who moved it, not a prior sync, so preserve it the
        // same way. Once a row has been through this fix, this is the only
        // check that still fires on every later admin repick; the two above
        // stay for rows that go fully custom or get explicitly confirmed.
        const lastSyncedPkg = ex.lms_menu_package;
        const hasPackageOverride = lastSyncedPkg != null && pkg !== null && pkg !== lastSyncedPkg;
        if (isConfirmed || hasCustomMenu || hasPackageOverride) customizedIds.add(ex.id);
      });

      const existingById = new Map<string, any>((existing || []).map((ex: any) => [ex.id, ex]));
      const newRows = batch.filter((ev) => !customizedIds.has(ev.id) && !existingById.has(ev.id));
      const safeExistingRows = batch.filter((ev) => !customizedIds.has(ev.id) && existingById.has(ev.id));
      const customizedRows = batch.filter((ev) => customizedIds.has(ev.id));

      if (newRows.length > 0) {
        const { error } = await sb.from("events").insert(newRows);
        if (error) console.error(`Insert batch ${i} error:`, error);
        else upserted += newRows.length;
      }
      // V85 — this whole preserve scheme is a read-then-write: the "safe"
      // decision above was made from a snapshot taken a moment ago. This sync
      // runs from several independent triggers (every app boot per device,
      // plus the manual "Sync LMS" button with no cooldown at all) and two
      // can easily overlap, so an admin's Dashboard package edit can land in
      // the gap between that read and this write — a blind upsert here would
      // clobber it with the exact same stale snapshot that made it look
      // unprotected a moment earlier, which is exactly what reverted a
      // package pick seconds after saving it. Guard the write with the
      // menu_package value this decision was actually based on: if it no
      // longer matches, something changed it after our read (almost always
      // the admin), and this write becomes a no-op instead of a clobber —
      // self-healing without a second read.
      for (const ev of safeExistingRows) {
        const ex = existingById.get(ev.id);
        const { id, ...patch } = ev;
        const { error, count } = await sb.from("events")
          .update(patch, { count: "exact" })
          .eq("id", id).eq("menu_package", ex.menu_package);
        if (error) console.error(`Conditional update ${id} error:`, error);
        else if (count && count > 0) upserted++;
      }
      for (const ev of customizedRows) {
        const { menu, menu_package, id, ...rest } = ev;
        const { error } = await sb.from("events").update(rest).eq("id", id);
        if (error) console.error(`Preserve-update ${id} error:`, error);
        else { upserted++; preservedCount++; }
      }
    }
    if (preservedCount > 0) console.log(`Preserved ${preservedCount} admin-customized menu(s)`);

    // ── Detect same-contract id swaps (a function's LMS-reported date
    // changed — a real edit, or an LMS bug like the one that caused this
    // whole fix) and migrate instead of silently deleting ──
    // Only acts on an unambiguous 1:1 swap for a given contract: exactly one
    // id this contract had before is missing from this sync, exactly one id
    // it didn't have before showed up, AND they plausibly describe the same
    // real-world function (same venue, same pax) — otherwise this is left
    // alone for the normal insert/delete logic below, rather than guessing
    // at a pairing. finalEvents already excludes tombstoned ids (see V72
    // note above), so the "old" and "new" sides below are its own already-
    // filtered IDs.
    const finalEventsById = new Map(finalEvents.map((e) => [e.id, e]));
    const newIdsByContract = new Map<string, Set<string>>();
    finalEvents.forEach((ev) => {
      const key = `${ev.lms_source}|${ev.lms_contract}`;
      if (!newIdsByContract.has(key)) newIdsByContract.set(key, new Set());
      newIdsByContract.get(key)!.add(ev.id);
    });
    const contractNos = Array.from(new Set(finalEvents.map((e) => e.lms_contract).filter(Boolean)));
    let renamedCount = 0;
    if (contractNos.length > 0) {
      const { data: existingForContracts, error: ecErr } = await sb
        .from("events")
        .select("id, lms_contract, lms_source, venue, pax, menu, menu_package, custom_menu_confirmed, event_items_initialized, menu_section_overrides, outsourced_dishes, external_caterer, external_caterer_name, odc_location, odc_address, odc_contact_phone, odc_transport_cost, odc_lead, site_recce, odc_menu_confirmed, lms_menu_package")
        .in("lms_contract", contractNos)
        .like("id", "LMS-%")
        .or("is_deleted.is.null,is_deleted.eq.false");
      if (ecErr) console.error("Fetch existing-for-contracts error:", ecErr);

      const oldRowsByContract = new Map<string, any[]>();
      (existingForContracts || []).forEach((row: any) => {
        const key = `${row.lms_source}|${row.lms_contract}`;
        if (!oldRowsByContract.has(key)) oldRowsByContract.set(key, []);
        oldRowsByContract.get(key)!.push(row);
      });

      for (const [key, oldRows] of oldRowsByContract) {
        const newIds = newIdsByContract.get(key) || new Set<string>();
        const disappearing = oldRows.filter((r) => !newIds.has(r.id));
        const appearing = Array.from(newIds).filter((id) => !oldRows.some((r) => r.id === id));
        if (disappearing.length !== 1 || appearing.length !== 1) {
          if (disappearing.length > 0 && appearing.length > 0) {
            console.log(`Ambiguous id change for ${key}: [${disappearing.map((r: any) => r.id).join(", ")}] -> [${appearing.join(", ")}] — leaving to normal insert/delete`);
          }
          continue;
        }
        const oldRow = disappearing[0];
        const newId = appearing[0];
        const newEv = finalEventsById.get(newId);
        const sameVenue = newEv && (newEv.venue || "") === (oldRow.venue || "");
        const samePax = newEv && Number(newEv.pax) === Number(oldRow.pax);
        if (!sameVenue || !samePax) {
          console.log(`Id change for ${key} (${oldRow.id} -> ${newId}) doesn't match on venue/pax — leaving to normal insert/delete`);
          continue;
        }
        try {
          await migrateEventId(sb, oldRow, newId);
          renamedCount++;
          console.log(`Migrated ${oldRow.id} -> ${newId} (contract ${oldRow.lms_contract})`);
        } catch (e) {
          console.error(`Failed to migrate ${oldRow.id} -> ${newId}:`, e);
        }
      }
    }
    if (renamedCount > 0) console.log(`Renamed ${renamedCount} event id(s), carrying menu/FP/tracking data over`);

    // ── Clean up cancelled / removed LMS events ──
    // Any LMS-sourced event in the sync window that wasn't in this batch is gone from LMS.
    // MUST exclude already-tombstoned (is_deleted=true) rows: they're excluded from
    // finalEvents/upsertedIds on purpose (that's the whole point of the tombstone), so
    // without this filter every one of them looked "gone from LMS" and got hard-deleted
    // right here — destroying the tombstone itself. The NEXT sync then found no tombstone
    // to exclude it, so a still-active LMS booking the user had deleted locally just
    // came right back. Once a row is tombstoned it should stay a tombstone forever, not
    // get swept up by this cleanup too.
    const upsertedIds = new Set(finalEvents.map(e => e.id));
    const { data: existingLms } = await sb
      .from("events")
      .select("id")
      .gte("date", fromDate)
      .lte("date", uptoDate)
      .like("id", "LMS-%")
      .or("is_deleted.is.null,is_deleted.eq.false");

    // 2026-11-14: this auto-delete pass is PERMANENTLY DISABLED after today's
    // incident. "Missing from this one fetch" has now been proven unsafe to
    // treat as "cancelled in LMS" THREE separate times in the same day, for
    // three different reasons (plain pagination truncation; a contract
    // invisible to the configured admin account despite being live and
    // non-cancelled in LMS; then this very safeguard's own replacement logic
    // introducing a fresh id-churn bug on its first run) -- each one hard-
    // deleted real events and cascade-took their event_items/
    // event_function_plans with them, including at least one already-
    // finalized, sent-to-kitchen FP, with zero way to recover any of it
    // afterward (no tombstone, no snapshot, immediate CASCADE). A detection
    // heuristic that has been wrong this many times in one day, with
    // unrecoverable consequences each time, should not be making the delete
    // decision unsupervised at all -- it only ever needs to flag candidates
    // for a human to confirm via the app's own (soft, reversible) delete
    // button. Never re-enable automatic deletion here without a durable,
    // reviewed tombstone/undo path first.
    const toDelete = (existingLms || []).filter(e => !upsertedIds.has(e.id)).map(e => e.id);
    const deleted = 0;
    if (toDelete.length > 0) {
      console.warn(`${toDelete.length} previously-synced event(s) were NOT in this run's LMS fetch -- NOT auto-deleting (disabled, see comment above). Review manually if any are genuinely cancelled: ${toDelete.join(", ")}`);
    }

    // ── Update sync log ──
    // Status stays "success" under truncation (the sync itself didn't fail,
    // it upserted everything it legitimately saw) -- error_message is reused
    // here as a non-fatal warning slot rather than adding a schema column
    // for something that, with MAX_PAGES raised, should be rare.
    const truncationWarning = fetchTruncated
      ? `WARNING: LMS fetch hit MAX_PAGES (${MAX_PAGES} pages / ${MAX_PAGES * PAGE_SIZE} rows) -- some contracts may not have been seen this run.`
      : (toDelete.length > 0 ? `${toDelete.length} event(s) missing from this fetch -- NOT auto-deleted (disabled). Review: ${toDelete.join(", ")}` : null);
    if (logId) {
      await sb.from("lms_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "success",
        venue_count: venueRows.length,
        catering_count: cateringRows.length,
        total_upserted: upserted,
        total_skipped: skipped,
        total_deleted: deleted,
        error_message: truncationWarning,
      }).eq("id", logId);
    }

    const result = {
      status: "success",
      venue_rows: venueRows.length,
      catering_rows: cateringRows.length,
      events_upserted: upserted,
      events_skipped: skipped,
      events_deleted: deleted,
      events_renamed: renamedCount,
      truncated: fetchTruncated,
      sync_window: `${fromDate} → ${uptoDate}`,
    };
    console.log("LMS Sync complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("LMS Sync error:", err);

    // Log the error
    if (logId) {
      await sb.from("lms_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "error",
        error_message: err.message || String(err),
      }).eq("id", logId);
    }

    return new Response(JSON.stringify({ status: "error", message: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});