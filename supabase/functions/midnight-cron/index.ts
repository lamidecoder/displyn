import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Midnight Cron — runs hourly.
 * For each timezone that just passed midnight (00:xx), it:
 * 1. Marks all "pending" task_instances from yesterday as "missed"
 * 2. Recalculates priority tasks for today
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const currentUtcHour = now.getUTCHours();

    // Find timezones where it's currently midnight (00:xx)
    // We check for timezones where UTC offset = -currentUtcHour
    // e.g., if it's 01:00 UTC, we want timezones at UTC+1 (where it just became 00:00 locally... wait)
    // Actually: if UTC is 14:00, then timezone UTC+14 is at 04:00, timezone UTC-10 is at 04:00
    // For midnight: local_hour = 0 = utc_hour + offset => offset = -utc_hour
    // But offsets wrap around, so offset could be -currentUtcHour or (24 - currentUtcHour)

    // Get all distinct timezones from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, timezone")
      .not("timezone", "is", null);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No profiles found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For each user, check if their timezone just passed midnight
    const usersToProcess: string[] = [];

    for (const profile of profiles) {
      const tz = profile.timezone || "UTC";
      try {
        // Get the current hour in the user's timezone
        const localTime = new Date(
          now.toLocaleString("en-US", { timeZone: tz })
        );
        const localHour = localTime.getHours();

        // Process users whose local time is between 00:00 and 00:59
        if (localHour === 0) {
          usersToProcess.push(profile.id);
        }
      } catch {
        // Invalid timezone — skip
        continue;
      }
    }

    if (usersToProcess.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users at midnight right now", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalMissed = 0;
    let totalPrioritized = 0;

    for (const userId of usersToProcess) {
      // Get user's local "yesterday" date
      const tz = profiles.find((p) => p.id === userId)?.timezone || "UTC";
      const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      const yesterday = new Date(localNow);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const todayLocal = new Date(localNow);
      const todayStr = todayLocal.toISOString().split("T")[0];

      // === STEP 1: Mark pending instances from yesterday (and older) as missed ===
      // IMPORTANT: Only auto-miss recurring and challenge tasks.
      // One-time tasks carry forward with overdue colors — the user
      // must explicitly dismiss them (skip = missed) or complete them.
      const { data: pendingInstances, error: pendingError } = await supabase
        .from("task_instances")
        .select("id, task:tasks(task_type)")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("scheduled_date", yesterdayStr);

      if (!pendingError && pendingInstances && pendingInstances.length > 0) {
        // Filter out one-time tasks — they carry forward, not auto-missed
        const idsToMiss = pendingInstances
          .filter((i: any) => i.task?.task_type !== "one_time")
          .map((i: any) => i.id);

        if (idsToMiss.length > 0) {
          await supabase
            .from("task_instances")
            .update({ status: "missed" })
            .in("id", idsToMiss);
          totalMissed += idsToMiss.length;
        }
      }

      // === STEP 2: Recalculate priorities for today ===
      // Reset all priorities for today
      await supabase
        .from("task_instances")
        .update({ is_priority: false })
        .eq("user_id", userId)
        .eq("scheduled_date", todayStr);

      // Get all pending instances for today with task details
      const { data: todayInstances } = await supabase
        .from("task_instances")
        .select("*, task:tasks(*)")
        .eq("user_id", userId)
        .eq("scheduled_date", todayStr)
        .eq("status", "pending");

      if (todayInstances && todayInstances.length > 0) {
        // Sort by priority rules: overdue first, then one-time, then recurring
        const sorted = todayInstances.sort((a: any, b: any) => {
          if (a.overdue_days !== b.overdue_days) {
            return (b.overdue_days || 0) - (a.overdue_days || 0);
          }
          const aOneTime = a.task?.task_type === "one_time" ? 1 : 0;
          const bOneTime = b.task?.task_type === "one_time" ? 1 : 0;
          return bOneTime - aOneTime;
        });

        // Mark top 3 as priority
        const priorityIds = sorted.slice(0, 3).map((i: any) => i.id);
        if (priorityIds.length > 0) {
          await supabase
            .from("task_instances")
            .update({ is_priority: true })
            .in("id", priorityIds);
          totalPrioritized += priorityIds.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Midnight cron completed",
        usersProcessed: usersToProcess.length,
        tasksMissed: totalMissed,
        tasksPrioritized: totalPrioritized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
