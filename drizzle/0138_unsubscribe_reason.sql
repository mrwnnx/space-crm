-- Pourquoi les gens se désabonnent. La raison est demandée APRÈS le
-- désabonnement (jamais avant : il doit être immédiat), et répondre est
-- facultatif. Sur campaign_recipients = la raison attribuée à la campagne
-- d'origine (ce que les stats comptent) ; sur contacts = la dernière raison
-- connue, campagne ou pas (automatisations, un clic Gmail).
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS unsubscribe_reason text,
  ADD COLUMN IF NOT EXISTS unsubscribe_note text;
--> statement-breakpoint
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS unsubscribe_reason text,
  ADD COLUMN IF NOT EXISTS unsubscribe_note text;
