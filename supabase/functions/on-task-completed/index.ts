import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendAndLog,
  getLocalDateStr,
  TONE_MESSAGES,
  type Tone,
} from "../_shared/push-helpers.ts";

/**
 * on-task-completed — called via database webhook (trigger on task_instances UPDATE).
 *
 * When a task instance status changes to "completed", check if the user's streak
 * just hit 7, 14, 30, 60, or 100 days for that specific task.
 * If yes and not already notified, send a celebration push.
 *
 * Payload from the DB webhook: { type: "UPDATE", record: {...}, old_record: {...} }
 */

const MILESTONES = [7, 14, 30, 60, 100, 200, 365, 500, 1000];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // Support both webhook format and direct invocation
    const record = payload.record || payload;
    const oldRecord = payload.old_record;

    // Only process status changes to "completed"
    if (record.status !== "completed") {
      return new Response(
        JSON.stringify({ message: "Not a completion event" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // If we have old_record, only fire on actual status change
    if (oldRecord && oldRecord.status === "completed") {
      return new Response(
        JSON.stringify({ message: "Already completed, skipping" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const userId = record.user_id;
    const taskId = record.task_id;
    if (!userId || !taskId) {
      return new Response(
        JSON.stringify({ message: "Missing user_id or task_id" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "id, display_name, timezone, notification_tone, push_token, notifications_enabled, streak_notifications_enabled"
      )
      .eq("id", userId)
      .single();

    if (
      !profile ||
      !profile.push_token ||
      !profile.notifications_enabled ||
      profile.streak_notifications_enabled === false
    ) {
      return new Response(
        JSON.stringify({ message: "User not eligible for notifications" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const tone = (profile.notification_tone || "strict_mentor") as Tone;
    if (tone === "silent") {
      return new Response(
        JSON.stringify({ message: "Tone is silent" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Get the task title
    const { data: task } = await supabase
      .from("tasks")
      .select("title, task_type")
      .eq("id", taskId)
      .single();

    if (!task) {
      return new Response(
        JSON.stringify({ message: "Task not found" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Calculate consecutive-day streak for THIS specific task
    const { data: completions } = await supabase
      .from("task_instances")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1100);

    if (!completions || completions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No completions found" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const completedDates = new Set<string>();
    for (const c of completions) {
      if (c.completed_at) completedDates.add(c.completed_at.split("T")[0]);
    }

    const tz = profile.timezone || "UTC";
    const now = new Date();
    const d = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    d.setHours(0, 0, 0, 0);

    let streak = 0;
    while (streak < 1100) {
      const dateStr = d.toISOString().split("T")[0];
      if (completedDates.has(dateStr)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }

    // Check if this streak hits a milestone
    if (!MILESTONES.includes(streak)) {
      return new Response(
        JSON.stringify({ message: `Streak is ${streak}, no milestone` }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const todayStr = getLocalDateStr(now, tz);
    const msgs = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;
    const body = msgs.streakMilestone(
      profile.display_name || "there",
      task.title,
      streak
    );
    if (!body) {
      return new Response(
        JSON.stringify({ message: "Empty message body" }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const sent = await sendAndLog({
      supabase,
      userId,
      token: profile.push_token,
      eventType: "streak_milestone",
      eventDate: todayStr,
      referenceId: `${taskId}_${streak}`,
      title: `🔥 ${streak}-Day Streak!`,
      body,
      metadata: { task_title: task.title, streak, task_id: taskId },
    });

    return new Response(
      JSON.stringify({
        message: sent ? "Milestone notification sent" : "Already sent or failed",
        streak,
        milestone: streak,
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
