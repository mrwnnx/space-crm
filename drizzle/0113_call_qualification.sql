-- Qualification commerciale après appel + date de rappel.
-- L'historique complet reste dans call_logs et activities ; ces colonnes
-- portent l'ÉTAT COURANT, celui qui pilote la file du jour.
DO $$ BEGIN
  CREATE TYPE lead_qualification AS ENUM
    ('chaud', 'tiede', 'froid', 'pas_serieux', 'hors_cible', 'reporte');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification lead_qualification;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at timestamp;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at timestamp;

CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx
  ON leads (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
