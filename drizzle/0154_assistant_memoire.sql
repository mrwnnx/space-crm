-- Assistant WhatsApp, étape 4 : il apprend.
--   lecon : une règle donnée par l'équipe (« ne dis jamais le soir ») — priorité absolue ;
--   style : le guide d'écriture tiré des vraies réponses de l'équipe.
-- (souvenir existait : question + réponse de l'équipe, à valider.)
ALTER TABLE ai_knowledge DROP CONSTRAINT IF EXISTS ai_knowledge_kind_check;
ALTER TABLE ai_knowledge ADD CONSTRAINT ai_knowledge_kind_check
  CHECK (kind IN ('texte', 'fichier', 'lien', 'souvenir', 'lecon', 'style'));
