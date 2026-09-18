-- Campagnes : tags à NE PAS cibler. Une personne qui porte l'un d'eux sur
-- n'importe laquelle de ses fiches est retirée de la cible, même si elle a
-- aussi un tag ciblé. Les adresses saisies à la main ne sont pas concernées.
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS exclude_tag_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
