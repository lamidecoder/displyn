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
  'Work & Career': '#3B82F6',
  'Health & Fitness': '#34D399',
  'Learning & Skill Building': '#A78BFA',
  'Finance & Money': '#FBBF24',
  'Personal Growth': '#EC4899',
  'Relationships & Social': '#FB923C',
  'Admin & Life Maintenance': '#6B7280',
  'Self-Care': '#F472B6',
  'Creative & Expression': '#14B8A6',
  'Spiritual / Purpose': '#8B5CF6',
  'Lifestyle & Leisure': '#06B6D4',
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
  // Challenge fields
  target_amount: number | null;
  target_unit: string | null;
  current_progress: number;
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
  skip_reason?: string | null;
  skip_note?: string | null;
  skip_action?: 'missed' | 'rescheduled' | null;
  rescheduled_to?: string | null;
  skipped_at?: string | null;
  is_priority: boolean;
  overdue_days: number;
  created_at: string;
  updated_at: string;
  task?: Task;
}

export interface ChallengeLog {
  id: string;
  task_id: string;
  user_id: string;
  logged_amount: number;
  logged_date: string;
  created_at: string;
}

export interface ChallengeStats {
  targetAmount: number;
  targetUnit: string;
  currentProgress: number;
  percentage: number;
  remaining: number;
  daysLeft: number;
  dailyTarget: number;
  todayLogged: number;
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
