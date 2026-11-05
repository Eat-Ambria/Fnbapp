// ══════════════════════════════════════════════════════════════════
// AMBRIA FnB — Admin Staff-Auth Operations
// File: supabase/functions/admin-staff-auth/index.ts
//
// Deploy: supabase functions deploy admin-staff-auth
// Call:   supabase.functions.invoke('admin-staff-auth', { body: {...} })
//
// Admin-only operations that need the service-role key, because they touch
// Supabase Auth's admin API (never callable from the client with just the
// anon/authenticated role): provisioning a new staff member's login,
// resetting someone else's PIN, and cleaning up on delete. Both PIN actions
// use staff_id+pin -- the PIN is the password on that person's linked
// auth.users row (see src/lib/staffAuth.js for the staffId+pin -> password
// scheme, duplicated here since this runs on Deno, not through that
// bundle), never a `staff` table column.
//
// Every response is HTTP 200 with {ok, reason?} in the body, even for
// "denied"/"not found"/"bad input" -- never a non-2xx status. supabase-js's
// functions.invoke() treats any non-2xx as a FunctionsHttpError and puts the
// actual JSON body in error.context (a raw Response), NOT in `data` --
// reading resp.data?.reason the way every caller of this function does
// would always come back undefined for a non-2xx response. Only a genuinely
// unexpected crash (the outer catch) is worth treating differently, and
// even that stays 200 for the same reason.
//
// Request body: { action: 'create', staff_id, pin }
//            or { action: 'reset_pin', staff_id, new_pin }
//            or { action: 'delete', auth_user_id }
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
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });

  try {
    const sb = getServiceClient();
    const admin = await requireAdmin(req, sb);
    if (!admin) return json({ ok: false, reason: "not_admin" });

    const body = await req.json().catch(() => ({}));
    // Exactly 4 -- the client's login input itself caps entry at 4 digits
    // (LoginScreen.jsx), so accepting a longer PIN here would silently lock
    // that person out on their very next login attempt.
    const pinRe = /^\d{4}$/;

    if (body.action === "create") {
      const staffId = String(body.staff_id || "").trim().toUpperCase();
      const pin = String(body.pin || "").trim();
      if (!staffId || !pinRe.test(pin)) return json({ ok: false, reason: "invalid_request" });
      const { data: newUser, error: createErr } = await sb.auth.admin.createUser({
        email: staffAuthEmail(staffId),
        password: staffAuthPassword(staffId, pin),
        email_confirm: true,
        user_metadata: { staff_id: staffId },
      });
      if (createErr || !newUser?.user) return json({ ok: false, reason: createErr?.message || "create_failed" });
      const { error: linkErr } = await sb.from("staff").update({ auth_user_id: newUser.user.id }).eq("staff_id", staffId);
      if (linkErr) return json({ ok: false, reason: `auth account created but link failed: ${linkErr.message}` });
      return json({ ok: true, auth_user_id: newUser.user.id });
    }

    if (body.action === "reset_pin") {
      const staffId = String(body.staff_id || "").trim().toUpperCase();
      const newPin = String(body.new_pin || "").trim();
      if (!staffId || !pinRe.test(newPin)) return json({ ok: false, reason: "invalid_request" });
      const { data: row } = await sb.from("staff").select("auth_user_id").eq("staff_id", staffId).maybeSingle();
      if (!row?.auth_user_id) return json({ ok: false, reason: "no_linked_account" });
      const { error: updErr } = await sb.auth.admin.updateUserById(row.auth_user_id, { password: staffAuthPassword(staffId, newPin) });
      if (updErr) return json({ ok: false, reason: updErr.message });
      // The actual enforcement for "the old PIN no longer works anywhere" --
      // admin.signOut() is NOT the right call here, it takes an access
      // token, not a user id (it's meant for a user signing themself out,
      // not an admin revoking someone else by id) -- passing a uuid there
      // silently 401s and never actually revokes anything. This RPC deletes
      // the user's rows directly from auth.sessions/auth.refresh_tokens,
      // which is what actually invalidates every other refresh token for
      // this user. Best-effort: the password change above already
      // succeeded and is the primary result either way.
      const { error: revokeErr } = await sb.rpc("admin_revoke_user_sessions", { p_user_id: row.auth_user_id });
      if (revokeErr) console.error("admin_revoke_user_sessions failed:", revokeErr);
      return json({ ok: true });
    }

    if (body.action === "delete") {
      // Takes auth_user_id directly (looked up client-side from empDb
      // BEFORE the staff row itself is deleted) rather than re-querying by
      // staff_id here, since the client's staff-row delete and this call
      // race each other -- by the time this runs the staff row may already
      // be gone, and re-querying by staff_id would then find nothing.
      const authUserId = String(body.auth_user_id || "").trim();
      if (!authUserId) return json({ ok: false, reason: "invalid_request" });
      const { error: delErr } = await sb.auth.admin.deleteUser(authUserId);
      // Already gone is fine (idempotent) -- anything else is a real failure
      // worth surfacing, since a leftover auth.users row blocks re-adding a
      // staff member under the same staff_id later (same synthetic email).
      // Checked by status, not by matching message text (wording can change
      // between SDK versions; a status code is the stable contract).
      if (delErr && (delErr as any).status !== 404) {
        return json({ ok: false, reason: delErr.message });
      }
      return json({ ok: true });
    }

    return json({ ok: false, reason: "unknown_action" });
  } catch (err: any) {
    console.error("admin-staff-auth error:", err);
    return json({ ok: false, reason: "server_error", message: String(err?.message || err) });
  }
});
