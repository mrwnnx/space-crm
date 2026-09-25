-- Assistant WhatsApp (lot 3), étape 1 : le savoir et les réglages.
--
-- ai_knowledge : ce qu'on donne à l'IA — texte, fichier (texte extrait),
-- lien (texte de la page), souvenir (réponse humaine validée, étape 4).
-- Seul le texte est gardé : pas de fichier binaire à stocker.

ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS ai_mode text NOT NULL DEFAULT 'off'
    CHECK (ai_mode IN ('off', 'repetition', 'auto')),
  ADD COLUMN IF NOT EXISTS ai_threshold integer NOT NULL DEFAULT 90
    CHECK (ai_threshold BETWEEN 50 AND 100),
  ADD COLUMN IF NOT EXISTS ai_instructions text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('texte', 'fichier', 'lien', 'souvenir')),
  title text NOT NULL,
  content text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'a_valider', 'archive')),
  created_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Même verrou que toutes les tables (0147) : fermée à l'API publique.
ALTER TABLE ai_knowledge ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_knowledge FROM anon, authenticated;
