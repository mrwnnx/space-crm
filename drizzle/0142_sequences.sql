-- Séquences : une colonne peut porter PLUSIEURS messages, chacun à son moment
-- (« J+3 à 18 h », heure de Tunis). Revient sur « une colonne = une règle »
-- (0120) sans ressusciter les séquences supprimées le 2026-09-01 : la règle de
-- colonne reste l'unité, il y en a juste plusieurs.
set lock_timeout = '5s';
--> statement-breakpoint
DROP INDEX IF EXISTS automations_status_unique;
--> statement-breakpoint
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS delay_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS at_hour integer;
--> statement-breakpoint
-- Dernier modèle MARKETING parti vers cette personne : 1 par 24 h (règle Meta
-- et garde du numéro), automatisation ou envoi 1-à-1 confondus.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_last_at timestamp;
