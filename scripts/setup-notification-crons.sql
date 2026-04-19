-- ============================================================
-- Push Notification System — Cron Jobs + Database Trigger
-- ============================================================
-- Run this in Supabase SQL Editor AFTER deploying the Edge Functions.
--
-- Prerequisites:
-- 1. Enable pg_cron: Dashboard > Database > Extensions > pg_cron > Enable
-- 2. Enable pg_net:  Dashboard > Database > Extensions > pg_net  > Enable
-- 3. Deploy Edge Functions via: npx supabase functions deploy
-- 4. Run the migration SQL (20260214200000_push_notification_system.sql) first
-- ============================================================

-- ==================== REMOVE OLD CRONS ====================
-- Remove the old combined notification-cron if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('notification-cron');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-overdue');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-streaks-at-risk');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('send-daily-summary');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ==================== CRON 1: check-reminders (every 15 min) ====================
-- Finds tasks due within user's reminder window and sends a heads-up push.
SELECT cron.schedule(
  'check-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/check-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 2: check-overdue (every hour at :00) ====================
-- Sends up to 3 overdue task notifications per user during waking hours.
SELECT cron.schedule(
  'check-overdue',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/check-overdue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 3: check-streaks-at-risk (every hour at :00) ====================
-- At each user's evening reminder hour, warns if streak is at risk (0 tasks done today).
SELECT cron.schedule(
  'check-streaks-at-risk',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/check-streaks-at-risk',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== CRON 4: send-daily-summary (every hour at :00) ====================
-- At each user's daily summary hour, sends a completion summary for the day.
SELECT cron.schedule(
  'send-daily-summary',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/send-daily-summary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ==================== DATABASE TRIGGER: on-task-completed ====================
-- Fires when a task_instance status changes to "completed".
-- Calls the on-task-completed Edge Function to check for streak milestones.

CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM net.http_post(
      url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/on-task-completed',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
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

DROP TRIGGER IF EXISTS on_task_instance_completed ON task_instances;

CREATE TRIGGER on_task_instance_completed
  AFTER UPDATE ON task_instances
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_completed();

-- ==================== VERIFY ====================
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
