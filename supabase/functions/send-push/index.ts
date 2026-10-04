// supabase/functions/send-push/index.ts
// Sends a Web Push notification to every device subscribed in
// push_subscriptions matching a notifications row's target_role /
// target_staff_id. Invoked by the client right after it inserts a row into
// `notifications` — push is the background-delivery path (app closed /
// backgrounded); the realtime subscription on `notifications` is the
// foreground (tab open) path and doesn't go through this function.
//
// Deploy: supabase functions deploy send-push
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are already provided by the
//   platform to every function)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  try {
    const { notification_id } = await req.json();
    if (!notification_id) {
      return new Response(JSON.stringify({ error: "notification_id required" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: notif, error: notifErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notification_id)
      .single();
    if (notifErr || !notif) {
      return new Response(JSON.stringify({ error: notifErr?.message || "notification not found" }), { status: 404 });
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // target_staff_id (a specific device owner) wins over target_role
    // (a coarse group — currently only 'kitchen' = head_chef + section_*).
    let q = supabase.from("push_subscriptions").select("*");
    if (notif.target_staff_id) {
      q = q.eq("staff_id", notif.target_staff_id);
    } else if (notif.target_role === "kitchen") {
      q = q.or("role.eq.head_chef,role.like.section_*");
    } else if (notif.target_role) {
      q = q.eq("role", notif.target_role);
    }
    const { data: subs, error: subsErr } = await q;
    if (subsErr) {
      return new Response(JSON.stringify({ error: subsErr.message }), { status: 500 });
    }

    const payload = JSON.stringify({
      title: notif.title,
      body: notif.body || "",
      kind: notif.kind,
      event_id: notif.event_id,
      notification_id: notif.id,
    });

    let sent = 0, expired = 0, failed = 0;
    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (e) {
        const status = e && (e.statusCode || e.status);
        if (status === 404 || status === 410) {
          // Subscription is gone (uninstalled / permission revoked) — prune it
          // instead of retrying it forever.
          expired++;
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          failed++;
          console.error("push send failed:", sub.endpoint, e);
        }
      }
    }

    return new Response(
      JSON.stringify({ status: "ok", targeted: (subs || []).length, sent, expired, failed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
