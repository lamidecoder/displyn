export type TaskType = 'one_time' | 'recurring' | 'challenge';

export type RecurrenceRule =
  | 'daily'
  | 'weekdays'
  | 'weekends'
  | 'mon_wed_fri'
  | 'tue_thu'
  | 'custom';

export type TimeBlock = 'morning' | 'afternoon' | 'evening';

export type TaskStatus = 'pending' | 'completed' | 'missed' | 'snoozed';

export type TaskTag =
  | 'Work & Career'
  | 'Health & Fitness'
  | 'Learning & Skill Building'
  | 'Finance & Money'
  | 'Personal Growth'
  | 'Relationships & Social'
  | 'Admin & Life Maintenance'
  | 'Self-Care'
  | 'Creative & Expression'
  | 'Spiritual / Purpose'
  | 'Lifestyle & Leisure';

export const TASK_TAGS: TaskTag[] = [
  'Work & Career',
  'Health & Fitness',
  'Learning & Skill Building',
  'Finance & Money',
  'Personal Growth',
  'Relationships & Social',
  'Admin & Life Maintenance',
  'Self-Care',
  'Creative & Expression',
  'Spiritual / Purpose',
  'Lifestyle & Leisure',
];

export const TAG_COLORS: Record<TaskTag, string> = {
  'Work & Career': '#3b82f6',
  'Health & Fitness': '#22c55e',
  'Learning & Skill Building': '#a855f7',
  'Finance & Money': '#eab308',
  'Personal Growth': '#ec4899',
  'Relationships & Social': '#f97316',
  'Admin & Life Maintenance': '#6b7280',
  'Self-Care': '#F472B6',
  'Creative & Expression': '#14b8a6',
  'Spiritual / Purpose': '#8b5cf6',
  'Lifestyle & Leisure': '#06b6d4',
};

export const TAG_ICONS: Record<TaskTag, string> = {
  'Work & Career': '💼',
  'Health & Fitness': '💪',
  'Learning & Skill Building': '📚',
  'Finance & Money': '💰',
  'Personal Growth': '🌱',
  'Relationships & Social': '👥',
  'Admin & Life Maintenance': '🔧',
  'Self-Care': '🧴',
  'Creative & Expression': '🎨',
  'Spiritual / Purpose': '🧘',
  'Lifestyle & Leisure': '🎯',
};

export interface Task {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  task_type: TaskType;
  recurrence_rule: RecurrenceRule | null;
  time_block: TimeBlock;
  deadline: string | null;
  scheduled_time: string | null;
  tags: TaskTag[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskInstance {
  id: string;
  task_id: string;
  user_id: string;
  scheduled_date: string;
  status: TaskStatus;
  completed_at: string | null;
  snoozed_to: string | null;
  is_priority: boolean;
  overdue_days: number;
  created_at: string;
  updated_at: string;
  task?: Task;
}

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  avatar_url: string | null;
  notification_tone: string;
  focus_shown_date: string | null;
  created_at: string;
}