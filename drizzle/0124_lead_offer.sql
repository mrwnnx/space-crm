-- L'offre NEGOCIEE avec ce lead, distincte du tarif catalogue de la formation.
-- Jusqu'ici les montants ne se saisissaient qu'a l'inscription : avant, on ne
-- pouvait choisir QUE le type de plan (total / mensuel), jamais les montants.
-- Un lead a qui on accorde -20 % trois semaines avant de s'inscrire n'avait
-- donc aucun endroit ou le noter.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS offer_total numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS offer_monthly_count integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS offer_monthly_amount numeric;
