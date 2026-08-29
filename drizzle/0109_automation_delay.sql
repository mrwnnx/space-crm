-- Envoi différé : l'automatisation peut attendre N minutes après l'entrée dans
-- la colonne. La file est vidée par /api/cron/automations (~toutes les 15 min).
ALTER TYPE automation_run_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE automation_run_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TABLE automations ADD COLUMN IF NOT EXISTS delay_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS scheduled_at timestamp;
CREATE INDEX IF NOT EXISTS automation_runs_pending_idx
  ON automation_runs (scheduled_at) WHERE status = 'pending';
