-- Archivage d'une formation : la retire de la liste sans rien détruire.
-- NULL = active. Une date = archivée.
--
-- Volontairement séparé de `status` : `completed`/`cancelled` décrivent le cycle
-- de vie de la formation, l'archivage décrit ce qu'on veut VOIR. Une formation
-- terminée peut rester affichée, une formation ouverte peut être rangée.
--
-- ⚠️ RÈGLE D'OR : appliquer À LA MAIN dans le Supabase SQL Editor, vérifier,
-- PUIS pousser le code (./deploy.sh --allow-schema "...").

ALTER TABLE bootcamps ADD COLUMN IF NOT EXISTS archived_at timestamp;
