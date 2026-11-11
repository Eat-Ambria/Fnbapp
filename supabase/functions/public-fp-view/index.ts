// ══════════════════════════════════════════════════════════════════
// AMBRIA FnB — Public Function Plan Hub view
// File: supabase/functions/public-fp-view/index.ts
//
// Deploy: supabase functions deploy public-fp-view
// Call:   supabase.functions.invoke('public-fp-view', { body: {...} })
//
// Backs the no-login, link-shareable Function Plan hub (src/App.jsx's
// `?fp=1` route, src/components/PublicFPHub.jsx) — venue/vendor partners
// with no app account, viewing a function's printed FP once it's ready.
// Deliberately requires NO auth at all (that's the whole point of the
// link), which means it must never be a thin passthrough to the real
// tables: `events`, `event_function_plans` and `event_items` all hold a
// lot more than this page needs to show (client contact numbers, ODC
// transport cost, LMS sync internals, raw notes, lock/unlock history...),
// and `events` / `event_items` are also writable by any authenticated
// staff session, so handing an anonymous caller a live table read/write
// would either leak internal fields or (worse) let them touch rows no
// login ever checked. This function is the one audited, read-only,
// explicitly-projected surface instead — same idea as backfill-staff-auth/
// admin-staff-auth using the service role for what the client truly
// cannot be trusted with directly, just for a public read instead of an
// admin write.
//
// Every response is HTTP 200 with {ok, reason?} in the body, even for
// "not found"/"bad input" -- see admin-staff-auth's header for why
// (supabase-js's functions.invoke() only populates `data` for a 2xx).
//
// Request body: { action: 'list' }
//            or { action: 'detail', event_id }
// ══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Same reasoning as src/lib/db.js's fetchAllRows: a plain .select() caps at
// PostgREST's server-side 1000-row limit with no error. `events`,
// `event_function_plans` and `sales_items_meta` can all cross that.
async function fetchAllRows(build: () => any, pageSize = 1000, maxRows = 100000) {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    all.push(...batch);
    if (batch.length < pageSize || all.length >= maxRows) break;
    from += pageSize;
  }
  return all;
}

// Same hidden-booking rule as src/utils/helpers.js's isHiddenSmallRestroBooking
// -- a tiny walk-in at the in-house restro venue is not a real "function" and
// was never meant to show up on a public functions calendar either.
const RESTRO_VENUE_VALUES = new Set(["ambria restro", "ar"]);
function isHiddenSmallRestroBooking(ev: any): boolean {
  const v = String(ev?.venue || "").trim().toLowerCase();
  return RESTRO_VENUE_VALUES.has(v) && (Number(ev?.pax) || 0) < 50;
}

