-- ============================================================
-- Phase A: Calendar two-way sync linkage tables
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'apple', 'local', 'other')),
  calendar_id text NOT NULL,
  calendar_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  allow_external_delete boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, calendar_id)
);

CREATE TABLE IF NOT EXISTS calendar_event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  external_event_id text NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  sync_state text NOT NULL DEFAULT 'linked'
    CHECK (sync_state IN ('linked', 'conflict', 'deleted_external', 'deleted_local')),
  external_updated_at timestamptz,
  local_updated_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, calendar_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user_enabled
  ON calendar_connections (user_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_calendar_event_links_user_task
  ON calendar_event_links (user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_calendar_event_links_user_state
  ON calendar_event_links (user_id, sync_state);

-- RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_connections_select_own" ON calendar_connections;
CREATE POLICY "calendar_connections_select_own"
  ON calendar_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_connections_insert_own" ON calendar_connections;
CREATE POLICY "calendar_connections_insert_own"
  ON calendar_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_connections_update_own" ON calendar_connections;
CREATE POLICY "calendar_connections_update_own"
  ON calendar_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_connections_delete_own" ON calendar_connections;
CREATE POLICY "calendar_connections_delete_own"
  ON calendar_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_event_links_select_own" ON calendar_event_links;
CREATE POLICY "calendar_event_links_select_own"
  ON calendar_event_links
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_event_links_insert_own" ON calendar_event_links;
CREATE POLICY "calendar_event_links_insert_own"
  ON calendar_event_links
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_event_links_update_own" ON calendar_event_links;
CREATE POLICY "calendar_event_links_update_own"
  ON calendar_event_links
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "calendar_event_links_delete_own" ON calendar_event_links;
CREATE POLICY "calendar_event_links_delete_own"
  ON calendar_event_links
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
