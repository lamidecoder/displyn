import { supabase } from './supabase';
import { TAG_COLORS, TAG_ICONS, TASK_TAGS, TaskTag } from './types';

// ============ ANALYTICS DATA ============

/**
 * Get the current streak — consecutive days (ending today or yesterday)
 * where the user completed at least one task.
 */
export async function getStreak(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('task_instances')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null);
  if (error || !data || data.length === 0) return 0;

  // Build a set of dates the user actually tapped "Done" (by completed_at date)
  const completedDates = new Set<string>();
  data.forEach((inst: any) => {
    if (inst.completed_at) {
      completedDates.add(inst.completed_at.split('T')[0]);
    }
  });

  // Count consecutive days backwards from today
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  // Allow starting from today or yesterday
  const todayStr = d.toISOString().split('T')[0];
  if (!completedDates.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    if (completedDates.has(dateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
    if (streak > 2100) break;
  }

  return streak;
}

/**
 * Get completion status for each day of the current week (Sun–Sat).
 * Returns 7 items with { day, date, hasCompleted }.
 */
export async function getWeekDayStatus(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - dayOfWeek);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const { data } = await supabase
    .from('task_instances')
    .select('scheduled_date, status')
    .eq('user_id', userId)
    .gte('scheduled_date', dates[0])
    .lte('scheduled_date', dates[6]);

  const completedSet = new Set<string>();
  (data || []).forEach((inst) => {
    if (inst.status === 'completed') completedSet.add(inst.scheduled_date);
  });

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const todayStr = today.toISOString().split('T')[0];

  return dates.map((dateStr, i) => ({
    day: dayLabels[i],
    date: dateStr,
    hasCompleted: completedSet.has(dateStr),
    isToday: dateStr === todayStr,
    isFuture: dateStr > todayStr,
  }));
}

/**
 * Get completion rate stats for a date range.
 * Returns { started, done, missed, due, rate }.
 */
export async function getCompletionRate(userId: string, days: number) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);

  const { data } = await supabase
    .from('task_instances')
    .select('status')
    .eq('user_id', userId)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  if (!data || data.length === 0) return { started: 0, done: 0, missed: 0, due: 0, rate: 0 };

  const done = data.filter((i) => i.status === 'completed').length;
  const missed = data.filter((i) => i.status === 'missed').length;
  const pending = data.filter((i) => i.status === 'pending').length;
  const total = data.length;

  return {
    started: total,
    done,
    missed,
    due: pending,
    rate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

/**
 * Get comparison rates: today, yesterday, this week, last week, this month, last month.
 */
export async function getComparisonData(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  // Fetch all instances for the past ~60 days
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 62);

  const { data } = await supabase
    .from('task_instances')
    .select('scheduled_date, status')
    .eq('user_id', userId)
    .gte('scheduled_date', rangeStart.toISOString().split('T')[0])
    .lte('scheduled_date', todayStr);

  const instances = data || [];

  const calcRate = (items: typeof instances) => {
    if (items.length === 0) return 0;
    const completed = items.filter((i) => i.status === 'completed').length;
    return Math.round((completed / items.length) * 100);
  };

  const filterRange = (start: string, end: string) =>
    instances.filter((i) => i.scheduled_date >= start && i.scheduled_date <= end);

  return [
    { label: 'Today', rate: calcRate(filterRange(todayStr, todayStr)) },
    { label: 'Yesterday', rate: calcRate(filterRange(yesterdayStr, yesterdayStr)) },
    { label: 'This Week', rate: calcRate(filterRange(thisWeekStart.toISOString().split('T')[0], todayStr)) },
    { label: 'Last Week', rate: calcRate(filterRange(lastWeekStart.toISOString().split('T')[0], lastWeekEnd.toISOString().split('T')[0])) },
    { label: 'This Month', rate: calcRate(filterRange(thisMonthStart.toISOString().split('T')[0], todayStr)) },
    { label: 'Last Month', rate: calcRate(filterRange(lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0])) },
  ];
}

/**
 * Get monthly momentum trend data for a line chart.
 * Returns array of { month, rate } for up to the past 10 months.
 */
