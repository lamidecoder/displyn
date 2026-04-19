-- ============================================================
-- Push Notification System — Database Changes
-- ============================================================

-- 1. Add granular notification preference columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS overdue_notifications_enabled boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_notifications_enabled boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_summary_enabled boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_summary_time text DEFAULT '20:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_minutes_before integer DEFAULT 30;

-- 2. Add reference_id to notification_events for per-task dedup
ALTER TABLE notification_events ADD COLUMN IF NOT EXISTS reference_id text DEFAULT NULL;

-- Drop old unique constraint (user_id, event_type, event_date)
-- and replace with one that includes reference_id
DO $$
BEGIN
  -- Try dropping the constraint by common names
  BEGIN
    ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_user_id_event_type_event_date_key;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_unique_key;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- New unique constraint includes reference_id (NULL = global event, non-NULL = per-task)
CREATE UNIQUE INDEX IF NOT EXISTS notification_events_dedup_idx
  ON notification_events (user_id, event_type, event_date, COALESCE(reference_id, '__global__'));

-- 3. Add event types we'll be using
COMMENT ON TABLE notification_events IS
  'Dedup log for push notifications. event_type values: morning, evening, overdue, reminder, streak_milestone, daily_summary, procrastination_alert';

-- 4. Ensure service role can bypass RLS for Edge Functions
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access" ON notification_events;
CREATE POLICY "service_role_full_access"
  ON notification_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for profiles (Edge Functions read/write push_token etc.)
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for task_instances
DROP POLICY IF EXISTS "service_role_full_access_instances" ON task_instances;
CREATE POLICY "service_role_full_access_instances"
  ON task_instances
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Same for tasks
DROP POLICY IF EXISTS "service_role_full_access_tasks" ON tasks;
CREATE POLICY "service_role_full_access_tasks"
  ON tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
