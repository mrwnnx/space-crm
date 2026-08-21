-- Désinscriptions attribuées à la campagne qui les a déclenchées.
-- Rejouable sans dommage.

-- Sur le DESTINATAIRE, pas sur le contact : « combien de désinscriptions
-- cette campagne a-t-elle provoquées » est une question par campagne.
-- `contacts.unsubscribed_at` continue de dire QUE la personne est désabonnée.
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp;
