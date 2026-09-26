-- Banque de questions (26/09) : ce que l'assistant n'a pas su, en attente
-- de la réponse de l'équipe (status a_valider), puis converti en « texte ».
ALTER TABLE ai_knowledge DROP CONSTRAINT IF EXISTS ai_knowledge_kind_check;
ALTER TABLE ai_knowledge ADD CONSTRAINT ai_knowledge_kind_check
  CHECK (kind IN ('texte', 'fichier', 'lien', 'souvenir', 'lecon', 'style', 'question'));
