import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  TIME_BLOCK_HOURS,
  getNotifProfiles,
  getLocalHourMinute,
  getLocalDateStr,
  sendAndLog,
  TONE_MESSAGES,
  type Tone,
} from "../_shared/push-helpers.ts";

/**
 * check-reminders — cron every 15 minutes.
 *
 * For each user, find tasks due within the next X minutes (from user pref,
 * default 30). Uses time_block → approximate hour mapping (Option B):
 *   morning → 9:00, afternoon → 13:00, evening → 18:00
 *
 * Sends: "Heads up — '[task name]' is due in X minutes."
 * Deduplicates per (user, "reminder", date, task_instance_id).
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
      const tone = p.notification_tone as Tone;
      if (tone === "silent") continue;

      const local = getLocalHourMinute(now, p.timezone);
      if (!local) continue;

      const todayStr = getLocalDateStr(now, p.timezone);
      const reminderWindow = p.reminder_minutes_before;
      const msgs = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;

      // Get today's pending task instances with their task details
      const { data: instances } = await supabase
        .from("task_instances")
        .select("id, task_id, scheduled_date, task:tasks(title, time_block)")
        .eq("user_id", p.id)
        .eq("scheduled_date", todayStr)
        .eq("status", "pending");

      if (!instances || instances.length === 0) continue;

      for (const inst of instances) {
        const task = inst.task as any;
        if (!task) continue;

        const blockHour = TIME_BLOCK_HOURS[task.time_block] ?? 9;

        // Calculate minutes until this task's approximate due time
        const dueMinutesFromMidnight = blockHour * 60;
        const currentMinutesFromMidnight = local.hour * 60 + local.minute;
        const minutesUntilDue =
          dueMinutesFromMidnight - currentMinutesFromMidnight;

        // Fire if the task is due within the reminder window but hasn't passed yet
        if (minutesUntilDue > 0 && minutesUntilDue <= reminderWindow) {
          const body = msgs.reminder(
            p.display_name!,
            task.title,
            minutesUntilDue
          );
          if (!body) continue;

          const sent = await sendAndLog({
            supabase,
            userId: p.id,
            token: p.push_token,
            eventType: "reminder",
            eventDate: todayStr,
            referenceId: inst.id,
            title: "Heads up 👀",
            body,
            metadata: {
              task_title: task.title,
              minutes_until: minutesUntilDue,
            },
          });

          if (sent) totalSent++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "check-reminders completed",
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
