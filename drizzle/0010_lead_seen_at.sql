-- Marqueur « non traité » sur un lead.
-- NULL = jamais ouvert. Rempli à la première ouverture de la fiche.
-- Remplace la règle des 24 h, qui s'éteignait toute seule même sans action.
--
-- ⚠️ RÈGLE D'OR : appliquer À LA MAIN dans le Supabase SQL Editor, vérifier,
-- PUIS pousser le code (./deploy.sh --allow-schema "...").

ALTER TABLE leads ADD COLUMN IF NOT EXISTS seen_at timestamp;

-- Reprise de l'existant : sans ça, TOUS les leads (y compris ceux de juin,
-- évidemment déjà traités) ressortiraient en « non traité ».
-- On marque comme vus ceux qui n'ont pas été importés, et ceux importés il y a
-- plus de 24 h — ce qui laisse flaggés exactement les leads aujourd'hui
-- surlignés par l'ancienne règle. La transition est donc invisible à l'écran.
UPDATE leads
SET seen_at = now()
WHERE seen_at IS NULL
  AND (form_source_id IS NULL OR created_at < now() - interval '24 hours');
