-- Champs de formulaire qui n'avaient aucune colonne d'atterrissage :
-- ils ne survivaient que dans leads.raw_payload, donc invisibles dans la fiche.
--   motivation  = « علاش تحب تقرا معانا؟ » (textarea, formulaire d'inscription)
--   wants_call  = « تحب نتصلو بيك؟ / Souhaitez-vous être contacté » (radio OUI/NON, popup brochure)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivation text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS wants_call boolean;
