-- Report d'un lead non conclu vers la formation suivante.
-- On garde le LIEN vers la fiche d'origine plutôt que de recopier son
-- historique : la vérité reste à un seul endroit.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS carried_from_lead_id uuid REFERENCES leads(id);
CREATE INDEX IF NOT EXISTS leads_carried_from_idx ON leads (carried_from_lead_id)
  WHERE carried_from_lead_id IS NOT NULL;
