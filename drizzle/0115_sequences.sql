DO $$ BEGIN
  CREATE TYPE sequence_trigger AS ENUM ('lead_created', 'enters_status', 'tag_added');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE step_condition AS ENUM ('none', 'clicked', 'not_clicked', 'not_moved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'done', 'exited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger sequence_trigger NOT NULL,
  trigger_status_id uuid,
  trigger_tag_id uuid,
  active boolean NOT NULL DEFAULT false,
  send_from_hour integer NOT NULL DEFAULT 9,
  send_to_hour integer NOT NULL DEFAULT 20,
  daily_cap integer NOT NULL DEFAULT 40,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  position integer NOT NULL,
  delay_hours integer NOT NULL DEFAULT 24,
  email_template_id uuid NOT NULL REFERENCES email_templates(id),
  condition step_condition NOT NULL DEFAULT 'none',
  condition_on_step_id uuid,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  exit_reason text,
  current_step integer NOT NULL DEFAULT 0,
  next_run_at timestamp,
  status_at_enrollment uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT sequence_enrollment_unique PRIMARY KEY (sequence_id, lead_id)
);

CREATE TABLE IF NOT EXISTS sequence_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL,
  step_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  resend_id text,
  sent_at timestamp NOT NULL DEFAULT now(),
  opened_at timestamp,
  clicked_at timestamp
);

CREATE INDEX IF NOT EXISTS sequence_sends_resend_idx ON sequence_sends (resend_id);
CREATE INDEX IF NOT EXISTS sequence_enrollments_due_idx
  ON sequence_enrollments (next_run_at) WHERE status = 'active';
