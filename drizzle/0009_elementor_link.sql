-- Lien formation ↔ formulaire Elementor (pull par API, pas webhook).
-- Une formation peut avoir PLUSIEURS formulaires,
-- mais un formulaire n'alimente QU'UNE formation → index unique partiel.
--
-- ⚠️ RÈGLE D'OR : appliquer À LA MAIN dans le Supabase SQL Editor, vérifier,
-- PUIS pousser le code (./deploy.sh --allow-schema "...").

ALTER TABLE form_sources ADD COLUMN IF NOT EXISTS elementor_form_id text;
ALTER TABLE form_sources ADD COLUMN IF NOT EXISTS last_submission_id integer;

-- La contrainte ne porte que sur les liens ACTIFS : délier (active=false)
-- libère le formulaire pour une autre formation.
CREATE UNIQUE INDEX IF NOT EXISTS form_sources_elementor_form_active_key
  ON form_sources (elementor_form_id)
  WHERE elementor_form_id IS NOT NULL AND active = true;
