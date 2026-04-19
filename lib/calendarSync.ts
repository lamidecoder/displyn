import { supabase } from './supabase';

export type CalendarProvider = 'google' | 'apple' | 'local' | 'other';
export type CalendarSyncState =
  | 'linked'
  | 'conflict'
  | 'deleted_external'
  | 'deleted_local';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: CalendarProvider;
  calendar_id: string;
  calendar_name: string;
  is_enabled: boolean;
  allow_external_delete: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventLink {
  id: string;
  user_id: string;
  calendar_id: string;
  external_event_id: string;
  task_id: string | null;
  sync_state: CalendarSyncState;
  external_updated_at: string | null;
  local_updated_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

async function resolveUserId(userId?: string): Promise<string | null> {
  if (userId) return userId;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getCalendarConnections(userId?: string): Promise<CalendarConnection[]> {
  const uid = await resolveUserId(userId);
  if (!uid) return [];

  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CalendarConnection[];
}

export async function upsertCalendarConnection(connection: {
  user_id?: string;
  provider: CalendarProvider;
  calendar_id: string;
  calendar_name: string;
  is_enabled?: boolean;
  allow_external_delete?: boolean;
}): Promise<CalendarConnection> {
  const uid = await resolveUserId(connection.user_id);
  if (!uid) throw new Error('User not authenticated');

  const payload = {
    user_id: uid,
    provider: connection.provider,
    calendar_id: connection.calendar_id,
    calendar_name: connection.calendar_name,
    is_enabled: connection.is_enabled ?? true,
    allow_external_delete: connection.allow_external_delete ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('calendar_connections')
    .upsert(payload, { onConflict: 'user_id,provider,calendar_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as CalendarConnection;
}

export async function setCalendarConnectionEnabled(
  connectionId: string,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase
    .from('calendar_connections')
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', connectionId);
  if (error) throw error;
}

export async function upsertCalendarEventLink(link: {
  user_id?: string;
  calendar_id: string;
  external_event_id: string;
  task_id?: string | null;
  sync_state?: CalendarSyncState;
  external_updated_at?: string | null;
  local_updated_at?: string | null;
  last_synced_at?: string | null;
}): Promise<CalendarEventLink> {
  const uid = await resolveUserId(link.user_id);
  if (!uid) throw new Error('User not authenticated');

  const payload = {
    user_id: uid,
    calendar_id: link.calendar_id,
    external_event_id: link.external_event_id,
    task_id: link.task_id ?? null,
    sync_state: link.sync_state ?? 'linked',
    external_updated_at: link.external_updated_at ?? null,
    local_updated_at: link.local_updated_at ?? null,
    last_synced_at: link.last_synced_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('calendar_event_links')
    .upsert(payload, { onConflict: 'user_id,calendar_id,external_event_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data as CalendarEventLink;
}

export async function getCalendarEventLinkByExternalId(params: {
  user_id?: string;
  calendar_id: string;
  external_event_id: string;
}): Promise<CalendarEventLink | null> {
  const uid = await resolveUserId(params.user_id);
  if (!uid) return null;

  const { data, error } = await supabase
    .from('calendar_event_links')
    .select('*')
    .eq('user_id', uid)
    .eq('calendar_id', params.calendar_id)
    .eq('external_event_id', params.external_event_id)
    .maybeSingle();
  if (error) throw error;
  return (data as CalendarEventLink | null) || null;
}

export async function listCalendarEventLinksForTask(
  taskId: string,
  userId?: string
): Promise<CalendarEventLink[]> {
  const uid = await resolveUserId(userId);
  if (!uid) return [];

  const { data, error } = await supabase
    .from('calendar_event_links')
    .select('*')
    .eq('user_id', uid)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CalendarEventLink[];
}

export async function markCalendarEventSyncState(
  linkId: string,
  syncState: CalendarSyncState
): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_links')
    .update({
      sync_state: syncState,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', linkId);
  if (error) throw error;
}

export async function unlinkCalendarEvent(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event_links')
    .delete()
    .eq('id', linkId);
  if (error) throw error;
}
