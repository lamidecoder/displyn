import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Notification Cron — runs every 30 minutes.
 *
 * For each user whose timezone matches:
 * - Morning reminder hour (default 9am): send morning task summary + overdue nudge + challenge warnings
 * - Evening reminder hour (default 8pm): send streak-at-risk warning (only if 0 tasks completed today)
 *
 * All messages adapt to the user's selected Nyla tone.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ==================== TONE-ADAPTED MESSAGES ====================

type Tone =
  | "soft_coach"
  | "strict_mentor"
  | "savage"
  | "comedic"
  | "silent";

interface ToneMessages {
  morningGreeting: (name: string, taskCount: number) => string;
  morningBody: (taskCount: number, overdueCount: number) => string;
  eveningWarning: (name: string, streak: number) => string;
  overdueNudge: (count: number) => string;
  challengeWarning: (title: string, daysLeft: number) => string;
}

type NotificationEventType =
  | "morning"
  | "evening"
  | "overdue"
  | "procrastination_alert";

const TONE_MESSAGES: Record<Tone, ToneMessages> = {
  soft_coach: {
    morningGreeting: (name, count) =>
      `Good morning, ${name}! You have ${count} task${count !== 1 ? "s" : ""} today.`,
    morningBody: (count, overdue) =>
      overdue > 0
        ? `${overdue} overdue — let's try to catch up today. You've got this.`
        : `A fresh day with ${count} thing${count !== 1 ? "s" : ""} to focus on. Take it one step at a time.`,
    eveningWarning: (name, streak) =>
      `Hey ${name}, your ${streak}-day streak is at risk. Just complete one task before bed to keep it going.`,
    overdueNudge: (count) =>
      `You have ${count} overdue task${count !== 1 ? "s" : ""}. No rush — just try to tackle one today.`,
    challengeWarning: (title, days) =>
      `Gentle reminder: "${title}" ends in ${days} day${days !== 1 ? "s" : ""}. Keep pushing!`,
  },
  strict_mentor: {
    morningGreeting: (name, count) =>
      `${name}. ${count} task${count !== 1 ? "s" : ""} on the board today. Time to execute.`,
    morningBody: (count, overdue) =>
      overdue > 0
        ? `${overdue} overdue. No excuses — get those handled first.`
        : `${count} task${count !== 1 ? "s" : ""} waiting. Prioritise and move.`,
    eveningWarning: (name, streak) =>
      `${name}, zero tasks done today. Your ${streak}-day streak dies at midnight. Act now.`,
    overdueNudge: (count) =>
      `${count} overdue. These shouldn't be carrying over. Handle them today.`,
    challengeWarning: (title, days) =>
      `"${title}" has ${days} day${days !== 1 ? "s" : ""} left. You committed to this. Don't slack now.`,
  },
  savage: {
    morningGreeting: (name, count) =>
      `Wake up, ${name}. ${count} task${count !== 1 ? "s" : ""} aren't going to do themselves.`,
    morningBody: (count, overdue) =>
      overdue > 0
        ? `${overdue} overdue. That's embarrassing. Fix it today or stop pretending you care.`
        : `${count} task${count !== 1 ? "s" : ""}. Yesterday's excuses don't work today. Move.`,
    eveningWarning: (name, streak) =>
      `${name}. ZERO tasks done today. Your ${streak}-day streak? About to be a memory. Pathetic.`,
    overdueNudge: (count) =>
      `${count} overdue. At this rate you might as well delete the app. Prove me wrong.`,
    challengeWarning: (title, days) =>
      `"${title}" — ${days} day${days !== 1 ? "s" : ""} left and you're falling behind. Quitter energy.`,
  },
  comedic: {
    morningGreeting: (name, count) =>
      `Rise and grind, ${name}! ${count} task${count !== 1 ? "s" : ""} looking at you with puppy eyes.`,
    morningBody: (count, overdue) =>
      overdue > 0
        ? `${overdue} overdue tasks are gathering dust. They're starting to feel neglected.`
        : `${count} task${count !== 1 ? "s" : ""} today. That's less than most Netflix episodes you watch. Let's go!`,
    eveningWarning: (name, streak) =>
      `Hey ${name}, your ${streak}-day streak is sweating nervously. One task is all it takes to save it. Be a hero.`,
    overdueNudge: (count) =>
      `${count} overdue task${count !== 1 ? "s" : ""} just filed a missing person report. Maybe check in on them?`,
    challengeWarning: (title, days) =>
      `"${title}" has ${days} day${days !== 1 ? "s" : ""} left. The clock is ticking louder than your excuses.`,
  },
  silent: {
    morningGreeting: () => "",
    morningBody: () => "",
    eveningWarning: () => "",
    overdueNudge: () => "",
    challengeWarning: () => "",
  },
};

// ==================== EXPO PUSH HELPER ====================

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string
): Promise<void> {
  if (tokens.length === 0 || !body) return;

  const messages = tokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: { type: "nyla_notification" },
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
}

