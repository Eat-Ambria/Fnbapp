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
const MAX_PAGES = 50; // safety cap

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
async function fetchAllPages(
  endpoint: string,
  baseBody: Record<string, string>,
  responseKey: string
): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = { ...baseBody, page_limit: String(page) };
    const json = await lmsPost(endpoint, body);
    const rows = json[responseKey] || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break; // last page
  }
  return all;
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
  const funcDate = row.fiscd_function_date || "";
  if (!funcDate) return []; // skip placeholder entries

  const venueName = row.venue1 || normalizeVenue(row.fisc_location || "");
  const funcName = row.functionname || masters.functions[row.fiscd_function_type] || "Function";
  const menuName = resolveMenuName(row.fiscd_menu, row.menuname || "", masters.menus);
  const pax = parseInt(row.fiscd_pax_no) || 0;
  const time = row.fiscd_function_timings || "";
  const session = row.fiscd_session || "";

  // Build unique event ID: V-{contract}-{date} to handle multi-date contracts
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
    menu: [],  // resolved client-side from menu_package via MENU_PACKAGES
    special: null,
    extras: [],
    lms_contract: contractNo,
    lms_source: "venue",
    lms_status: status,
    lms_synced_at: new Date().toISOString(),
    lms_raw: stripFinancials(row),
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

  const funcDate = row.chcd_date || "";
  if (!funcDate) return [];

  const venueName = row.chcd_venue2 || row.chc_location || "Outdoor Catering";
  const funcName = row.functionname || masters.functions[row.chcd_function] || "Function";
  const menuName = resolveMenuName(row.chcd_menu, row.menuname || "", masters.menus);
  const pax = parseInt(row.chcd_pax) || 0;
  const time = row.chcd_time || "";
  const session = row.chcd_session || "";
  const catering = row.chcd_catering || "";

  const eventId = `LMS-C-${contractNo}-${funcDate}`;
  const isNonVeg = /non.?veg/i.test(catering) || /non.?veg/i.test(menuName);

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
    menu: [],
    special: null,
    extras: [],
    lms_contract: contractNo,
    lms_source: "catering",
    lms_status: null,
    lms_synced_at: new Date().toISOString(),
    lms_raw: stripFinancials(row),
  });

  return events;
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
    const venueRows = await fetchAllPages(
      "/api/v1/processerp_api/get_venue_contract_information_list",
      { loggeduserid: userId, fromdate: fromDate, uptodated: uptoDate, venue_datetype: "function_date" },
      "Contractinfo"
    );
    console.log(`Venue contracts fetched: ${venueRows.length} rows`);

    // ── Fetch Catering Contracts ──
    const cateringRows = await fetchAllPages(
      "/api/v1/processerp_api/get_catering_contract_information_list",
      { loggeduserid: userId, fromdate: fromDate, uptodated: uptoDate, cater_datetype: "function_date" },
      "Contractinfo"
    );
    console.log(`Catering contracts fetched: ${cateringRows.length} rows`);

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

    // Dedup by event ID (same contract+date could appear on multiple pages)
    const deduped = new Map<string, any>();
    allEvents.forEach((ev) => { deduped.set(ev.id, ev); });
    const finalEvents = Array.from(deduped.values());

    console.log(`Events to upsert: ${finalEvents.length} (skipped: ${skipped})`);

    // ── Upsert in batches of 50 ──
    let upserted = 0;
    for (let i = 0; i < finalEvents.length; i += 50) {
      const batch = finalEvents.slice(i, i + 50);
      const { error } = await sb.from("events").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error(`Upsert batch ${i} error:`, error);
      } else {
        upserted += batch.length;
      }
    }

    // ── Update sync log ──
    if (logId) {
      await sb.from("lms_sync_log").update({
        completed_at: new Date().toISOString(),
        status: "success",
        venue_count: venueRows.length,
        catering_count: cateringRows.length,
        total_upserted: upserted,
        total_skipped: skipped,
      }).eq("id", logId);
    }

    const result = {
      status: "success",
      venue_rows: venueRows.length,
      catering_rows: cateringRows.length,
      events_upserted: upserted,
      events_skipped: skipped,
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