// Ambria FnB → Ops Store Requisition sync
// Deployed on FnB Supabase project (same project ops-req-router lives on).
// Takes a station/day's newly-issued ingredients, resolves each one's
// FnB-side stable ops_inventory_id (e.g. "CS-1122") into Ops' real numeric
// item_id — branching on item_source, since ops-req-router's own decrement
// enrichment only ever handles catering_store_items and has no path for a
// direct inventory_items row — then forwards to Ops' fnb-store-requisition-sync
// with the shared bearer secret. Logs every request to fnb_ops_request_log,
// same as ops-req-router.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// FnB (own project) — service_role auto-injected by Supabase for EFs
const FNB_URL = Deno.env.get("SUPABASE_URL")!;
const FNB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ops (cross-project) — already set for ops-req-router, reused here
const OPS_SUPABASE_URL = Deno.env.get("OPS_SUPABASE_URL")!;
const OPS_ANON_KEY = Deno.env.get("OPS_ANON_KEY")!;
const OPS_BASE_URL = Deno.env.get("OPS_BASE_URL")!;
// Dedicated secret for this endpoint — distinct from ops-req-router's
// FNB_TO_OPS_SECRET (create/cancel/decrement) so the two can never be
// confused with each other.
const FNB_TO_OPS_REQ_SECRET = Deno.env.get("FNB_TO_OPS_REQ_SECRET")!;

const fnb = createClient(FNB_URL, FNB_SERVICE_KEY);
const ops = createClient(OPS_SUPABASE_URL, OPS_ANON_KEY);

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

async function logAndReturn(
  requestedBy: string | null,
  syncRef: string | null,
  status: number,
  responseBody: unknown,
  started: number,
) {
  try {
    await fnb.from("fnb_ops_request_log").insert({
      action: "store_requisition_sync",
      requested_by: requestedBy,
      payload_hash: syncRef,
      ops_status: status,
      ops_response: responseBody,
      latency_ms: Date.now() - started,
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

  const { sync_ref, issued_by, entry_date, event_id, section_name, items } = body || {};
  if (!sync_ref) return json({ error: "missing_sync_ref" }, 400);
  if (!issued_by) return json({ error: "missing_issued_by" }, 400);
  if (!entry_date) return json({ error: "missing_entry_date" }, 400);
  if (!section_name) return json({ error: "missing_section_name" }, 400);
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "empty_items" }, 400);
  }

  // Validate emp_id against FnB staff table (same bounded-blast-radius check
  // ops-req-router already does).
  const { data: staff, error: sErr } = await fnb
    .from("staff")
    .select("staff_id, is_active")
    .eq("staff_id", issued_by)
    .maybeSingle();
  if (sErr) {
    return await logAndReturn(issued_by, sync_ref, 500,
      { error: "staff_lookup_failed", detail: sErr.message }, started);
  }
  if (!staff) {
    return await logAndReturn(issued_by, sync_ref, 400,
      { error: "unknown_emp_id", emp_id: issued_by }, started);
  }
  if (staff.is_active === false) {
    return await logAndReturn(issued_by, sync_ref, 400,
      { error: "inactive_emp_id", emp_id: issued_by }, started);
  }

  // ── Resolve each item's stable ops_inventory_id -> Ops' real numeric id.
  // Two separate tables depending on item_source — ops-req-router's own
  // decrement enrichment only ever queries catering_store_items, which is
  // the gap Ops flagged for this endpoint specifically.
  const csIds = [...new Set(
    items.filter((it: any) => it.item_source === "catering_store").map((it: any) => it.ops_inventory_id).filter(Boolean)
  )];
  const invIds = [...new Set(
    items.filter((it: any) => it.item_source === "inventory").map((it: any) => it.ops_inventory_id).filter(Boolean)
  )];

  let csRows: any[] = [], invRows: any[] = [];
  if (csIds.length > 0) {
    const { data, error } = await ops.from("catering_store_items").select("id, inventory_id").in("inventory_id", csIds);
    if (error) {
      return await logAndReturn(issued_by, sync_ref, 502,
        { error: "ops_catering_store_lookup_failed", detail: error.message }, started);
    }
    csRows = data || [];
  }
  if (invIds.length > 0) {
    const { data, error } = await ops.from("inventory_items").select("id, inventory_id").in("inventory_id", invIds);
    if (error) {
      return await logAndReturn(issued_by, sync_ref, 502,
        { error: "ops_inventory_lookup_failed", detail: error.message }, started);
    }
    invRows = data || [];
  }
  const csMap = new Map<string, number>(csRows.map((r: any) => [r.inventory_id, r.id]));
  const invMap = new Map<string, number>(invRows.map((r: any) => [r.inventory_id, r.id]));

  const resolved: any[] = [];
  const missing: any[] = [];
  for (const it of items) {
    const idMap = it.item_source === "inventory" ? invMap : csMap;
    const itemId = idMap.get(it.ops_inventory_id);
    if (itemId == null) {
      missing.push({ ops_inventory_id: it.ops_inventory_id, item_source: it.item_source, reason: "not_found" });
      continue;
    }
    resolved.push({
      item_source: it.item_source,
      item_id: itemId,
      item_name: it.item_name,
      unit: it.unit,
      qty: it.qty,
    });
  }
  if (missing.length > 0) {
    return await logAndReturn(issued_by, sync_ref, 400,
      { error: "item_resolution_failed", missing }, started);
  }

  const opsPayload: any = { sync_ref, issued_by, entry_date, section_name, items: resolved };
  if (event_id != null) opsPayload.event_id = event_id;

  let opsRes: Response;
  try {
    opsRes = await fetch(`${OPS_BASE_URL}/fnb-store-requisition-sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FNB_TO_OPS_REQ_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opsPayload),
    });
  } catch (e) {
    return await logAndReturn(issued_by, sync_ref, 502,
      { error: "ops_unreachable", detail: String(e) }, started);
  }

  const opsStatus = opsRes.status;
  let opsBody: unknown;
  try {
    opsBody = await opsRes.json();
  } catch {
    opsBody = { error: "ops_non_json_response" };
  }
  return await logAndReturn(issued_by, sync_ref, opsStatus, opsBody, started);
});
