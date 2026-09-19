-- Consentement WhatsApp sur la PERSONNE (contacts), pas sur la fiche : c'est
-- elle qui a coché la case, quelle que soit la formation. Meta exige la preuve
-- (date, où, quel texte) avant tout premier message — cf. règles Meta.
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at timestamp,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_source text,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_text text;
