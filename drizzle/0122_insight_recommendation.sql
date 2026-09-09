-- La recommandation ecrite par l'IA : « ce que je ferais a ta place ».
-- Distincte de `objection` (le frein constate) : celle-ci dit quoi FAIRE.
-- Nullable : les analyses deja faites n'en ont pas, et l'ecran affiche alors
-- la recommandation deduite des faits, qui ne depend d'aucune cle API.
ALTER TABLE lead_insights ADD COLUMN IF NOT EXISTS recommendation text;
