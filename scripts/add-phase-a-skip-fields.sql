-- ============================================================
-- Phase A: Skip tracking fields on task_instances
-- ============================================================

ALTER TABLE task_instances
  ADD COLUMN IF NOT EXISTS skip_reason text,
  ADD COLUMN IF NOT EXISTS skip_note text,
  ADD COLUMN IF NOT EXISTS skip_action text
    CHECK (skip_action IN ('missed', 'rescheduled')),
  ADD COLUMN IF NOT EXISTS rescheduled_to date,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_task_instances_skip_action
  ON task_instances (user_id, skip_action, skipped_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_instances_rescheduled_to
  ON task_instances (user_id, rescheduled_to);