export async function getMonthlyTrend(userId: string, filter: '7d' | '30d' | '90d' | 'year' = 'year') {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate: Date;
  if (filter === '7d') {
    startDate = new Date(today); startDate.setDate(today.getDate() - 6);
  } else if (filter === '30d') {
    startDate = new Date(today); startDate.setDate(today.getDate() - 29);
  } else if (filter === '90d') {
    startDate = new Date(today); startDate.setDate(today.getDate() - 89);
  } else {
    startDate = new Date(today.getFullYear(), 0, 1); // Jan 1
  }
  startDate.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('task_instances')
    .select('scheduled_date, status')
    .eq('user_id', userId)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  const instances = data || [];

  if (filter === 'year') {
    // Group by month — full Jan-Dec
    const monthMap = new Map<string, { total: number; completed: number }>();
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    instances.forEach((inst) => {
      const d = new Date(inst.scheduled_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const existing = monthMap.get(key) || { total: 0, completed: 0 };
      existing.total++;
      if (inst.status === 'completed') existing.completed++;
      monthMap.set(key, existing);
    });

    const result: { month: string; rate: number; hasData: boolean }[] = [];
    for (let m = 0; m < 12; m++) {
      const key = `${today.getFullYear()}-${m}`;
      const stats = monthMap.get(key);
      const hasData = !!(stats && stats.total > 0);
      result.push({
        month: monthLabels[m],
        rate: hasData ? Math.round((stats!.completed / stats!.total) * 100) : 0,
        hasData,
      });
    }
    return result;
  }

  // For day-based filters: group by date
  const dayMap = new Map<string, { total: number; completed: number }>();
  instances.forEach((inst) => {
    const key = inst.scheduled_date;
    const existing = dayMap.get(key) || { total: 0, completed: 0 };
    existing.total++;
    if (inst.status === 'completed') existing.completed++;
    dayMap.set(key, existing);
  });

  // Build a point for each day in the range
  const result: { month: string; rate: number; hasData: boolean }[] = [];
  const totalDays = filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().split('T')[0];
    const stats = dayMap.get(key);
    const hasData = !!(stats && stats.total > 0);

    // Label: for 7d show day names, for 30d/90d show date numbers (show some, skip others)
    let label = '';
    if (filter === '7d') {
      label = dayNames[d.getDay()];
    } else if (filter === '30d') {
      label = (i % 5 === 0 || i === totalDays - 1) ? `${d.getDate()}` : '';
    } else {
      label = (i % 15 === 0 || i === totalDays - 1) ? `${d.getDate()}/${d.getMonth() + 1}` : '';
    }

    result.push({
      month: label,
      rate: hasData ? Math.round((stats!.completed / stats!.total) * 100) : 0,
      hasData,
    });
  }

  return result;
}

/**
 * Get tag breakdown — percentage of completed tasks per tag.
 */
export async function getTagBreakdown(userId: string, days: number) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);

  const { data } = await supabase
    .from('task_instances')
    .select('status, task:tasks(tags)')
    .eq('user_id', userId)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  const instances = data || [];

  // Count completed per tag
  const tagCounts = new Map<string, { completed: number; total: number }>();
  TASK_TAGS.forEach((tag) => tagCounts.set(tag, { completed: 0, total: 0 }));

  instances.forEach((inst: any) => {
    const tags: string[] = inst.task?.tags || [];
    tags.forEach((tag) => {
      const existing = tagCounts.get(tag) || { completed: 0, total: 0 };
      existing.total++;
      if (inst.status === 'completed') existing.completed++;
      tagCounts.set(tag, existing);
    });
  });

  const totalCompleted = instances.filter((i: any) => i.status === 'completed').length;

  return TASK_TAGS.map((tag) => {
    const stats = tagCounts.get(tag) || { completed: 0, total: 0 };
    return {
      tag,
      color: TAG_COLORS[tag],
      icon: TAG_ICONS[tag],
      completed: stats.completed,
      total: stats.total,
      percentage: totalCompleted > 0 ? Math.round((stats.completed / totalCompleted) * 100) : 0,
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    };
  }).sort((a, b) => b.completed - a.completed);
}

/**
 * Get peak productivity heatmap data.
 * Returns a 7×6 grid: rows = days (Sun–Sat), cols = time slots.
 * Time slots: 5a–8a, 8a–12p, 12p–2p, 2p–5p, 5p–9p, 9p–12a
 */
export async function getProductivityHeatmap(
  userId: string,
  filter: { type: '7d' | 'month' | 'year'; month?: number; year?: number } = { type: '7d' },
) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate: Date;
  if (filter.type === '7d') {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (filter.type === 'month') {
    const yr = filter.year ?? today.getFullYear();
    const mo = filter.month ?? today.getMonth();
    startDate = new Date(yr, mo, 1);
    const endOfMonth = new Date(yr, mo + 1, 0);
    if (endOfMonth < today) today.setTime(endOfMonth.getTime());
  } else {
    // year
    const yr = filter.year ?? today.getFullYear();
    startDate = new Date(yr, 0, 1);
    const endOfYear = new Date(yr, 11, 31);
    if (endOfYear < today) today.setTime(endOfYear.getTime());
  }
  startDate.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('task_instances')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  const timeSlots = ['12a-4a', '4a-8a', '8a-12p', '12p-4p', '4p-8p', '8p-12a'];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Initialize grid: heatmap[day][slot] = count
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(6).fill(0));

  (data || []).forEach((inst) => {
    if (!inst.completed_at) return;
    const d = new Date(inst.completed_at);
    const dayIdx = d.getDay(); // 0=Sun
    const hour = d.getHours();

    let slotIdx: number;
    if (hour < 4) slotIdx = 0;        // 12a-4a
    else if (hour < 8) slotIdx = 1;   // 4a-8a
    else if (hour < 12) slotIdx = 2;  // 8a-12p
    else if (hour < 16) slotIdx = 3;  // 12p-4p
    else if (hour < 20) slotIdx = 4;  // 4p-8p
    else slotIdx = 5;                 // 8p-12a

    heatmap[dayIdx][slotIdx]++;
  });

  // Find max for normalization
  let maxCount = 1;
  heatmap.forEach((row) => row.forEach((val) => { if (val > maxCount) maxCount = val; }));

  return { heatmap, maxCount, timeSlots, dayLabels };
}

