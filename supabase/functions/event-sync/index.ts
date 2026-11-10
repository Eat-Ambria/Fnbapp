// Ambria FnB → Ops Event sync
// Deployed on FnB Supabase project (same project store-requisition-sync lives on).
// Upserts a tentative event on Ops' side for a function created directly in
// Fnbapp with no LMS contract behind it (events.lms_source is null), keyed
// by our own event id as external_ref -- so a later "Sync to Ops" store
// requisition for that function can carry a real Ops event_id instead of
// landing with store_requisitions.event_ids empty. Forwards to Ops'
// fnb-event-sync with the same shared bearer secret already used for
// store-requisition-sync (FNB_TO_OPS_REQ_SECRET -- Ops confirmed this reuse).
// Logs every request to fnb_ops_request_log, same as the other FnB->Ops
// functions.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// FnB (own project) — service_role auto-injected by Supabase for EFs
const FNB_URL = Deno.env.get("SUPABASE_URL")!;
const FNB_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ops (cross-project) — already set for store-requisition-sync, reused here
const OPS_BASE_URL = Deno.env.get("OPS_BASE_URL")!;
const FNB_TO_OPS_REQ_SECRET = Deno.env.get("FNB_TO_OPS_REQ_SECRET")!;

const fnb = createClient(FNB_URL, FNB_SERVICE_KEY);

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
  externalRef: string | null,
  status: number,
  responseBody: unknown,
  started: number,
) {
  try {
    await fnb.from("fnb_ops_request_log").insert({
      action: "event_sync",
      requested_by: null,
      payload_hash: externalRef,
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

  const { external_ref, client_name, venue_name, function_date, pax, function_type } = body || {};
  if (!external_ref) return json({ error: "missing_external_ref" }, 400);
  if (!function_date) return json({ error: "missing_function_date" }, 400);

  const opsPayload = {
    external_ref,
    client_name: client_name || null,
    venue_name: venue_name || null,
    function_date,
    pax: pax != null ? pax : null,
    function_type: function_type || null,
  };

  let opsRes: Response;
  try {
    opsRes = await fetch(`${OPS_BASE_URL}/fnb-event-sync`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FNB_TO_OPS_REQ_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opsPayload),
    });
  } catch (e) {
    return await logAndReturn(external_ref, 502,
      { error: "ops_unreachable", detail: String(e) }, started);
  }

  const opsStatus = opsRes.status;
  let opsBody: unknown;
  try {
    opsBody = await opsRes.json();
  } catch {
    opsBody = { error: "ops_non_json_response" };
  }
  return await logAndReturn(external_ref, opsStatus, opsBody, started);
});
