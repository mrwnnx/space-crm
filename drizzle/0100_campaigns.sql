-- Campagnes email — T1
-- À APPLIQUER À LA MAIN dans le Supabase SQL Editor AVANT tout push (règle d'or DB).
-- Rejouable sans dommage.

-- ── 1. contacts : désabonnement ────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unsubscribe_token text;

-- Token stable par contact, généré pour l'existant avant de passer en NOT NULL.
UPDATE contacts
   SET unsubscribe_token = gen_random_uuid()::text
 WHERE unsubscribe_token IS NULL;

-- DEFAULT indispensable : sans lui, toute création de contact (nouveau lead,
-- webhook Elementor, import CSV) violerait le NOT NULL.
ALTER TABLE contacts ALTER COLUMN unsubscribe_token SET DEFAULT gen_random_uuid()::text;
ALTER TABLE contacts ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_unsubscribe_token_key
    ON contacts (unsubscribe_token);

-- ── 2. campaigns ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  subject        text,
  content        text NOT NULL DEFAULT '',
  -- draft | scheduled | sending | sent | failed
  status         text NOT NULL DEFAULT 'draft',
  target_tag_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_emails  jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at   timestamp,
  sent_at        timestamp,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);

-- ── 3. campaign_recipients ─────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  -- SET NULL : supprimer un contact ne doit pas effacer la trace d'un envoi.
  contact_id  uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email       text NOT NULL,
  -- pending | sent | failed | skipped
  status      text NOT NULL DEFAULT 'pending',
  resend_id   text,
  error       text,
  sent_at     timestamp,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- Garde-fou anti-doublon : une adresse ne peut être servie qu'une fois par
-- campagne, même si l'envoi est repris après interruption.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_campaign_email_key
    ON campaign_recipients (campaign_id, lower(email));

CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_status_idx
    ON campaign_recipients (campaign_id, status);
