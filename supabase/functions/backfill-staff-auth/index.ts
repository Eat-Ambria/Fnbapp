// ══════════════════════════════════════════════════════════════════
// AMBRIA FnB — One-time Staff → Supabase Auth Backfill
// File: supabase/functions/backfill-staff-auth/index.ts
//
// Deploy: supabase functions deploy backfill-staff-auth
// Call (admin only, once): supabase.functions.invoke('backfill-staff-auth')
//
// Run this ONCE, after deploying this function AND applying
// 20261110000000_auth_rls_foundation.sql (which adds staff.auth_user_id —
// this function fails outright if that column doesn't exist yet) and
// BEFORE 20261110010000_drop_staff_pin_column.sql (which this function
// needs the pin column to still be reading from).
//
// For every staff row missing auth_user_id: creates a matching Supabase
// Auth account (synthetic email, password folding staff_id+pin -- see
// src/lib/staffAuth.js for the exact scheme, duplicated here since this
// runs on Deno, not through that bundle) and links it back via
// staff.auth_user_id. Idempotent in the common case (only processes rows
// still missing the link, safe to re-run), with one known gap: if a
// previous run created the auth.users row but failed before writing the
// link back (reported in this response's `failed` list), re-running will
// get an "already registered" error for that one row since the email is
// taken -- resolve that specific case manually in the Supabase dashboard's
// Authentication tab (find the user, copy its id, patch
// `staff.auth_user_id` directly) rather than fighting the duplicate email.
// ══════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function staffAuthEmail(staffId: string): string {
  return `${String(staffId).trim().toUpperCase()}@staff.ambria.local`;
}
function staffAuthPassword(staffId: string, pin: string): string {
  return `${String(staffId).trim().toUpperCase()}:${String(pin).trim()}`;
}

function getServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// Verifies the CALLER (via their own Authorization header, a real GoTrue
// access token) is an active admin, by asking GoTrue who they are and then
// looking that staff_id up with the service-role client (bypassing
// whatever RLS staff may have by the time this runs).
async function requireAdmin(req: Request, sb: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await callerClient.auth.getUser();
  if (error || !user) return null;
  const { data: staffRow } = await sb.from("staff").select("staff_id,role,is_active").eq("auth_user_id", user.id).maybeSingle();
  if (!staffRow || staffRow.role !== "admin" || staffRow.is_active === false) return null;
  return staffRow;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Every response is HTTP 200 with {ok, reason?} in the body -- never a
  // non-2xx status. supabase-js's functions.invoke() treats any non-2xx as
  // a FunctionsHttpError and puts the actual JSON body in error.context (a
  // raw Response), not in `data`, so a caller reading resp.data?.reason
  // would always see undefined for a non-2xx response.
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  try {
    const sb = getServiceClient();
    // Bootstrap exception: on a genuinely first run, NO staff row has
    // auth_user_id set yet -- including whichever admin would otherwise need
    // to call this -- so the normal admin check below can never succeed and
    // nobody could ever trigger the very backfill that makes it succeed.
    // Skip the check only in that exact state; any staff row already linked
    // means this has run before, and the normal admin check applies as usual
    // (including for re-runs that pick up newly-added staff). A failed count
    // query must NOT silently fall through to "treat as first run" -- that
    // would skip the admin check on every transient DB hiccup, not just a
    // genuine first run.
    const { count: linkedCount, error: countErr } = await sb.from("staff").select("staff_id", { count: "exact", head: true }).not("auth_user_id", "is", null);
    if (countErr) return json({ ok: false, reason: "count_query_failed", message: countErr.message });
    if ((linkedCount || 0) > 0) {
      const admin = await requireAdmin(req, sb);
      if (!admin) return json({ ok: false, reason: "not_admin" });
    }

    const { data: rows, error } = await sb.from("staff").select("staff_id,pin,is_active").is("auth_user_id", null);
    if (error) return json({ ok: false, reason: "query_failed", message: error.message });

    const created: string[] = [];
    const failed: { staff_id: string; reason: string }[] = [];

    for (const row of rows || []) {
      if (!row.pin) { failed.push({ staff_id: row.staff_id, reason: "no_pin_on_row" }); continue; }
      try {
        const { data: newUser, error: createErr } = await sb.auth.admin.createUser({
          email: staffAuthEmail(row.staff_id),
          password: staffAuthPassword(row.staff_id, row.pin),
          email_confirm: true,
          user_metadata: { staff_id: row.staff_id },
        });
        if (createErr || !newUser?.user) { failed.push({ staff_id: row.staff_id, reason: createErr?.message || "createUser returned no user" }); continue; }
        const { error: linkErr } = await sb.from("staff").update({ auth_user_id: newUser.user.id }).eq("staff_id", row.staff_id);
        if (linkErr) { failed.push({ staff_id: row.staff_id, reason: `auth account created but link failed: ${linkErr.message}` }); continue; }
        created.push(row.staff_id);
      } catch (e: any) {
        failed.push({ staff_id: row.staff_id, reason: String(e?.message || e) });
      }
    }

    return json({ ok: true, created, failed });
  } catch (err: any) {
    console.error("backfill-staff-auth error:", err);
    return json({ ok: false, reason: "server_error", message: String(err?.message || err) });
  }
});
