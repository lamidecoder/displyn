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
 * check-overdue — cron every hour.
 *
 * For each user, find tasks where scheduled_date < today, status = pending,
 * and no overdue notification already logged for that task today.
 * Max 3 notifications per user per run.
 *
 * Sends: "You missed one. — '[task name]' was due X hours ago."
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
      if (!p.overdue_notifications_enabled) continue;

      const tone = p.notification_tone as Tone;
      if (tone === "silent") continue;

      const local = getLocalHourMinute(now, p.timezone);
      if (!local) continue;

      // Only send overdue notifications during waking hours (8 AM – 10 PM)
      if (local.hour < 8 || local.hour >= 22) continue;

      const todayStr = getLocalDateStr(now, p.timezone);
      const msgs = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;

      // Find pending instances scheduled before today (overdue)
      const { data: overdue } = await supabase
        .from("task_instances")
        .select("id, scheduled_date, task:tasks(title, task_type)")
        .eq("user_id", p.id)
        .eq("status", "pending")
        .lt("scheduled_date", todayStr)
        .order("scheduled_date", { ascending: true })
        .limit(10);

      if (!overdue || overdue.length === 0) continue;

      let sentForUser = 0;
      for (const inst of overdue) {
        if (sentForUser >= 3) break;

        const task = inst.task as any;
        if (!task) continue;

        // Calculate hours overdue
        const scheduledDate = new Date(inst.scheduled_date + "T23:59:59Z");
        const hoursOverdue = Math.max(
          1,
          Math.floor(
            (now.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60)
          )
        );

        const body = msgs.overdue(
          p.display_name!,
          task.title,
          hoursOverdue
        );
        if (!body) continue;

        const sent = await sendAndLog({
          supabase,
          userId: p.id,
          token: p.push_token,
          eventType: "overdue",
          eventDate: todayStr,
          referenceId: inst.id,
          title: "You missed one.",
          body,
          metadata: {
            task_title: task.title,
            hours_overdue: hoursOverdue,
            scheduled_date: inst.scheduled_date,
          },
        });

        if (sent) {
          sentForUser++;
          totalSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "check-overdue completed",
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
