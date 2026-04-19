-- ============================================================
-- Push Notification System — Cron Jobs + Database Trigger
-- ============================================================
-- Run this AFTER deploying the Edge Functions.
-- Requires pg_cron and pg_net extensions (enable in Supabase Dashboard).
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ==================== REMOVE OLD CRON ====================
-- Clean up the old combined notification-cron job if it exists
SELECT cron.unschedule('notification-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notification-cron'
);

-- ==================== CRON 1: check-reminders (every 15 min) ====================
SELECT cron.schedule(
  'check-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 2: check-overdue (every hour) ====================
SELECT cron.schedule(
  'check-overdue',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-overdue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 3: check-streaks-at-risk (every hour) ====================
SELECT cron.schedule(
  'check-streaks-at-risk',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-streaks-at-risk',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 4: send-daily-summary (every hour) ====================
SELECT cron.schedule(
  'send-daily-summary',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-daily-summary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== TRIGGER: on-task-completed (database webhook) ====================

-- Function that fires when a task_instance is updated to "completed"
CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS trigger AS $$
BEGIN
  -- Only fire when status changes TO "completed"
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/on-task-completed',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'UPDATE',
        'record', row_to_json(NEW),
        'old_record', row_to_json(OLD)
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_task_instance_completed ON task_instances;

-- Create the trigger
CREATE TRIGGER on_task_instance_completed
  AFTER UPDATE ON task_instances
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_completed();

-- ==================== VERIFY ====================
-- Run this to see all scheduled jobs:
-- SELECT * FROM cron.job;