// ============ INSIGHTS DATA ============

/**
 * Get pattern summary — top tags by rate and overall patterns.
 */
export async function getPatternSummary(userId: string, days: number) {
  const tagData = await getTagBreakdown(userId, days);
  const activeTags = tagData.filter((t) => t.total > 0);
  const topTag = activeTags.length > 0 ? activeTags[0] : null;
  const topThree = activeTags.slice(0, 3);

  return { topTag, topThree, allTags: tagData };
}

/**
 * Get most productive time of day.
 */
export async function getPeakTimeOfDay(userId: string, days: number) {
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);

  const { data } = await supabase
    .from('task_instances')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  let morning = 0, afternoon = 0, evening = 0;
  (data || []).forEach((inst) => {
    if (!inst.completed_at) return;
    const hour = new Date(inst.completed_at).getHours();
    if (hour < 12) morning++;
    else if (hour < 17) afternoon++;
    else evening++;
  });

  const total = morning + afternoon + evening;
  let peak: 'Morning' | 'Afternoon' | 'Night' = 'Morning';
  if (afternoon >= morning && afternoon >= evening) peak = 'Afternoon';
  else if (evening >= morning && evening >= afternoon) peak = 'Night';

  return {
    peak,
    morning: total > 0 ? Math.round((morning / total) * 100) : 0,
    afternoon: total > 0 ? Math.round((afternoon / total) * 100) : 0,
    evening: total > 0 ? Math.round((evening / total) * 100) : 0,
  };
}

/**
 * Get Focus Areas — tags with little or no activity.
 */
export async function getNeglectedAreas(
  userId: string,
  days: number,
  appMode?: string,
  focusTags?: string[]
) {
  const tagData = await getTagBreakdown(userId, days);

  const filtered = appMode === 'focused' && focusTags && focusTags.length > 0
    ? tagData.filter((t) => focusTags.includes(t.tag))
    : tagData;

  return filtered
    .filter((t) => t.total === 0 || t.rate < 30)
    .map((t) => ({
      tag: t.tag,
      icon: t.icon,
      color: t.color,
      completed: t.completed,
      total: t.total,
      description: t.total === 0
        ? 'Nothing tracked yet � keep going and it will show up here.'
        : `${t.completed} completed · ${t.total - t.completed} missed`,
    }));
}

// ============ WEEKLY REFLECTIONS ============

/** Get the Sunday of the current week */
function getCurrentWeekStart(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0 = Sunday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - dayOfWeek);
  return sunday.toISOString().split('T')[0];
}

/**
 * Save (upsert) a weekly reflection for the current week.
 */
export async function saveReflection(
  userId: string,
  reflectionText: string,
  mood: string | null
) {
  const weekStart = getCurrentWeekStart();

  const { data, error } = await supabase
    .from('weekly_reflections')
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        reflection_text: reflectionText,
        mood,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Load the reflection for the current week (if any).
 */
export async function loadCurrentReflection(userId: string) {
  const weekStart = getCurrentWeekStart();

  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;
  return data; // null if none saved yet
}

/**
 * Load past reflections (up to `limit` weeks, most recent first).
 */
export async function loadPastReflections(userId: string, limit = 8) {
  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============ WEEKLY AI INSIGHTS (Cached) ============

/**
 * Load cached AI insights (mirror + reflection) for the current week.
 * Returns null if none exist yet for this week.
 */
export async function loadWeeklyInsights(userId: string) {
  const weekStart = getCurrentWeekStart();

  const { data, error } = await supabase
    .from('weekly_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Save AI-generated insights (mirror + reflection) for the current week.
 * Upserts so regeneration overwrites the previous result.
 */
export async function saveWeeklyInsights(
  userId: string,
  mirrorData: any,
  reflectionData: any
) {
  const weekStart = getCurrentWeekStart();

  const { error } = await supabase
    .from('weekly_insights')
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        mirror_data: mirrorData,
        reflection_data: reflectionData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' }
    );

  if (error) throw error;
}