function normalizePkgName(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Explicit allowlists, not "fetch * then delete the sensitive keys" — a
// column added later (another ODC/LMS/contact-ish field, another FP audit
// column) is excluded by default instead of silently joining this public
// response. The `events` list only needs enough to render the calendar
// cards; `detail` needs a bit more (the actual menu fields) for the print.
const EVENT_LIST_COLUMNS = "id, date, time, guest, venue, pax";
// odc_location/odc_address ARE included here, deliberately, unlike the rest
// of the ODC/LMS field set: for an Outdoor Catering function, `venue` is
// just the literal label "Outdoor Catering (ODC)", not the real place —
// FunctionPlanPrintView's ADDRESS cell falls back to these two plain-text
// columns instead (see its own comment), and a venue/vendor partner reading
// this printed plan needs the actual address to be useful at all.
// lms_source/lms_raw ARE now selected too (2026-11-11, explicit business
// call — this link's audience already gets the client's contact number and
// signature below) but never passed through whole: LMS_RAW_SAFE_KEYS right
// below is the explicit allowlist actually used by FunctionPlanPrintView.jsx
// (function type, session, sub-venue, entered-by, plate counts, contact
// number) — anything else LMS happens to sync onto that row stays out.
const EVENT_DETAIL_COLUMNS =
  "id, date, time, guest, venue, pax, menu, menu_package, menu_section_overrides, veg, nonveg, type, outsourced_dishes, extras, odc_location, odc_address, lms_source, lms_raw";

// FunctionPlanPrintView.jsx / FunctionPlanTab.jsx's getLmsPlateInfo/
// LMS_FUNCTION_TYPES/LMS_STAFF_NAMES/CONTACT NO. cell — the only lms_raw
// subfields that print ever reads. fisc_client_mobile (the client's own
// number) is included per explicit instruction (2026-11-11) now that the
// public Hub link is meant to carry it.
const LMS_RAW_SAFE_KEYS = [
  "fiscd_function_type", "fisc_entryby", "address1", "fiscd_session", "chcd_session",
  "chcd_freepax", "fiscd_free_pax_no", "chcd_extra_plate", "fiscd_extra_plate_charge",
  "fisc_client_mobile",
];
function projectLmsRaw(raw: any): any {
  if (!raw || typeof raw !== "object") return null;
  const out: any = {};
  for (const k of LMS_RAW_SAFE_KEYS) if (raw[k] !== undefined) out[k] = raw[k];
  return out;
}

// Exactly the fp.* fields FunctionPlanPrintView.jsx actually reads, plus
// `locked`/`event_id`. guest_signature/guest_signature_name and created_by
// are included per explicit instruction (2026-11-11). Still deliberately
// excludes fp_history/lock_history (staff names and internal unlock
// reasons) and sent_to_kitchen_by — none of which the print shows, all of
// which a `select('*')` would otherwise hand to anyone with the link.
const FP_SAFE_COLUMNS = [
  "event_id", "locked", "created_by",
  "after_party_enabled", "after_party_pax", "after_party_start_time", "after_party_windup_time",
  "corkage_details", "corkage_liquor", "corkage_price",
  "drivers_food_count", "drivers_food_foc", "drivers_food_required", "drivers_food_total_override",
  "general_notes", "guest_community", "guest_preference", "guest_signature", "guest_signature_name",
  "layout_image_url", "layout_info", "oil_preference",
  "ops_manager_contact", "ops_manager_name",
  "room_check_in", "room_check_out", "room_count", "room_info_enabled",
  "service_notes", "spice_tolerance", "sweetness_tolerance",
  // Timings (FunctionPlanTab.jsx's TIME_FIELDS)
  "function_start_time", "chaat_time", "assembly_time", "snacks_time", "main_course_time",
  "jaimala_time", "windup_time", "phera_time", "chaat_end_time", "snacks_end_time",
  "live_start_time", "live_end_time", "valet_start_time", "valet_end_time",
  // Equipment add-ons (FunctionPlanTab.jsx's EQUIP_FIELDS)
  "fan_enabled", "fan_count", "fan_price",
  "cooler_enabled", "cooler_count", "cooler_price",
  "heater_enabled", "heater_count", "heater_price",
].join(", ");

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  try {
    const sb = getServiceClient();
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const [evRows, fpRows] = await Promise.all([
        fetchAllRows(() => sb.from("events").select(EVENT_LIST_COLUMNS).or("is_deleted.is.null,is_deleted.eq.false")),
        fetchAllRows(() => sb.from("event_function_plans").select("event_id, locked, created_by")),
      ]);
      const events = evRows.filter((e) => !isHiddenSmallRestroBooking(e));
      return json({ ok: true, events, fpStatus: fpRows });
    }

    if (body.action === "detail") {
      const eventId = String(body.event_id || "").trim();
      if (!eventId) return json({ ok: false, reason: "invalid_request" });

      // A Function Plan row must already exist (made or locked) — matches
      // PublicFPHub's own "clickable" gate client-side, enforced here too
      // since this is the actual access boundary now, not just UI polish.
      const fpRes = await sb.from("event_function_plans").select(FP_SAFE_COLUMNS).eq("event_id", eventId).maybeSingle();
      if (fpRes.error) return json({ ok: false, reason: fpRes.error.message });
      if (!fpRes.data) return json({ ok: false, reason: "not_found" });

      const evRes = await sb.from("events").select(EVENT_DETAIL_COLUMNS + ", is_deleted").eq("id", eventId).maybeSingle();
      if (evRes.error) return json({ ok: false, reason: evRes.error.message });
      if (!evRes.data || evRes.data.is_deleted) return json({ ok: false, reason: "not_found" });
      const event = { ...evRes.data };
      delete event.is_deleted; // fetched only to gate access, never part of the response shape
      event.lms_raw = projectLmsRaw(event.lms_raw); // allowlisted subset only — see LMS_RAW_SAFE_KEYS

      const [itemsRes, configsRes, salesMetaRows, sectionsRes, defsRes, optsRes] = await Promise.all([
        sb.from("event_items").select("*").eq("event_id", eventId),
        sb.from("event_configs").select("*").eq("event_id", eventId),
        fetchAllRows(() => sb.from("sales_items_meta").select("*")),
        sb.from("dish_catalogue_sections").select(
          "id, name, sort_order, sop_category_hint, sales_dept, dept, parent_section_id, addon_price_per_pax, no_auto_select"
        ).order("sort_order", { ascending: true }),
        sb.from("sales_config_defs").select("*"),
        sb.from("sales_config_options").select("*"),
      ]);
      if (itemsRes.error) return json({ ok: false, reason: itemsRes.error.message });
      if (configsRes.error) return json({ ok: false, reason: configsRes.error.message });
      if (sectionsRes.error) return json({ ok: false, reason: sectionsRes.error.message });
      if (defsRes.error) return json({ ok: false, reason: defsRes.error.message });
      if (optsRes.error) return json({ ok: false, reason: optsRes.error.message });

      // The matching menu_packages row (by name, same punctuation/case-
      // insensitive match the client uses elsewhere) — only its flat dish
      // list, for the print's "added beyond the package template" diff and
      // department grouping. Not found is not an error: an event can
      // legitimately have no resolvable package (free text, LMS mismatch).
      let menuPackage: { name: string; dishes: string[] } | null = null;
      const rawPkgName = event.menu_package;
      if (rawPkgName) {
        const pkgRows = await fetchAllRows(() => sb.from("menu_packages").select("name, dishes").eq("is_active", true));
        const wanted = normalizePkgName(rawPkgName);
        const match = pkgRows.find((r: any) => r.name === rawPkgName) ||
          pkgRows.find((r: any) => normalizePkgName(r.name) === wanted);
        if (match) {
          const dishes = typeof match.dishes === "string" ? JSON.parse(match.dishes || "[]") : (match.dishes || []);
          menuPackage = { name: match.name, dishes };
        }
      }

      // dishes_master, scoped to just the dishes this event's print can
      // actually show (its own items + the matched package's template) --
      // not the full 600+ row catalogue, which this caller has no reason
      // to see in full and which event_items/menu_package are the only
      // things driving relevance for.
      const dishNames = new Set<string>();
      (itemsRes.data || []).forEach((r: any) => { if (r.dish_name) dishNames.add(r.dish_name); });
      (menuPackage?.dishes || []).forEach((n: string) => { if (n) dishNames.add(n); });
      let dishMaster: any[] = [];
      if (dishNames.size > 0) {
        const dmRes = await sb.from("dishes_master")
          .select("dish_name, is_active, notes, image_url, section_id, sort_in_section, is_veg, no_auto_select, alt_group")
          .in("dish_name", Array.from(dishNames));
        if (dmRes.error) return json({ ok: false, reason: dmRes.error.message });
        dishMaster = dmRes.data || [];
      }

      return json({
        ok: true,
        event,
        fp: fpRes.data,
        items: itemsRes.data || [],
        configs: configsRes.data || [],
        salesMeta: salesMetaRows,
        sections: sectionsRes.data || [],
        menuPackage,
        dishMaster,
        salesConfigDefs: defsRes.data || [],
        salesConfigOptions: optsRes.data || [],
      });
    }

    return json({ ok: false, reason: "unknown_action" });
  } catch (err: any) {
    console.error("public-fp-view error:", err);
    return json({ ok: false, reason: "server_error", message: String(err?.message || err) });
  }
});
