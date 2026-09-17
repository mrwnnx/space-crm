-- Le statut de chaque WhatsApp envoyé : ✓ envoyé, ✓✓ livré, ✓✓ lu, ❌ échec.
--
-- Meta renvoie ces statuts par le webhook, identifiés par le `wamid` du
-- message. Jusqu'ici le CRM ne gardait pas ce wamid sur l'activité (seule
-- automation_runs le portait) : impossible de rattacher un statut à une bulle.
--
-- Table séparée plutôt que des colonnes sur `activities` — cf. 0129 : un
-- ALTER sur une table que tout le monde lit attend un verrou exclusif que les
-- sessions oisives du pooler ne rendent pas.
set lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  wamid text PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  -- sent | delivered | read | failed — on ne garde que le plus avancé, les
  -- statuts de Meta n'arrivent pas toujours dans l'ordre.
  status text NOT NULL DEFAULT 'sent',
  error text,
  updated_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS whatsapp_messages_activity_idx ON whatsapp_messages (activity_id);
