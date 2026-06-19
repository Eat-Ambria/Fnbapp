// supabase/functions/cleanup-attendance-photos/index.ts
// Deletes attendance photos older than 90 days from Storage + clears URL columns
// Deploy: supabase functions deploy cleanup-attendance-photos
// Cron:   set up via Supabase Dashboard → Database → pg_cron, or call via external cron

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RETENTION_DAYS = 90;

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Find attendance records with photo URLs older than cutoff
    const { data: oldRecords, error: fetchErr } = await supabase
      .from("attendance")
      .select("id, date, in_photo_url, out_photo_url")
      .lt("date", cutoffStr)
      .or("in_photo_url.neq.,out_photo_url.neq.");

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!oldRecords || oldRecords.length === 0) {
      return new Response(JSON.stringify({
        status: "success",
        message: "No old photos to clean up",
        cutoff_date: cutoffStr,
      }));
    }

    // 2. Collect storage paths from URLs
    const bucket = "attendance-photos";
    const pathsToDelete: string[] = [];

    for (const rec of oldRecords) {
      for (const url of [rec.in_photo_url, rec.out_photo_url]) {
        if (!url) continue;
        // URL format: .../storage/v1/object/public/attendance-photos/2026-06-19/AM001_in_1234.jpg
        const marker = `/object/public/${bucket}/`;
        const idx = url.indexOf(marker);
        if (idx >= 0) {
          pathsToDelete.push(url.slice(idx + marker.length));
        }
      }
    }

    // 3. Delete files from storage in batches of 100
    let filesDeleted = 0;
    for (let i = 0; i < pathsToDelete.length; i += 100) {
      const batch = pathsToDelete.slice(i, i + 100);
      const { error: delErr } = await supabase.storage.from(bucket).remove(batch);
      if (delErr) {
        console.error("Storage delete batch error:", delErr);
      } else {
        filesDeleted += batch.length;
      }
    }

    // 4. Also delete any orphan folders (date-based) older than cutoff
    // List top-level folders in the bucket
    const { data: folders } = await supabase.storage.from(bucket).list("", { limit: 1000 });
    if (folders) {
      const oldFolders = folders
        .filter((f) => f.name && f.name < cutoffStr && f.name.match(/^\d{4}-\d{2}-\d{2}$/))
        .map((f) => f.name);

      for (const folder of oldFolders) {
        const { data: files } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files.map((f) => `${folder}/${f.name}`);
          const { error: fDelErr } = await supabase.storage.from(bucket).remove(paths);
          if (!fDelErr) filesDeleted += paths.length;
        }
      }
    }

    // 5. Clear URL columns in attendance table for old records
    const { error: updateErr, count } = await supabase
      .from("attendance")
      .update({ in_photo_url: null, out_photo_url: null })
      .lt("date", cutoffStr)
      .or("in_photo_url.neq.,out_photo_url.neq.");

    return new Response(
      JSON.stringify({
        status: "success",
        cutoff_date: cutoffStr,
        records_cleared: count || oldRecords.length,
        files_deleted: filesDeleted,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});