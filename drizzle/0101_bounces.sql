-- Rebonds Resend — apprend au CRM ce qui n'a PAS été délivré.
-- Rejouable sans dommage.

-- Un rebond dur appartient à l'adresse, pas à une campagne : il doit valoir
-- pour toutes les campagnes futures, comme le désabonnement.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bounced_at timestamp;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bounce_reason text;

-- campaign_recipients.status accepte désormais aussi 'bounced' et 'complained'
-- (colonne text libre, pas d'enum à faire évoluer).
CREATE INDEX IF NOT EXISTS campaign_recipients_resend_id_idx
    ON campaign_recipients (resend_id);
