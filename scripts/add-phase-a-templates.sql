-- ============================================================
-- Phase A: Templates foundation (Option B - Supabase backed)
-- ============================================================

-- Templates catalog (system-managed for now)
CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  task_type text NOT NULL CHECK (task_type IN ('one_time', 'recurring', 'challenge')),
  category text NOT NULL,
  tag text NOT NULL,
  icon text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user usage tracking for ranking/recommendations
CREATE TABLE IF NOT EXISTS user_template_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_templates_active_type
  ON task_templates (is_active, task_type, category, sort_order);

CREATE INDEX IF NOT EXISTS idx_user_template_usage_user_time
  ON user_template_usage (user_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_template_usage_template
  ON user_template_usage (template_id);

-- RLS
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_template_usage ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active templates.
DROP POLICY IF EXISTS "templates_select_active" ON task_templates;
CREATE POLICY "templates_select_active"
  ON task_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Users can only access their own usage rows.
DROP POLICY IF EXISTS "template_usage_select_own" ON user_template_usage;
CREATE POLICY "template_usage_select_own"
  ON user_template_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "template_usage_insert_own" ON user_template_usage;
CREATE POLICY "template_usage_insert_own"
  ON user_template_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "template_usage_update_own" ON user_template_usage;
CREATE POLICY "template_usage_update_own"
  ON user_template_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "template_usage_delete_own" ON user_template_usage;
CREATE POLICY "template_usage_delete_own"
  ON user_template_usage
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
