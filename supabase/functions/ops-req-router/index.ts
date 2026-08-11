// Ambria FnB → Ops requisition router
// Deployed on FnB Supabase project (ozibklsaweqizzyfwqmm).
// Proxies create/cancel/decrement to Ops Edge Functions with the shared bearer secret.
// Enriches decrement payloads with sub_venue_id/sub_department_id from cs_venue_allocations.
// Logs every request to fnb_ops_request_log.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// FnB (own project) — service_role auto-injected by Supabase for EFs
const FNB_URL = Deno.env.get("SUPABASE_URL")!;
const FNB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ops (cross-project) — set via `supabase secrets set`
const OPS_SUPABASE_URL = Deno.env.get("OPS_SUPABASE_URL")!;
const OPS_ANON_KEY = Deno.env.get("OPS_ANON_KEY")!;
const OPS_BASE_URL = Deno.env.get("OPS_BASE_URL")!;
const FNB_TO_OPS_SECRET = Deno.env.get("FNB_TO_OPS_SECRET")!;

const fnb = createClient(FNB_URL, FNB_SERVICE_KEY);
const ops = createClient(OPS_SUPABASE_URL, OPS_ANON_KEY);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function logAndReturn(
  action: string,
  requestedBy: string | null,
  payloadHash: string,
  status: number,
  responseBody: unknown,
  started: number,
) {
  const latency = Date.now() - started;
  try {
    await fnb.from("fnb_ops_request_log").insert({
      action,
      requested_by: requestedBy,
      payload_hash: payloadHash,
      ops_status: status,
      ops_response: responseBody,
      latency_ms: latency,
    });
  } catch (e) {
    console.error("log_write_failed", e);
  }
  return json(responseBody, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const started = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const { action, payload } = body || {};
  if (!action || !payload) return json({ error: "missing_action_or_payload" }, 400);
  if (!["create", "cancel", "decrement"].includes(action)) {
    return json({ error: "unknown_action", got: action }, 400);
  }

  const payloadHash = await sha256(JSON.stringify(payload));
  const requestedBy: string | null =
    payload.requested_by || payload.cancelled_by || payload.closed_by || null;

  // Validate emp_id against FnB staff table (bounded blast radius per V65)
  if (requestedBy) {
    const { data: staff, error: sErr } = await fnb
      .from("staff")
      .select("staff_id, is_active")
      .eq("staff_id", requestedBy)
      .maybeSingle();
    if (sErr) {
      return await logAndReturn(action, requestedBy, payloadHash, 500,
        { error: "staff_lookup_failed", detail: sErr.message }, started);
    }
    if (!staff) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "unknown_emp_id", emp_id: requestedBy }, started);
    }
    if (staff.is_active === false) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "inactive_emp_id", emp_id: requestedBy }, started);
    }
  }

  let enrichedPayload = payload;
  let opsUrl = "";

  if (action === "create") {
    if (!Number.isInteger(payload.venue_id)) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "venue_id_not_integer" }, started);
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "empty_items" }, started);
    }
    opsUrl = `${OPS_BASE_URL}/catering-requisition-create`;
  } else if (action === "cancel") {
    if (!payload.req_id || typeof payload.req_id !== "string") {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "missing_req_id" }, started);
    }
    opsUrl = `${OPS_BASE_URL}/catering-requisition-cancel`;
  } else if (action === "decrement") {
    if (!payload.fnb_event_id) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "missing_fnb_event_id" }, started);
    }
    if (!payload.close_token || !UUID_V4.test(payload.close_token)) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "bad_close_token" }, started);
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "empty_items" }, started);
    }

    // ── Enrich items: look up sub_venue_id + sub_department_id from cs_venue_allocations
    const invIds = [...new Set(payload.items.map((it: any) => it.ops_inventory_id).filter(Boolean))];
    if (invIds.length === 0) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "no_valid_ops_inventory_ids" }, started);
    }

    const { data: itemRows, error: iErr } = await ops
      .from("catering_store_items")
      .select("id, inventory_id")
      .in("inventory_id", invIds);
    if (iErr) {
      return await logAndReturn(action, requestedBy, payloadHash, 502,
        { error: "ops_items_lookup_failed", detail: iErr.message }, started);
    }
    const invToNumId = new Map<string, number>((itemRows || []).map((r: any) => [r.inventory_id, r.id]));

    const venueIds = [...new Set(payload.items.map((it: any) => it.venue_id))];
    const numIds = (itemRows || []).map((r: any) => r.id);
    const { data: allocs, error: aErr } = await ops
      .from("cs_venue_allocations")
      .select("item_id, venue_id, sub_venue_id, sub_department_id")
      .in("venue_id", venueIds)
      .in("item_id", numIds);
    if (aErr) {
      return await logAndReturn(action, requestedBy, payloadHash, 502,
        { error: "ops_alloc_lookup_failed", detail: aErr.message }, started);
    }
    const allocKey = (v: number, i: number) => `${v}::${i}`;
    const allocMap = new Map<string, { sub_venue_id: string | null; sub_department_id: string | null }>();
    for (const a of allocs || []) {
      // If dupes exist (see item 665), first row wins. Ops must dedupe upstream.
      const k = allocKey(a.venue_id, a.item_id);
      if (!allocMap.has(k)) {
        allocMap.set(k, { sub_venue_id: a.sub_venue_id, sub_department_id: a.sub_department_id });
      }
    }

    const enriched: any[] = [];
    const missing: any[] = [];
    for (const it of payload.items) {
      const numId = invToNumId.get(it.ops_inventory_id);
      if (numId == null) {
        missing.push({ ops_inventory_id: it.ops_inventory_id, reason: "not_in_catering_store_items" });
        continue;
      }
      const alloc = allocMap.get(allocKey(it.venue_id, numId));
      if (!alloc) {
        missing.push({
          ops_inventory_id: it.ops_inventory_id,
          venue_id: it.venue_id,
          reason: "no_allocation_row",
        });
        continue;
      }
      enriched.push({
        ops_inventory_id: it.ops_inventory_id,
        venue_id: it.venue_id,
        sub_venue_id: alloc.sub_venue_id,
        sub_department_id: alloc.sub_department_id,
        qty: it.qty,
      });
    }
    if (missing.length > 0) {
      return await logAndReturn(action, requestedBy, payloadHash, 400,
        { error: "allocation_lookup_failed", missing }, started);
    }
    enrichedPayload = { ...payload, items: enriched };
    opsUrl = `${OPS_BASE_URL}/catering-inventory-decrement`;
  }

  // ── Forward to Ops
  let opsRes: Response;
  try {
    opsRes = await fetch(opsUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FNB_TO_OPS_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(enrichedPayload),
    });
  } catch (e) {
    return await logAndReturn(action, requestedBy, payloadHash, 502,
      { error: "ops_unreachable", detail: String(e) }, started);
  }

  const opsStatus = opsRes.status;
  let opsBody: unknown;
  try {
    opsBody = await opsRes.json();
  } catch {
    opsBody = { error: "ops_non_json_response" };
  }
  return await logAndReturn(action, requestedBy, payloadHash, opsStatus, opsBody, started);
});