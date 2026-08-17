-- Suivi des ouvertures et des clics (décision de Marwen, 2026-08-17).
-- Rejouable sans dommage.

-- On garde la PREMIÈRE date (quand la personne a réagi) ET un compteur
-- (combien de fois) : une seule des deux valeurs perdrait de l'information.
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS opened_at timestamp;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS clicked_at timestamp;
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- Délivrance réellement constatée, à distinguer de « pas de rebond signalé ».
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS delivered_at timestamp;
