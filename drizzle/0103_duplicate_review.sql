-- Détection de doublons d'adresse email entre leads.
-- Rejouable sans dommage.

-- Mémorise que l'utilisateur a tranché sur ce lead ("c'est la même personne").
-- Sans cette colonne, le bandeau reviendrait à chaque visite après vérification,
-- et une alerte qu'on apprend à ignorer ne sert plus à rien.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_dismissed_at timestamp;

-- La détection cherche par email normalisé : sans index, elle scannerait
-- la table à chaque ouverture de fiche.
CREATE INDEX IF NOT EXISTS leads_email_lower_idx ON leads (lower(trim(email)));
