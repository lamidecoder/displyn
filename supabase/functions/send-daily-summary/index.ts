import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  getNotifProfiles,
  getLocalHourMinute,
  getLocalDateStr,
  sendAndLog,
  TONE_MESSAGES,
  type Tone,
} from "../_shared/push-helpers.ts";

/**
 * send-daily-summary — cron every hour.
 *
 * For each user whose local time matches their daily_summary_time hour:
 * Count tasks completed today vs tasks due today.
 *
 * - All done → "Clean sweep 💪 — You finished everything today."
 * - 50%+    → "Solid day. — X/Y tasks done."
 * - < 50%   → "Nyla noticed. — Only X of Y done today."
 * - Zero    → "Zero today. — Nothing completed. Tomorrow starts now."
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const profiles = await getNotifProfiles(supabase);
    let totalSent = 0;

    for (const p of profiles) {
      if (!p.daily_summary_enabled) continue;

      const tone = p.notification_tone as Tone;
      if (tone === "silent") continue;

      const local = getLocalHourMinute(now, p.timezone);
      if (!local) continue;

      // Trigger at user's daily summary hour (first 30 min window)
      const [summaryH] = p.daily_summary_time.split(":").map(Number);
      if (local.hour !== summaryH || local.minute >= 30) continue;

      const todayStr = getLocalDateStr(now, p.timezone);

      // Count total task instances scheduled today
      const { count: totalTasks } = await supabase
        .from("task_instances")
        .select("*", { count: "exact", head: true })
        .eq("user_id", p.id)
        .eq("scheduled_date", todayStr);

      // Count completed today
      const { count: doneTasks } = await supabase
        .from("task_instances")
        .select("*", { count: "exact", head: true })
        .eq("user_id", p.id)
        .eq("scheduled_date", todayStr)
        .eq("status", "completed");

      const total = totalTasks || 0;
      const done = doneTasks || 0;

      // Skip if user had no tasks scheduled at all
      if (total === 0) continue;

      const msgs = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;
      const name = p.display_name!;

      let title: string;
      let body: string;

      if (done >= total) {
        title = "Clean sweep 💪";
        body = msgs.summaryAllDone(name, total);
      } else if (done / total >= 0.5) {
        title = "Solid day.";
        body = msgs.summaryMost(name, done, total);
      } else if (done > 0) {
        title = "Nyla noticed.";
        body = msgs.summaryHalf(name, done, total);
      } else {
        title = "Zero today.";
        body = msgs.summaryZero(name);
      }

      if (!body) continue;

      const sent = await sendAndLog({
        supabase,
        userId: p.id,
        token: p.push_token,
        eventType: "daily_summary",
        eventDate: todayStr,
        referenceId: null,
        title,
        body,
        metadata: { done, total, timezone: p.timezone },
      });

      if (sent) totalSent++;
    }

    return new Response(
      JSON.stringify({
        message: "send-daily-summary completed",
        profilesChecked: profiles.length,
        sent: totalSent,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
