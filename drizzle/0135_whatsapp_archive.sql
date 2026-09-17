-- Lot E — archiver une conversation. NULL = visible ; une date = rangée dans
-- « Archivées ». Un message reçu la désarchive, comme dans WhatsApp.
-- (Table du 2026-09-16, lue par le seul code WhatsApp : l'ALTER est sûr.)
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS archived_at timestamp;