function getLocalDateStr(now: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

async function hasNotificationEvent(
  supabase: any,
  userId: string,
  eventType: NotificationEventType,
  eventDate: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("notification_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("event_date", eventDate)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function logNotificationEvent(
  supabase: any,
  userId: string,
  eventType: NotificationEventType,
  eventDate: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  const { error } = await supabase.from("notification_events").upsert(
    {
      user_id: userId,
      event_type: eventType,
      event_date: eventDate,
      metadata,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_type,event_date" }
  );
  if (error) throw error;
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();

    // Fetch all users with push tokens and notifications enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(
        "id, display_name, timezone, notification_tone, push_token, notifications_enabled, morning_reminder_time, evening_reminder_time"
      )
      .not("push_token", "is", null)
      .neq("push_token", "");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No profiles with push tokens", sent: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalSent = 0;

    for (const profile of profiles) {
      // Skip if notifications disabled or tone is silent
      if (profile.notifications_enabled === false) continue;
      const tone = (profile.notification_tone || "strict_mentor") as Tone;
      if (tone === "silent") continue;

      const tz = profile.timezone || "UTC";
      const name = profile.display_name || "there";
      const messages = TONE_MESSAGES[tone] || TONE_MESSAGES.strict_mentor;
      const token = profile.push_token;

      let localHour: number;
      let localMinute: number;
      try {
        const localTime = new Date(
          now.toLocaleString("en-US", { timeZone: tz })
        );
        localHour = localTime.getHours();
        localMinute = localTime.getMinutes();
      } catch {
        continue; // Invalid timezone
      }

      // Parse user's preferred reminder times (default 09:00 and 20:00)
      const morningTime = profile.morning_reminder_time || "09:00";
      const eveningTime = profile.evening_reminder_time || "20:00";
      const [morningH] = morningTime.split(":").map(Number);
      const [eveningH] = eveningTime.split(":").map(Number);

      // Get user-local "today" safely in their timezone
      const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      const todayStr = getLocalDateStr(now, tz);

      // ===== MORNING REMINDER =====
      // Trigger if local hour matches morning hour and we're in the first 30 min window
      if (localHour === morningH && localMinute < 30) {
        const alreadySentMorning = await hasNotificationEvent(
          supabase,
          profile.id,
          "morning",
          todayStr
        );
        if (alreadySentMorning) continue;

        // Count today's pending tasks
        const { count: taskCount } = await supabase
          .from("task_instances")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("scheduled_date", todayStr)
          .eq("status", "pending");

        // Count overdue tasks (pending from before today, one-time carry-forward)
        const { count: overdueCount } = await supabase
          .from("task_instances")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("status", "pending")
          .lt("scheduled_date", todayStr);

        const total = (taskCount || 0) + (overdueCount || 0);
        const overdue = overdueCount || 0;

        if (total > 0) {
          const title = messages.morningGreeting(name, total);
          let body = messages.morningBody(total, overdue);

          // Check for challenges ending within 3 days
          const threeDaysLater = new Date(localNow);
          threeDaysLater.setDate(threeDaysLater.getDate() + 3);
          const threeDaysStr = threeDaysLater.toISOString().split("T")[0];

          const { data: urgentChallenges } = await supabase
            .from("tasks")
            .select("title, deadline")
            .eq("user_id", profile.id)
            .eq("task_type", "challenge")
            .eq("is_active", true)
            .lte("deadline", threeDaysStr)
            .gte("deadline", todayStr);

          if (urgentChallenges && urgentChallenges.length > 0) {
            const c = urgentChallenges[0];
            const daysLeft = Math.ceil(
              (new Date(c.deadline).getTime() - localNow.getTime()) /
                (1000 * 60 * 60 * 24)
            );
            body += "\n" + messages.challengeWarning(c.title, daysLeft);
          }

          await sendExpoPush([token], title, body);
          await logNotificationEvent(supabase, profile.id, "morning", todayStr, {
            pending_count: taskCount || 0,
            overdue_count: overdue,
            timezone: tz,
          });
          totalSent++;
        }
      }

      // ===== EVENING STREAK-AT-RISK REMINDER =====
      // Only fires if ZERO tasks completed today
      if (localHour === eveningH && localMinute < 30) {
        const alreadySentEvening = await hasNotificationEvent(
          supabase,
          profile.id,
          "evening",
          todayStr
        );
        if (alreadySentEvening) continue;

        // Check if any tasks were completed today
        const { count: doneToday } = await supabase
          .from("task_instances")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("scheduled_date", todayStr)
          .eq("status", "completed");

        if ((doneToday || 0) === 0) {
          // Get current streak from analytics
          const { data: streakData } = await supabase.rpc("get_user_streak", {
            p_user_id: profile.id,
          });

          // Fallback: just use a generic streak value if the RPC doesn't exist
          const streak =
            typeof streakData === "number"
              ? streakData
              : profile.highest_streak || 0;

          if (streak > 0) {
            const title = "Streak at risk!";
            const body = messages.eveningWarning(name, streak);
            await sendExpoPush([token], title, body);
            await logNotificationEvent(supabase, profile.id, "evening", todayStr, {
              streak,
              timezone: tz,
            });
            totalSent++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Notification cron completed",
        profilesChecked: profiles.length,
        notificationsSent: totalSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
