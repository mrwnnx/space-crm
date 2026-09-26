-- Les codes promo gérés dans le CRM (26/09). Jusqu'ici, leads.promo_code n'était
-- qu'un texte libre tapé par le lead (« SPACE 20 », « space20 », « WAJAHNI »…) :
-- impossible de savoir quel code rapporte, ni ce qu'il vaut.
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,              -- normalisé : majuscules, sans espace ni tiret
  label text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',        -- d'où viennent ses leads (Instagram, partenaire…)
  remise_total_pct numeric,               -- remise sur le paiement en une fois
  remise_facilite_pct numeric,            -- vide = pas valable en paiement facilité
  valid_from date,
  valid_until date,
  bootcamp_ids jsonb NOT NULL DEFAULT '[]', -- vide = toutes les formations
  assistant_peut_proposer boolean NOT NULL DEFAULT false,
  actif boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON promo_codes FROM anon, authenticated;

-- Le code reconnu (le texte tapé reste dans leads.promo_code).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_promo_code_id_idx ON leads (promo_code_id) WHERE promo_code_id IS NOT NULL;
