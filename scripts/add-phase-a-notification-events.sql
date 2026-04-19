-- ============================================================
-- Phase A: Notification event dedupe tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, event_date)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_user_date
  ON notification_events (user_id, event_date DESC);

-- RLS
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_events_select_own" ON notification_events;
CREATE POLICY "notification_events_select_own"
  ON notification_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notification_events_insert_own" ON notification_events;
CREATE POLICY "notification_events_insert_own"
  ON notification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
