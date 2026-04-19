import { supabase } from './supabase';

// ============ RECURRENCE HELPERS ============

/**
 * Check if a day-of-week (0=Sun..6=Sat) matches a recurrence rule.
 */
const DAY_NAME_TO_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export function isDayScheduled(
  dayOfWeek: number,
  recurrenceRule: string,
  customDays?: string[] | null
): boolean {
  switch (recurrenceRule) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'mon_wed_fri':
      return [1, 3, 5].includes(dayOfWeek);
    case 'tue_thu':
      return [2, 4].includes(dayOfWeek);
    case 'custom':
      if (!customDays || customDays.length === 0) return false;
      return customDays.some(
        (dayName) => DAY_NAME_TO_NUM[dayName.toLowerCase()] === dayOfWeek
      );
    default:
      return false;
  }
}

/**
 * Get the start of the current week (Sunday).
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Go back to Sunday
  return d;
}

/**
 * Get all 7 days of the current week (Sun–Sat) as date strings.
 */
export function getCurrentWeekDates(date: Date = new Date()): string[] {
  const start = getWeekStart(date);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/**
 * Compute the next N scheduled dates for a recurrence rule, starting from tomorrow.
 */
export function computeUpcomingDates(recurrenceRule: string, count: number, customDays?: string[] | null): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1); // Start from tomorrow
  let checked = 0;
  while (dates.length < count && checked < 60) {
    if (isDayScheduled(d.getDay(), recurrenceRule, customDays)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
    checked++;
  }
  return dates;
}

/**
 * Build the 7-day weekly streak data for a task, with recurrence-awareness.
 * Returns an array of 7 objects (Sun–Sat) with: date, day label, isScheduled, status.
 * Days before the task was created are marked as 'inactive' (not missed).
 */
export function buildWeeklyStreak(
  recurrenceRule: string,
  instancesByDate: Map<string, string>, // date -> status
  createdAt?: string, // task creation date (ISO string or date string)
  customDays?: string[] | null,
): { date: string; day: string; isScheduled: boolean; status: string }[] {
  const weekDates = getCurrentWeekDates();
  const today = new Date().toISOString().split('T')[0];
  const createdDate = createdAt ? createdAt.split('T')[0] : null;

  return weekDates.map((dateStr) => {
    const d = new Date(dateStr);
    const dayOfWeek = d.getDay();
    const isScheduled = isDayScheduled(dayOfWeek, recurrenceRule, customDays);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

    // If this day is before the task was created, mark as inactive
    if (createdDate && dateStr < createdDate) {
      return { date: dateStr, day: dayLabel, isScheduled: false, status: 'inactive' };
    }

    let status = 'none'; // not scheduled
    if (isScheduled) {
      const instanceStatus = instancesByDate.get(dateStr);
      if (instanceStatus) {
        status = instanceStatus; // 'completed', 'missed', 'pending', 'snoozed'
      } else if (dateStr < today) {
        status = 'missed'; // past scheduled day with no instance = missed
      } else if (dateStr === today) {
        status = 'pending'; // today, not yet done
      } else {
        status = 'upcoming'; // future scheduled day
      }
    }

    return { date: dateStr, day: dayLabel, isScheduled, status };
  });
}

// ============ TASK CRUD ============

