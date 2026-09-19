-- Opt-out WhatsApp (STOP) et coupe-circuits Meta — cf. règles Meta.
-- contacts : la personne a demandé l'arrêt ; Meta limite le marketing vers elle
-- (131049) jusqu'à une date. automations : pourquoi une règle s'est arrêtée
-- toute seule (modèle mis en pause / désactivé / refusé par Meta).
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_unsubscribed_at timestamp,
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_limited_until timestamp;
--> statement-breakpoint
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS paused_reason text;
