-- Migration 001: Primo-Exercices business logic tables

ALTER TABLE exercices ADD COLUMN IF NOT EXISTS statut text DEFAULT 'draft'
  CHECK (statut IN ('draft','to_review','validated','published','archived'));
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS is_live_ready boolean DEFAULT false;
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS play_token text UNIQUE DEFAULT gen_random_uuid()::text;
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS exercise_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid REFERENCES exercices(id) ON DELETE CASCADE,
  learner_id uuid REFERENCES profiles(id),
  group_id uuid REFERENCES groups(id),
  assigned_by uuid REFERENCES profiles(id),
  context text CHECK (context IN ('autonomie','devoir','live','remediation')),
  due_date timestamptz, sequence_id uuid, session_id uuid,
  sync_status text DEFAULT 'local', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid REFERENCES exercices(id),
  assignment_id uuid REFERENCES exercise_assignments(id),
  learner_id uuid REFERENCES profiles(id),
  started_at timestamptz DEFAULT now(), completed_at timestamptz,
  time_spent_seconds int, status text DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','abandoned')),
  score_raw float, score_normalized float,
  answers jsonb, item_results jsonb, feedback_text text,
  live_session_ref text, created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text CHECK (direction IN ('from_main','to_main')),
  payload jsonb, status text, error_message text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE exercise_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formateur_assignments" ON exercise_assignments
  USING (assigned_by = auth.uid());

CREATE POLICY "learner_attempts" ON exercise_attempts
  USING (learner_id = auth.uid());

CREATE POLICY "anon_play_token" ON exercices
  FOR SELECT USING (play_token IS NOT NULL);
