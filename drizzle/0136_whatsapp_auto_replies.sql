-- Lot F — message de bienvenue et message d'absence, comme dans l'app
-- WhatsApp Business. Texte fixe, sans IA (l'IA, c'est ai_reply_enabled).
--
-- Bienvenue : au PREMIER message d'un numéro (aucun message reçu avant).
-- Absence : hors des horaires ci-dessous, au plus une fois par 24 h par
-- conversation. Les horaires sont en heure de Tunis ; `away_days` liste les
-- jours ouvrés en ISO (1 = lundi … 7 = dimanche).
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS welcome_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS away_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS away_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS away_start integer NOT NULL DEFAULT 9,
  ADD COLUMN IF NOT EXISTS away_end integer NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS away_days text NOT NULL DEFAULT '1,2,3,4,5';
