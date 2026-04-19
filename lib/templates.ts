import { supabase } from './supabase';

export type TemplateTaskType = 'one_time' | 'recurring' | 'challenge';

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  task_type: TemplateTaskType;
  category: string;
  tag: string;
  icon: string | null;
  payload: Record<string, any>;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export interface TemplatePrefill {
  title: string;
  tags: string[];
  time_block: string;
  recurrence_rule?: string | null;
  custom_days?: string[] | null;
  target_amount?: number | null;
  target_unit?: string | null;
  deadline?: string | null;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildTemplatePrefill(
  template: TaskTemplate,
  baseDate: Date = new Date()
): TemplatePrefill {
  const payload = template.payload || {};
  const title = String(payload.title || template.name);
  const tag = String(payload.tag || template.tag || 'Personal Growth');
  const timeBlock = String(payload.time_block || 'morning');

  const prefill: TemplatePrefill = {
    title,
    tags: [tag],
    time_block: timeBlock,
  };

  if (template.task_type === 'recurring') {
    prefill.recurrence_rule = payload.recurrence_type || 'daily';
    prefill.custom_days = Array.isArray(payload.custom_days) ? payload.custom_days : null;
  }

  if (template.task_type === 'challenge') {
    prefill.target_amount = Number(payload.target_amount || 0) || null;
    prefill.target_unit = payload.target_unit ? String(payload.target_unit) : null;
    if (typeof payload.deadline_offset_days === 'number') {
      prefill.deadline = addDays(baseDate, payload.deadline_offset_days)
        .toISOString()
        .split('T')[0];
    }
  }

  if (template.task_type === 'one_time' && typeof payload.scheduled_date_offset_days === 'number') {
    prefill.deadline = addDays(baseDate, payload.scheduled_date_offset_days)
      .toISOString()
      .split('T')[0];
  }

  return prefill;
}

export async function getTaskTemplates(params?: {
  taskType?: TemplateTaskType;
  category?: string;
  search?: string;
  limit?: number;
}): Promise<TaskTemplate[]> {
  const { taskType, category, search, limit = 500 } = params || {};

  let query = supabase
    .from('task_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(limit);

  if (taskType) query = query.eq('task_type', taskType);
  if (category) query = query.eq('category', category);
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TaskTemplate[];
}

export async function logTemplateUsage(templateId: string, userId?: string): Promise<void> {
  let uid = userId;
  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data.user?.id;
  }
  if (!uid) return;

  const { error } = await supabase.from('user_template_usage').insert({
    user_id: uid,
    template_id: templateId,
  });
  if (error) throw error;
}

export async function getRecommendedTemplates(
  focusTags: string[] = [],
  taskType?: TemplateTaskType
): Promise<TaskTemplate[]> {
  const templates = await getTaskTemplates({ taskType });
  if (!focusTags.length) return templates;

  const tagSet = new Set(focusTags.map((t) => t.toLowerCase()));
  return [...templates].sort((a, b) => {
    const aMatch = tagSet.has((a.tag || '').toLowerCase()) ? 1 : 0;
    const bMatch = tagSet.has((b.tag || '').toLowerCase()) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return (a.sort_order || 100) - (b.sort_order || 100);
  });
}
