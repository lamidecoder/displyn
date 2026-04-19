-- ============================================================
-- Run this SQL in the Supabase Dashboard > SQL Editor
-- This adds the notification columns to the profiles table
-- and creates the cron job for the notification Edge Function
-- ============================================================

-- 1. Add notification columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS morning_reminder_time text DEFAULT '09:00';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS evening_reminder_time text DEFAULT '20:00';

-- 2. Enable the pg_cron extension (if not already enabled)
-- Go to Supabase Dashboard > Database > Extensions > search "pg_cron" > Enable it
-- Then run:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule the notification cron to run every 30 minutes
-- This calls your notification-cron Edge Function
SELECT cron.schedule(
  'notification-cron',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/notification-cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 4. (Optional) If you also want to schedule midnight-cron, uncomment:
-- SELECT cron.schedule(
--   'midnight-cron',
--   '0 * * * *',
--   $$
--   SELECT
--     net.http_post(
--       url := 'https://kskvwbamxvurxjryfqkn.supabase.co/functions/v1/midnight-cron',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--   $$
-- );

-- 5. Verify cron jobs are scheduled
SELECT * FROM cron.job;
