-- Lecture IA d'un lead : résumé, intention, objection probable.
DO $$ BEGIN
  CREATE TYPE lead_intent AS ENUM ('serieux', 'curieux', 'hors_cible', 'indetermine');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS lead_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  summary text NOT NULL,
  intent lead_intent NOT NULL,
  objection text,
  source_hash text NOT NULL,
  model text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
