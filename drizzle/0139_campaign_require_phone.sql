-- Campagnes : « seulement ceux qui ont un numéro de téléphone ». Filtre de
-- qualité sur la PERSONNE (contacts.mobile_no) : une adresse importée sans
-- numéro est souvent morte, et un contact joignable se rappelle après l'email.
set lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS require_phone boolean NOT NULL DEFAULT false;
