/**
 * Shared push notification helpers used by all notification Edge Functions.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// time_block → approximate hour-of-day mapping (Option B)
export const TIME_BLOCK_HOURS: Record<string, number> = {
  morning: 9,
  afternoon: 13,
  evening: 18,
};

export type Tone =
  | "soft_coach"
  | "strict_mentor"
  | "savage"
  | "comedic"
  | "silent";

// ==================== EXPO PUSH ====================

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  const valid = tokens.filter((t) => t && t.startsWith("ExponentPushToken"));
  if (valid.length === 0 || !body) return false;

  const messages = valid.map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: { type: "nyla_notification", ...data },
  }));

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ==================== DEDUP ====================

export async function hasBeenSent(
  supabase: any,
  userId: string,
  eventType: string,
  eventDate: string,
  referenceId: string | null = null
): Promise<boolean> {
  let q = supabase
    .from("notification_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .eq("event_date", eventDate);

  if (referenceId) {
    q = q.eq("reference_id", referenceId);
  } else {
    q = q.is("reference_id", null);
  }

  const { data } = await q.maybeSingle();
  return !!data;
}

export async function logSent(
  supabase: any,
  userId: string,
  eventType: string,
  eventDate: string,
  referenceId: string | null = null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("notification_events").upsert(
    {
      user_id: userId,
      event_type: eventType,
      event_date: eventDate,
      reference_id: referenceId,
      metadata,
      sent_at: new Date().toISOString(),
    },
    { onConflict: "user_id,event_type,event_date,reference_id" }
  );
}

// ==================== SEND + LOG COMBO ====================

export async function sendAndLog(params: {
  supabase: any;
  userId: string;
  token: string;
  eventType: string;
  eventDate: string;
  referenceId?: string | null;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const {
    supabase,
    userId,
    token,
    eventType,
    eventDate,
    referenceId = null,
    title,
    body,
    metadata = {},
  } = params;

  const alreadySent = await hasBeenSent(
    supabase,
    userId,
    eventType,
    eventDate,
    referenceId
  );
  if (alreadySent) return false;

  const sent = await sendExpoPush([token], title, body, {
    eventType,
    referenceId,
  });
  if (!sent) return false;

  await logSent(supabase, userId, eventType, eventDate, referenceId, metadata);
  return true;
}

// ==================== TIMEZONE HELPERS ====================

export function getLocalHourMinute(
  now: Date,
  tz: string
): { hour: number; minute: number } | null {
  try {
    const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    return { hour: local.getHours(), minute: local.getMinutes() };
  } catch {
    return null;
  }
}

export function getLocalDateStr(now: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}

export function getLocalYesterday(now: Date, tz: string): string {
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  local.setDate(local.getDate() - 1);
  return local.toISOString().split("T")[0];
}

// ==================== PROFILE QUERY ====================

export interface NotifProfile {
  id: string;
  display_name: string | null;
  timezone: string;
  notification_tone: string;
  push_token: string;
  notifications_enabled: boolean;
  morning_reminder_time: string;
  evening_reminder_time: string;
  overdue_notifications_enabled: boolean;
  streak_notifications_enabled: boolean;
  daily_summary_enabled: boolean;
  daily_summary_time: string;
  reminder_minutes_before: number;
}

const PROFILE_SELECT = [
  "id",
  "display_name",
  "timezone",
  "notification_tone",
  "push_token",
  "notifications_enabled",
  "morning_reminder_time",
  "evening_reminder_time",
  "overdue_notifications_enabled",
  "streak_notifications_enabled",
  "daily_summary_enabled",
  "daily_summary_time",
  "reminder_minutes_before",
].join(", ");

export async function getNotifProfiles(
  supabase: any
): Promise<NotifProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("notifications_enabled", true)
    .not("push_token", "is", null)
    .neq("push_token", "");

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
  return (data || []).map((p: any) => ({
    ...p,
    timezone: p.timezone || "UTC",
    display_name: p.display_name || "there",
    notification_tone: p.notification_tone || "strict_mentor",
    morning_reminder_time: p.morning_reminder_time || "09:00",
    evening_reminder_time: p.evening_reminder_time || "20:00",
    daily_summary_time: p.daily_summary_time || "20:00",
    reminder_minutes_before: p.reminder_minutes_before ?? 30,
    overdue_notifications_enabled: p.overdue_notifications_enabled ?? true,
    streak_notifications_enabled: p.streak_notifications_enabled ?? true,
    daily_summary_enabled: p.daily_summary_enabled ?? true,
  }));
}

// ==================== TONE MESSAGES ====================

export interface ToneSet {
  reminder: (name: string, taskTitle: string, mins: number) => string;
  overdue: (name: string, taskTitle: string, hours: number) => string;
  streakAtRisk: (name: string, streak: number) => string;
  streakMilestone: (name: string, taskTitle: string, days: number) => string;
  summaryAllDone: (name: string, count: number) => string;
  summaryMost: (name: string, done: number, total: number) => string;
  summaryHalf: (name: string, done: number, total: number) => string;
  summaryZero: (name: string) => string;
}

export const TONE_MESSAGES: Record<Tone, ToneSet> = {
  soft_coach: {
    reminder: (_n, t, m) =>
      `Heads up — "${t}" is due in ${m} minutes. You've got this.`,
    overdue: (_n, t, h) =>
      `"${t}" was due ${h} hour${h !== 1 ? "s" : ""} ago. No pressure — just don't forget.`,
    streakAtRisk: (n, s) =>
      `Hey ${n}, your ${s}-day streak is at risk. Complete one task before bed to keep it alive.`,
    streakMilestone: (n, t, d) =>
      `${d}-Day Streak! You've completed "${t}" ${d} days in a row. Keep it going, ${n}!`,
    summaryAllDone: (n, c) =>
      `Clean sweep, ${n}! You finished all ${c} task${c !== 1 ? "s" : ""} today.`,
    summaryMost: (n, d, t) =>
      `Solid day, ${n}. ${d}/${t} tasks done. Almost there.`,
    summaryHalf: (n, d, t) =>
      `${d} of ${t} done today. Tomorrow is a fresh start, ${n}.`,
    summaryZero: (n) =>
      `Zero tasks completed today, ${n}. Tomorrow starts now.`,
  },
  strict_mentor: {
    reminder: (_n, t, m) =>
      `"${t}" is due in ${m} minutes. Handle it.`,
    overdue: (_n, t, h) =>
      `You missed "${t}" — it was due ${h} hour${h !== 1 ? "s" : ""} ago. No excuses.`,
    streakAtRisk: (n, s) =>
      `${n}, zero tasks done. Your ${s}-day streak dies at midnight. Act now.`,
    streakMilestone: (_n, t, d) =>
      `${d}-Day Streak on "${t}". Discipline is paying off. Don't stop.`,
    summaryAllDone: (_n, c) =>
      `All ${c} tasks done. That's the standard. Keep it up.`,
    summaryMost: (_n, d, t) =>
      `${d}/${t} tasks. Close — but close isn't done. Finish stronger tomorrow.`,
    summaryHalf: (_n, d, t) =>
      `Only ${d} of ${t}. That's not enough. Show up harder tomorrow.`,
    summaryZero: (n) =>
      `${n}. Zero. Nothing completed today. Fix it tomorrow.`,
  },
  savage: {
    reminder: (_n, t, m) =>
      `"${t}" in ${m} min. Don't even think about skipping it.`,
    overdue: (_n, t, h) =>
      `"${t}" was due ${h}h ago. Embarrassing. Handle it now.`,
    streakAtRisk: (n, s) =>
      `${n}. ZERO done today. Your ${s}-day streak? About to be a memory. Pathetic.`,
    streakMilestone: (_n, t, d) =>
      `${d} days of "${t}". Maybe you're not completely hopeless after all.`,
    summaryAllDone: (_n, c) =>
      `All ${c} done. Surprising. Don't let it go to your head.`,
    summaryMost: (_n, d, t) =>
      `${d}/${t}. Almost. "Almost" doesn't count.`,
    summaryHalf: (_n, d, t) =>
      `${d} of ${t}. Half-effort gets half-results. You know better.`,
    summaryZero: (n) =>
      `Zero today, ${n}. At this rate, delete the app. Or prove me wrong tomorrow.`,
  },
  comedic: {
    reminder: (_n, t, m) =>
      `"${t}" in ${m} min — it's giving you puppy eyes. Don't let it down.`,
    overdue: (_n, t, h) =>
      `"${t}" was due ${h}h ago. It filed a missing person report on you.`,
    streakAtRisk: (n, s) =>
      `${n}, your ${s}-day streak is sweating nervously. One task saves it. Be a hero.`,
    streakMilestone: (_n, t, d) =>
      `${d} days of "${t}"! Your future self just sent you a thank-you card.`,
    summaryAllDone: (n, c) =>
      `${n}, all ${c} tasks crushed. The productivity gods are smiling.`,
    summaryMost: (_n, d, t) =>
      `${d}/${t} done. Not bad — Netflix would've gotten the rest anyway.`,
    summaryHalf: (_n, d, t) =>
      `${d} of ${t}. The glass is half full. The other half is procrastination.`,
    summaryZero: (n) =>
      `Zero tasks today, ${n}. Even your couch is judging you. Tomorrow, redemption.`,
  },
  silent: {
    reminder: () => "",
    overdue: () => "",
    streakAtRisk: () => "",
    streakMilestone: () => "",
    summaryAllDone: () => "",
    summaryMost: () => "",
    summaryHalf: () => "",
    summaryZero: () => "",
  },
};
