-- Automatisation d'une colonne : « un lead entre dans cette colonne » → un email.
--
-- Recrée ce qui avait été retiré le 2026-09-01 (0116_drop_automations_sequences),
-- avec DEUX garde-fous nouveaux, demandés explicitement :
--   1. une colonne = au plus UNE règle ;
--   2. jamais deux fois le même email au même lead.

DO $$ BEGIN
  CREATE TYPE automation_run_status AS ENUM ('pending','sent','skipped','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bootcamp_id uuid NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
  -- Supprimer la colonne supprime la règle : une règle qui pointe vers une
  -- colonne disparue ne se déclencherait jamais.
  status_id uuid NOT NULL REFERENCES lead_statuses(id) ON DELETE CASCADE,
  email_template_id uuid NOT NULL REFERENCES email_templates(id),
  -- 0 = envoi immédiat. Sinon l'envoi passe par la file, vidée toutes les
  -- ~15 min : la précision est au quart d'heure, jamais à la minute.
  delay_minutes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Une colonne = au plus une règle.
CREATE UNIQUE INDEX IF NOT EXISTS automations_status_unique ON automations(status_id);

-- Journal de TOUTES les tentatives, y compris ignorées et échouées : sans lui,
-- un envoi refusé par Resend disparaîtrait sans trace.
CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status automation_run_status NOT NULL,
  reason text,
  -- Échéance d'un envoi différé. NULL = envoi immédiat.
  scheduled_at timestamp,
  -- Date d'envoi RÉELLE. Distincte de created_at, qui est la date de mise en
  -- file : sans elle, le plafond quotidien compterait un envoi différé au jour
  -- où il a été programmé, pas au jour où il est parti.
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Jamais deux fois le même email au même lead : filet en base, en plus du
-- contrôle applicatif. 'pending' est inclus pour qu'une seconde entrée dans la
-- colonne n'empile pas un second envoi en attente. Un run 'cancelled' ou
-- 'skipped' n'empêche rien : cet email-là n'est jamais parti.
CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_once
  ON automation_runs(automation_id, lead_id)
  WHERE status IN ('sent','pending');

CREATE INDEX IF NOT EXISTS automation_runs_due
  ON automation_runs(scheduled_at) WHERE status = 'pending';
