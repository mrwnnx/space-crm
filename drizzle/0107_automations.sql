-- Automatisations : « quand un lead entre dans cette colonne, envoyer ce modèle d'email ».
-- Les trois chemins d'entrée (kanban, popup d'inscription, import) déclenchent la même règle.

DO $$ BEGIN
  CREATE TYPE automation_run_status AS ENUM ('sent', 'skipped', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES lead_statuses(id) ON DELETE CASCADE,
  email_template_id uuid NOT NULL REFERENCES email_templates(id),
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Journal de toutes les tentatives (envoyé / ignoré / échoué) : sans lui, un
-- envoi refusé par Resend disparaîtrait sans laisser de trace.
CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status automation_run_status NOT NULL,
  reason text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_status_active_idx ON automations(status_id) WHERE active;
CREATE INDEX IF NOT EXISTS automation_runs_automation_idx ON automation_runs(automation_id);
