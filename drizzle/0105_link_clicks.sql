-- Liens cliqués dans une campagne.
-- L'événement email.clicked de Resend porte l'URL — elle était jetée.
-- Rejouable sans dommage.

CREATE TABLE IF NOT EXISTS campaign_link_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  -- SET NULL : supprimer un destinataire ne doit pas effacer le fait qu'un
  -- lien a été cliqué — l'agrégat par URL reste vrai.
  recipient_id uuid REFERENCES campaign_recipients(id) ON DELETE SET NULL,
  url          text NOT NULL,
  clicked_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_link_clicks_campaign_idx
    ON campaign_link_clicks (campaign_id);