export async function createTask(task: {
  user_id: string;
  title: string;
  notes?: string | null;
  task_type: string;
  recurrence_rule?: string | null;
  custom_days?: string[] | null;
  time_block: string;
  deadline?: string | null;
  scheduled_time?: string | null;
  tags: string[];
  is_active: boolean;
  target_amount?: number | null;
  target_unit?: string | null;
}) {
  // Only include custom_days if it has values — prevents schema cache errors
  const insertData: any = { ...task };
  if (!insertData.custom_days || insertData.custom_days.length === 0) {
    delete insertData.custom_days;
  }
  // Ensure tags is always a proper array (fixes malformed array literal errors)
  if (insertData.tags) {
    if (typeof insertData.tags === 'string') {
      insertData.tags = [insertData.tags];
    }
    insertData.tags = insertData.tags.map((t: any) => String(t));
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string) {
  // Delete all instances for this task
  await supabase.from('task_instances').delete().eq('task_id', taskId);
  // Delete all challenge logs for this task
  await supabase.from('challenge_logs').delete().eq('task_id', taskId);
  // Delete the task itself
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function getUserTasks(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, updates: any) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveTask(taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============ TODAY INSTANCES ============

export async function getTodayInstances(userId: string, date: string) {
  // Fetch today's scheduled instances
  const { data: todayData, error: todayError } = await supabase
    .from('task_instances')
    .select('*, task:tasks(*)')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .order('is_priority', { ascending: false })
    .order('created_at', { ascending: true });
  if (todayError) throw todayError;

  // Also fetch carry-forward: pending one-time task instances from previous days
  const { data: carryForward, error: cfError } = await supabase
    .from('task_instances')
    .select('*, task:tasks(*)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('scheduled_date', date);
  if (cfError) throw cfError;

  // Filter carry-forward to only one-time tasks
  const oneTimeCarryForward = (carryForward || []).filter(
    (inst: any) => inst.task?.task_type === 'one_time'
  );

  // Calculate overdue_days dynamically for carry-forward instances
  const todayDate = new Date(date);
  for (const inst of oneTimeCarryForward) {
    const refDate = inst.task?.deadline
      ? new Date(inst.task.deadline)
      : new Date(inst.scheduled_date);
    const diff = Math.floor(
      (todayDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    inst.overdue_days = diff > 0 ? diff : 0;
    inst._isCarryForward = true;
  }

  // Deduplicate: if a one-time task has both a carry-forward instance AND
  // a today instance (from the old bug), keep the carry-forward one only
  const carryForwardTaskIds = new Set(oneTimeCarryForward.map((i: any) => i.task_id));
  const dedupedToday = (todayData || []).filter(
    (inst: any) => !carryForwardTaskIds.has(inst.task_id)
  );

  // Merge: carry-forward first (they're overdue and important), then today's instances
  const combined = [...oneTimeCarryForward, ...dedupedToday];
  return combined;
}

export async function generateTodayInstances(userId: string, date: string) {
  // Check existing instances for today
  const { data: existing } = await supabase
    .from('task_instances')
    .select('task_id')
    .eq('user_id', userId)
    .eq('scheduled_date', date);

  const existingTaskIds = new Set((existing || []).map((e: any) => e.task_id));

  // For one-time tasks: check ALL instances (any date) to avoid duplicates
  // A one-time task should only ever have ONE instance across its lifetime
  const { data: allOneTimeInstances } = await supabase
    .from('task_instances')
    .select('task_id, status')
    .eq('user_id', userId);

  // Build a map of task_id -> set of statuses across all dates
  const oneTimeInstanceMap = new Map<string, Set<string>>();
  for (const inst of (allOneTimeInstances || [])) {
    if (!oneTimeInstanceMap.has(inst.task_id)) {
      oneTimeInstanceMap.set(inst.task_id, new Set());
    }
    oneTimeInstanceMap.get(inst.task_id)!.add(inst.status);
  }

  // Get all active tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (!tasks) return getTodayInstances(userId, date);

  const today = new Date(date);
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...

  const newInstances: any[] = [];

  for (const task of tasks) {
    if (existingTaskIds.has(task.id)) continue;

    let shouldCreate = false;

    if (task.task_type === 'one_time') {
      // One-time tasks: only create if NO instance exists on any date
      // If there's already a pending instance from a past day, it will be
      // fetched as a carry-forward by getTodayInstances — don't duplicate
      const existingStatuses = oneTimeInstanceMap.get(task.id);
      if (existingStatuses && existingStatuses.size > 0) {
        // Instance already exists (done, missed, or pending on another day) — skip
        shouldCreate = false;
      } else {
        // No instance exists yet — create one from the day the task was created
        // Deadline only affects overdue color calculation, not when the task first appears
        const createdDate = task.created_at ? task.created_at.split('T')[0] : date;
        if (date >= createdDate) {
          shouldCreate = true;
        }
      }
    } else if (task.task_type === 'recurring') {
      shouldCreate = isDayScheduled(dayOfWeek, task.recurrence_rule || 'daily', task.custom_days);
    } else if (task.task_type === 'challenge') {
      // Challenge tasks show daily until deadline or until target is met
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        const todayDate = new Date(date);
        if (todayDate <= deadlineDate && (task.current_progress || 0) < (task.target_amount || 0)) {
          shouldCreate = true;
        }
      } else {
        // No deadline — always show if target not met
        if ((task.current_progress || 0) < (task.target_amount || 0)) {
          shouldCreate = true;
        }
      }
    }

    if (shouldCreate) {
      // Calculate overdue days for one-time tasks (both with and without deadline)
      let overdueDays = 0;
      if (task.task_type === 'one_time') {
        const refDate = task.deadline
          ? new Date(task.deadline)
          : new Date(task.created_at ? task.created_at.split('T')[0] : date);
        const todayDate = new Date(date);
        const diff = Math.floor(
          (todayDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff > 0) overdueDays = diff;
      }

      newInstances.push({
        task_id: task.id,
        user_id: userId,
        scheduled_date: date,
        status: 'pending',
        is_priority: false,
        overdue_days: overdueDays,
      });
    }
  }

  if (newInstances.length > 0) {
    await supabase.from('task_instances').insert(newInstances);
  }

  // Now assign priorities
  await assignPriorities(userId, date);

  return getTodayInstances(userId, date);
}

// ============ PRIORITY ENGINE ============

export async function assignPriorities(userId: string, date: string) {
  // Reset all priorities for today's instances
  await supabase
    .from('task_instances')
    .update({ is_priority: false })
    .eq('user_id', userId)
    .eq('scheduled_date', date);

  // Also reset priorities on carry-forward one-time instances from past days
  await supabase
    .from('task_instances')
    .update({ is_priority: false })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('scheduled_date', date);

  // Get all pending instances for today with task details
  const { data: todayInstances } = await supabase
    .from('task_instances')
    .select('*, task:tasks(*)')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .eq('status', 'pending');

  // Also get carry-forward pending one-time instances from past days
  const { data: carryForwardInstances } = await supabase
    .from('task_instances')
    .select('*, task:tasks(*)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('scheduled_date', date);

  const carryForwardOneTime = (carryForwardInstances || []).filter(
    (i: any) => i.task?.task_type === 'one_time'
  );

  // Dynamically compute overdue_days for carry-forward instances
  const todayDate = new Date(date);
  for (const inst of carryForwardOneTime) {
    const refDate = inst.task?.deadline
      ? new Date(inst.task.deadline)
      : new Date(inst.scheduled_date);
    const diff = Math.floor(
      (todayDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    inst.overdue_days = diff > 0 ? diff : 0;
  }

  const allInstances = [...carryForwardOneTime, ...(todayInstances || [])];
  if (allInstances.length === 0) return;

  // Sort by priority rules:
  // 1. Red overdue (3+ days) — mandatory
  // 2. Orange overdue (2 days)
  // 3. Yellow overdue (1 day)
  // 4. One-time due today (not overdue)
  // 5. Challenge tasks with high urgency (falling behind pace)
  // 6. Recurring tasks — lowest priority
  const getTypeRank = (inst: any): number => {
    const t = inst.task;
    if (!t) return 99;
    if (t.task_type === 'one_time') return 0;
    if (t.task_type === 'challenge') {
      const progress = t.current_progress || 0;
      const target = t.target_amount || 1;
      if (t.deadline) {
        const now = new Date(date);
        const dl = new Date(t.deadline);
        const daysLeft = Math.max(1, Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const remaining = Math.max(0, target - progress);
        const dailyNeeded = remaining / daysLeft;
        const dailyExpected = target / Math.max(1, Math.ceil((dl.getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)));
        // Behind pace → higher urgency (lower rank number = higher priority)
        if (dailyNeeded > dailyExpected) return 1;
      }
      return 2;
    }
    return 3; // recurring
  };

  const sorted = allInstances.sort((a: any, b: any) => {
    const aOverdue = a.overdue_days || 0;
    const bOverdue = b.overdue_days || 0;
    if (aOverdue !== bOverdue) {
      return bOverdue - aOverdue;
    }
    const aRank = getTypeRank(a);
    const bRank = getTypeRank(b);
    return aRank - bRank;
  });

  // Mark top 3 as priority
  const priorityIds = sorted.slice(0, 3).map((i: any) => i.id);

  if (priorityIds.length > 0) {
    await supabase
      .from('task_instances')
      .update({ is_priority: true })
      .in('id', priorityIds);
  }
}

// ============ STATUS UPDATES ============

export async function updateInstanceStatus(
  instanceId: string,
  status: string,
  snoozedTo?: string
) {
  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }

  if (status === 'snoozed' && snoozedTo) {
    updates.snoozed_to = snoozedTo;
  }

  const { data, error } = await supabase
    .from('task_instances')
    .update(updates)
    .eq('id', instanceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface SkipTaskOptions {
  reason: string;
  note?: string | null;
  rescheduledTo?: string | null; // YYYY-MM-DD
}

/**
 * Skip contract (Phase A):
 * - reason is mandatory
 * - no reschedule => instance becomes missed (skip_action=missed)
 * - reschedule => current instance missed (skip_action=rescheduled) and a pending instance is created/updated on target date
 */
export async function skipTaskInstance(instanceId: string, options: SkipTaskOptions) {
  const reason = (options.reason || '').trim();
  if (!reason) {
    throw new Error('Skip reason is required');
  }

  const nowIso = new Date().toISOString();
  const rescheduledTo = options.rescheduledTo || null;
  const skipAction = rescheduledTo ? 'rescheduled' : 'missed';

  const { data: current, error: currentError } = await supabase
    .from('task_instances')
    .select('id, task_id, user_id, scheduled_date')
    .eq('id', instanceId)
    .single();
  if (currentError || !current) throw currentError || new Error('Task instance not found');

  const { error: updateError } = await supabase
    .from('task_instances')
    .update({
      status: 'missed',
      skip_reason: reason,
      skip_note: options.note || null,
      skip_action: skipAction,
      rescheduled_to: rescheduledTo,
      skipped_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', instanceId);
  if (updateError) throw updateError;

  let rescheduledInstance: any = null;

  if (rescheduledTo) {
    const { data: existingRescheduled, error: existingError } = await supabase
      .from('task_instances')
      .select('id, status')
      .eq('task_id', current.task_id)
      .eq('user_id', current.user_id)
      .eq('scheduled_date', rescheduledTo)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingRescheduled) {
      const { data: updatedRescheduled, error: rsUpdateError } = await supabase
        .from('task_instances')
        .update({
          status: 'pending',
          overdue_days: 0,
          updated_at: nowIso,
        })
        .eq('id', existingRescheduled.id)
        .select()
        .single();
      if (rsUpdateError) throw rsUpdateError;
      rescheduledInstance = updatedRescheduled;
    } else {
      const { data: insertedRescheduled, error: insertError } = await supabase
        .from('task_instances')
        .insert({
          task_id: current.task_id,
          user_id: current.user_id,
          scheduled_date: rescheduledTo,
          status: 'pending',
          is_priority: false,
          overdue_days: 0,
        })
        .select()
        .single();
      if (insertError) throw insertError;
      rescheduledInstance = insertedRescheduled;
    }
  }

  return {
    instanceId,
    skipAction,
    reason,
    rescheduledTo,
    rescheduledInstance,
  };
}

// ============ PER-TASK ANALYTICS ============

export async function getTaskDetail(taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return data;
}

export async function getTaskAnalytics(taskId: string, userId: string, days: number) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Fetch task metadata (recurrence rule, custom days, time_block)
  const { data: taskMeta } = await supabase
    .from('tasks')
    .select('recurrence_rule, custom_days, created_at, time_block')
    .eq('id', taskId)
    .single();
  const recRule = taskMeta?.recurrence_rule || 'daily';
  const taskCustomDays = taskMeta?.custom_days || null;
  const taskCreatedAt = taskMeta?.created_at || undefined;
  const taskTimeBlock: string = taskMeta?.time_block || 'morning';

  // Determine how far back to fetch for 12 bars
  let fetchDays: number;
  if (days === 7) fetchDays = 7 * 12;       // 12 weeks
  else if (days === 14) fetchDays = 14 * 12; // 12 fortnights
  else fetchDays = 365;                       // 12 months

  const startDate = new Date();
  startDate.setDate(today.getDate() - fetchDays);

  const { data: allInstances, error } = await supabase
    .from('task_instances')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', todayStr)
    .order('scheduled_date', { ascending: true });
  if (error) throw error;
  if (!allInstances || allInstances.length === 0) {
    const emptyTod = { total: 0, completed: 0, rate: 0 };
    return {
      completed: 0, missed: 0, pending: 0, total: 0, streak: 0,
      periodData: [], dailyData: [], timeOfDayStats: {
        morning: { ...emptyTod }, afternoon: { ...emptyTod }, evening: { ...emptyTod },
        primary: taskTimeBlock as 'morning' | 'afternoon' | 'evening',
      },
    };
  }

  // Filter instances to selected period for counts
  const periodStart = new Date();
  periodStart.setDate(today.getDate() - fetchDays);
  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodInstances = allInstances.filter((i) => i.scheduled_date >= periodStartStr);

  const completed = periodInstances.filter((i) => i.status === 'completed').length;
  const missed = periodInstances.filter((i) => i.status === 'missed').length;
  const pending = periodInstances.filter((i) => i.status === 'pending').length;

  // --- Streak: consecutive completed ON the scheduled day ---
  let streak = 0;
  const reversedByDate = [...allInstances].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));
  for (const inst of reversedByDate) {
    if (inst.status === 'completed' && inst.completed_at) {
      const completedDate = inst.completed_at.split('T')[0];
      if (completedDate === inst.scheduled_date) {
        streak++;
      } else {
        break;
      }
    } else if (inst.status === 'pending') {
      continue; // skip today's pending — don't break streak
    } else {
      break;
    }
  }

  // --- Period data (12 bars) ---
  const periodData: { label: string; rate: number }[] = [];
  if (days === 30) {
    // Monthly buckets
    for (let m = 11; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthKey = d.toLocaleDateString('en-US', { month: 'short' });
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const bucket = allInstances.filter((inst) => {
        const id = new Date(inst.scheduled_date);
        return id.getFullYear() === yr && id.getMonth() === mo;
      });
      const tot = bucket.length;
      const comp = bucket.filter((i) => i.status === 'completed').length;
      periodData.push({ label: monthKey, rate: tot > 0 ? Math.round((comp / tot) * 100) : 0 });
    }
  } else {
    // Weekly (days=7) or fortnightly (days=14) buckets
    const bucketSize = days; // 7 or 14
    for (let b = 11; b >= 0; b--) {
      const bucketEnd = new Date(today);
      bucketEnd.setDate(today.getDate() - b * bucketSize);
      const bucketStart = new Date(bucketEnd);
      bucketStart.setDate(bucketEnd.getDate() - bucketSize + 1);
      const bStartStr = bucketStart.toISOString().split('T')[0];
      const bEndStr = bucketEnd.toISOString().split('T')[0];
      const bucket = allInstances.filter((i) => i.scheduled_date >= bStartStr && i.scheduled_date <= bEndStr);
      const tot = bucket.length;
      const comp = bucket.filter((i) => i.status === 'completed').length;
      const label = days === 7
        ? `W${12 - b}`
        : `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`;
      periodData.push({ label, rate: tot > 0 ? Math.round((comp / tot) * 100) : 0 });
    }
  }

  // --- Weekly streak data (current week, Sun–Sat) ---
  const instancesByDate = new Map<string, string>();
  allInstances.forEach((inst) => {
    instancesByDate.set(inst.scheduled_date, inst.status);
  });
  const dailyData = buildWeeklyStreak(recRule, instancesByDate, taskCreatedAt, taskCustomDays);

  // --- Time of day stats based on ACTUAL completion times ---
  const todCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0 };
  const completedWithTime = periodInstances.filter((i) => i.status === 'completed' && i.completed_at);
  const totalCompletions = completedWithTime.length;
  completedWithTime.forEach((inst) => {
    const hour = new Date(inst.completed_at).getHours();
    if (hour >= 5 && hour < 12) todCounts.morning++;
    else if (hour >= 12 && hour < 18) todCounts.afternoon++;
    else todCounts.evening++;
  });

  const makeTodStat = (key: string) => ({
    total: totalCompletions,
    completed: todCounts[key],
    rate: totalCompletions > 0 ? Math.round((todCounts[key] / totalCompletions) * 100) : 0,
  });

  const bestBlock = (Object.keys(todCounts) as Array<'morning' | 'afternoon' | 'evening'>)
    .reduce((a, b) => todCounts[a] >= todCounts[b] ? a : b);

  const timeOfDayStats = {
    morning: makeTodStat('morning'),
    afternoon: makeTodStat('afternoon'),
    evening: makeTodStat('evening'),
    primary: totalCompletions > 0 ? bestBlock : (taskTimeBlock as 'morning' | 'afternoon' | 'evening'),
  };

  return {
    completed,
    missed,
    pending,
    total: periodInstances.length,
    streak,
    periodData,
    dailyData,
    timeOfDayStats,
  };
}

/**
 * Get all scheduled instances for the current week (Sun–Sat) with real statuses.
 * Past days show completed/missed, today shows pending/completed, future days show upcoming.
 */
export async function getWeeklyInstancesForTask(taskId: string, userId: string) {
  // Fetch the task to get its recurrence rule, custom days, and creation date
  const { data: task, error } = await supabase
    .from('tasks')
    .select('recurrence_rule, custom_days, time_block, title, created_at')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  if (!task || !task.recurrence_rule) return [];

  const createdDate = task.created_at ? task.created_at.split('T')[0] : null;
  const today = new Date().toISOString().split('T')[0];

  // Current week only: Sunday to Saturday
  const weekStart = new Date(getWeekStart());
  const allDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    allDates.push(d.toISOString().split('T')[0]);
  }

  const rangeStart = allDates[0];
  const rangeEnd = allDates[allDates.length - 1];

  // Fetch actual instances from DB for this range
  const { data: instances } = await supabase
    .from('task_instances')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .gte('scheduled_date', rangeStart)
    .lte('scheduled_date', rangeEnd);

  const instanceMap = new Map<string, string>();
  (instances || []).forEach((inst) => {
    instanceMap.set(inst.scheduled_date, inst.status);
  });

  // Build the list: only scheduled days that are on or after the task's creation date
  return allDates
    .filter((dateStr) => {
      const d = new Date(dateStr);
      // Skip days before the task was created
      if (createdDate && dateStr < createdDate) return false;
      return isDayScheduled(d.getDay(), task.recurrence_rule, task.custom_days);
    })
    .map((dateStr) => {
      const dbStatus = instanceMap.get(dateStr);
      let status: string;

      if (dbStatus) {
        status = dbStatus; // completed, missed, pending, snoozed
      } else if (dateStr < today) {
        status = 'missed'; // past day, no instance = missed
      } else if (dateStr === today) {
        status = 'pending';
      } else {
        status = 'upcoming'; // future
      }

      return {
        id: `week-${taskId}-${dateStr}`,
        task_id: taskId,
        scheduled_date: dateStr,
        status,
        title: task.title,
        time_block: task.time_block,
      };
    });
}

export async function getRecurringTasksWithStats(userId: string) {
  // Get all active recurring tasks
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('task_type', 'recurring')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!tasks) return [];

  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length === 0) return [];

  // Get instances for the current week to build streak data
  const weekDates = getCurrentWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const { data: weekInstances } = await supabase
    .from('task_instances')
    .select('*')
    .in('task_id', taskIds)
    .eq('user_id', userId)
    .gte('scheduled_date', weekStart)
    .lte('scheduled_date', weekEnd);

  // Also get total completed count (all time)
  const { data: allInstances } = await supabase
    .from('task_instances')
    .select('task_id, status')
    .in('task_id', taskIds)
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Build per-task completion counts
  const completedCountMap = new Map<string, number>();
  (allInstances || []).forEach((inst) => {
    completedCountMap.set(inst.task_id, (completedCountMap.get(inst.task_id) || 0) + 1);
  });

  // Build per-task week instance maps (date -> status)
  const weekInstanceMap = new Map<string, Map<string, string>>();
  (weekInstances || []).forEach((inst) => {
    if (!weekInstanceMap.has(inst.task_id)) {
      weekInstanceMap.set(inst.task_id, new Map());
    }
    weekInstanceMap.get(inst.task_id)!.set(inst.scheduled_date, inst.status);
  });

  return tasks.map((task) => {
    const recurrenceRule = task.recurrence_rule || 'daily';

    // Compute upcoming count: scheduled days remaining this week (after today)
    const today = new Date().toISOString().split('T')[0];
    let upcomingThisWeek = 0;
    weekDates.forEach((dateStr) => {
      const d = new Date(dateStr);
      if (dateStr > today && isDayScheduled(d.getDay(), recurrenceRule, task.custom_days)) {
        upcomingThisWeek++;
      }
    });

    // Build weekly streak data (pass created_at so pre-creation days aren't marked as missed)
    const instancesByDate = weekInstanceMap.get(task.id) || new Map();
    const weeklyStreak = buildWeeklyStreak(recurrenceRule, instancesByDate, task.created_at, task.custom_days);

    return {
      ...task,
      stats: {
        upcoming: upcomingThisWeek,
        completed: completedCountMap.get(task.id) || 0,
      },
      weeklyStreak,
    };
  });
}

// ============ TASK INSTANCES BY DATE RANGE ============

export async function getTaskInstancesByRange(userId: string, days: number, bidirectional?: boolean) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - days);
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const startStr = pastDate.toISOString().split('T')[0];
  const endStr = bidirectional ? futureDate.toISOString().split('T')[0] : todayStr;

  const { data, error } = await supabase
    .from('task_instances')
    .select('*, task:tasks(*)')
    .eq('user_id', userId)
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date', { ascending: false });
  if (error) throw error;

  // Dynamically calculate overdue_days for pending one-time tasks
  const todayDate = new Date(todayStr);
  for (const inst of (data || [])) {
    if (inst.task?.task_type === 'one_time' && inst.status === 'pending') {
      const refDate = inst.task?.deadline
        ? new Date(inst.task.deadline)
        : new Date(inst.scheduled_date);
      const diff = Math.floor(
        (todayDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      inst.overdue_days = diff > 0 ? diff : 0;
    }
  }

  return data;
}

// ============ STATS HELPERS ============

export async function getWeeklyStats(userId: string) {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data } = await supabase
    .from('task_instances')
    .select('status, scheduled_date')
    .eq('user_id', userId)
    .gte('scheduled_date', weekAgo.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  if (!data || data.length === 0) {
    return { rate: 0, completed: 0, missed: 0, total: 0, dailyData: [] };
  }

  const completed = data.filter((i) => i.status === 'completed').length;
  const missed = data.filter((i) => i.status === 'missed').length;

  // Build daily completion data for momentum chart
  const dailyMap = new Map<string, { total: number; completed: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyMap.set(key, { total: 0, completed: 0 });
  }

  data.forEach((instance) => {
    const day = dailyMap.get(instance.scheduled_date);
    if (day) {
      day.total++;
      if (instance.status === 'completed') day.completed++;
    }
  });

  const dailyData = Array.from(dailyMap.entries()).map(([date, stats]) => ({
    date,
    rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
  }));

  return {
    rate: Math.round((completed / data.length) * 100),
    completed,
    missed,
    total: data.length,
    dailyData,
  };
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ============ CHALLENGE ENGINE ============

/**
 * Log progress for a challenge task. Inserts into challenge_logs,
 * updates the task's current_progress, then marks today's instance as completed.
 */
export async function logChallengeProgress(
  taskId: string,
  userId: string,
  amount: number,
  date: string
) {
  // 1. Insert the log
  const { error: logErr } = await supabase.from('challenge_logs').insert({
    task_id: taskId,
    user_id: userId,
    logged_amount: amount,
    logged_date: date,
  });
  if (logErr) throw logErr;

  // 2. Recalculate total progress from all logs (authoritative sum)
  const { data: allLogs, error: logsErr } = await supabase
    .from('challenge_logs')
    .select('logged_amount')
    .eq('task_id', taskId)
    .eq('user_id', userId);
  if (logsErr) throw logsErr;

  const totalProgress = (allLogs || []).reduce(
    (sum, log) => sum + (log.logged_amount || 0),
    0
  );

  // 3. Update the task's current_progress
  const { error: updateErr } = await supabase
    .from('tasks')
    .update({ current_progress: totalProgress, updated_at: new Date().toISOString() })
    .eq('id', taskId);
  if (updateErr) throw updateErr;

  // 4. Mark today's instance as completed
  const { data: todayInstance } = await supabase
    .from('task_instances')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .single();

  if (todayInstance) {
    await supabase
      .from('task_instances')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', todayInstance.id);
  }

  return totalProgress;
}

/**
 * Compute challenge stats for a given task.
 * Returns: targetAmount, targetUnit, currentProgress, percentage,
 * remaining, daysLeft, dailyTarget, todayLogged.
 */
export async function getChallengeStats(taskId: string, userId: string) {
  // Fetch the task
  const { data: task, error } = await supabase
    .from('tasks')
    .select('target_amount, target_unit, current_progress, deadline, created_at')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  if (!task) throw new Error('Task not found');

  const targetAmount = task.target_amount || 0;
  const targetUnit = task.target_unit || 'units';
  const currentProgress = task.current_progress || 0;
  const remaining = Math.max(targetAmount - currentProgress, 0);
  const percentage = targetAmount > 0 ? Math.min(Math.round((currentProgress / targetAmount) * 100), 100) : 0;

  // Days left until deadline
  let daysLeft = 0;
  if (task.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    daysLeft = Math.max(
      Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
      0
    );
  }

  // Recalculated daily target
  const dailyTarget = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;

  // How much was logged today
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayLogs } = await supabase
    .from('challenge_logs')
    .select('logged_amount')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .eq('logged_date', todayStr);
  const todayLogged = (todayLogs || []).reduce(
    (sum, log) => sum + (log.logged_amount || 0),
    0
  );

  return {
    targetAmount,
    targetUnit,
    currentProgress,
    percentage,
    remaining,
    daysLeft,
    dailyTarget,
    todayLogged,
  };
}

/**
 * Get all active challenge tasks with computed stats for the Tasks screen.
 */
export async function getChallengeTasksWithStats(userId: string) {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('task_type', 'challenge')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!tasks || tasks.length === 0) return [];

  // Compute stats for each task
  const results = await Promise.all(
    tasks.map(async (task) => {
      const stats = await getChallengeStats(task.id, userId);
      return { ...task, challengeStats: stats };
    })
  );

  return results;
}

// ============ CHALLENGE END STATES ============

export interface ChallengeOutcome {
  taskId: string;
  title: string;
  outcome: 'completed' | 'failed';
  currentProgress: number;
  targetAmount: number;
  targetUnit: string;
  percentage: number;
}

/**
 * Detect challenges that have reached their end state:
 * - COMPLETED: current_progress >= target_amount
 * - FAILED: deadline has passed and current_progress < target_amount
 *
 * Only returns challenges that haven't had a reflection saved yet.
 */
export async function detectChallengeEndStates(userId: string): Promise<ChallengeOutcome[]> {
  const { data: challenges } = await supabase
    .from('tasks')
    .select('id, title, target_amount, target_unit, current_progress, deadline')
    .eq('user_id', userId)
    .eq('task_type', 'challenge')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (!challenges || challenges.length === 0) return [];

  // Check which challenges already have reflections
  const { data: existingReflections } = await supabase
    .from('challenge_reflections')
    .select('task_id')
    .eq('user_id', userId);

  const reflectedTaskIds = new Set(
    (existingReflections || []).map((r: any) => r.task_id)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const outcomes: ChallengeOutcome[] = [];

  for (const c of challenges) {
    if (reflectedTaskIds.has(c.id)) continue;

    const target = c.target_amount || 0;
    const progress = c.current_progress || 0;
    const unit = c.target_unit || 'units';
    const pct = target > 0 ? Math.min(Math.round((progress / target) * 100), 100) : 0;

    if (progress >= target && target > 0) {
      outcomes.push({
        taskId: c.id,
        title: c.title,
        outcome: 'completed',
        currentProgress: progress,
        targetAmount: target,
        targetUnit: unit,
        percentage: pct,
      });
    } else if (c.deadline) {
      const deadline = new Date(c.deadline);
      deadline.setHours(0, 0, 0, 0);
      if (today > deadline) {
        outcomes.push({
          taskId: c.id,
          title: c.title,
          outcome: 'failed',
          currentProgress: progress,
          targetAmount: target,
          targetUnit: unit,
          percentage: pct,
        });
      }
    }
  }

  return outcomes;
}

/**
 * Save a challenge reflection and deactivate the challenge.
 */
export async function saveChallengeReflection(
  userId: string,
  taskId: string,
  outcome: 'completed' | 'failed',
  reflectionText: string,
  mood: string | null,
  achievedAmount: number,
  targetAmount: number
) {
  const { error: insertErr } = await supabase
    .from('challenge_reflections')
    .insert({
      user_id: userId,
      task_id: taskId,
      outcome,
      reflection_text: reflectionText,
      mood,
      achieved_amount: achievedAmount,
      target_amount: targetAmount,
    });
  if (insertErr) throw insertErr;

  // Deactivate the challenge so it stops appearing
  await supabase
    .from('tasks')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

/**
 * Get all past challenge reflections for AI context.
 */
export async function getChallengeReflections(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('challenge_reflections')
    .select('*, task:tasks(title, tags)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}