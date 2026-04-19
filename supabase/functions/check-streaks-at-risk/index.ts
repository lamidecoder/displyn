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
 * check-streaks-at-risk — cron every hour.
 *
 * For each user whose local time matches their evening_reminder_time hour:
 * If streak > 0 and no task completed today, send a streak-at-risk warning.
 *
 * Sends: "Your streak is at risk 🔥 — X-day streak for '[task name]'. Don't break it tonight."
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
      if (!p.streak_notifications_enabled) continue;

      const tone = p.notification_tone as Tone;
      if (tone === "silent") continue;

      const local = getLocalHourMinute(now, p.timezone);
      if (!local) continue;

      // Trigger at user's evening reminder hour (first 30 min window)
      const [eveningH] = p.evening_reminder_time.split(":").map(Number);
      if (local.hour !== eveningH || local.minute >= 30) continue;

      const todayStr = getLocalDateStr(now, p.timezone);

      // Check tasks completed today
      const { count: doneToday } = await supabase
        .from("task_instances")
        .select("*", { count: "exact", head: true })
        .eq("user_id", p.id)
        .eq("status", "completed")
        .gte("completed_at", todayStr + "T00:00:00")
        .lte("completed_at", todayStr + "T23:59:59");

      if ((doneToday || 0) > 0) continue;

      // Calculate current streak from completed_at dates
      const { data: completions } = await supabase
        .from("task_instances")
        .select("completed_at")
        .eq("user_id", p.id)
        .eq("status", "completed")
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(500);

      if (!completions || completions.length === 0) continue;

      const completedDates = new Set<string>();
      for (const c of completions) {
        if (c.completed_at) completedDates.add(c.completed_at.split("T")[0]);
      }

      // Count consecutive days backwards from yesterday
      let streak = 0;
      const d = new Date(now.toLocaleString("en-US", { timeZone: p.timezone }));
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - 1); // Start from yesterday since today has 0 done

      while (streak < 2100) {
        const dateStr = d.toISOString().split("T")[0];
        if (completedDates.has(dateStr)) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      if (streak === 0) continue;

      const msgs = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;
      const body = msgs.streakAtRisk(p.display_name!, streak);
      if (!body) continue;

      const sent = await sendAndLog({
        supabase,
        userId: p.id,
        token: p.push_token,
        eventType: "evening",
        eventDate: todayStr,
        referenceId: null,
        title: "Streak at risk! 🔥",
        body,
        metadata: { streak, timezone: p.timezone },
      });

      if (sent) totalSent++;
    }

    return new Response(
      JSON.stringify({
        message: "check-streaks-at-risk completed",
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
