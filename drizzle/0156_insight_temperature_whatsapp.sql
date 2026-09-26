-- Lecture IA enrichie par le fil WhatsApp du numéro : une température PROPOSÉE
-- (appliquée seulement au clic sur « Appliquer »), sa preuve, l'action en
-- quelques mots, et les signaux WhatsApp calculés au moment de la lecture.
--
-- Toutes nullables : les 506 lectures existantes n'en ont pas, et l'écran
-- n'affiche rien tant qu'une relecture ne les a pas remplies.
-- Ajout pur, sans réécriture de la table (ADD COLUMN nullable sans défaut).
-- Retour arrière : ALTER TABLE lead_insights DROP COLUMN IF EXISTS … (×4).
ALTER TABLE lead_insights ADD COLUMN IF NOT EXISTS suggested_temperature temperature;
--> statement-breakpoint
ALTER TABLE lead_insights ADD COLUMN IF NOT EXISTS temperature_proof text;
--> statement-breakpoint
ALTER TABLE lead_insights ADD COLUMN IF NOT EXISTS next_action text;
--> statement-breakpoint
ALTER TABLE lead_insights ADD COLUMN IF NOT EXISTS wa_signals jsonb;
