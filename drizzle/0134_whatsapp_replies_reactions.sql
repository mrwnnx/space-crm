-- Lot D — répondre à un message précis, réagir, réponses rapides.
--
-- 1. whatsapp_messages garde désormais AUSSI les messages reçus (status
--    'received') : sans leur wamid, impossible de citer un message du lead ni
--    d'y réagir. `reply_to_wamid` = le message cité ; `reaction_lead` = la
--    réaction du lead sur notre message ; `reaction_us` = la nôtre sur le sien.
--    (Table créée aujourd'hui, personne d'autre ne la lit : l'ALTER est sûr.)
-- 2. whatsapp_quick_replies : les textes prêts, tapés avec « / » dans la zone
--    de réponse, comme les réponses rapides de l'app WhatsApp Business.
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS reply_to_wamid text,
  ADD COLUMN IF NOT EXISTS reaction_lead text,
  ADD COLUMN IF NOT EXISTS reaction_us text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL UNIQUE,   -- ce qu'on tape après « / », ex. « prix »
  text text NOT NULL,              -- peut contenir {{firstName}} et {{formation}}
  created_at timestamp NOT NULL DEFAULT now()
);
