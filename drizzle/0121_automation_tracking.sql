-- Rattacher les evenements Resend (delivre / ouvert / clique) aux emails
-- d'automatisation. Sans `resend_id`, le webhook ne sait pas ou ranger un
-- evenement d'automatisation : il le jette en silence.
-- Meme mecanique que `campaign_recipients`, deja eprouvee.
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS resend_id text;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS delivered_at timestamp;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS opened_at timestamp;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS clicked_at timestamp;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- Le webhook cherche par cet identifiant a chaque evenement.
CREATE INDEX IF NOT EXISTS automation_runs_resend_id_idx ON automation_runs (resend_id);

-- Un clic = une ligne. Agreger par URL repond a « quel lien a marche ».
CREATE TABLE IF NOT EXISTS automation_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES automation_runs(id) ON DELETE SET NULL,
  url text NOT NULL,
  clicked_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_link_clicks_automation_idx
  ON automation_link_clicks (automation_id);
