-- Bouton principal d'un modèle, piloté par un interrupteur (les boutons
-- supplémentaires restent dans le contenu, en [[Texte]](url) inséré au curseur).
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_label text;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_url text;
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS button_position text NOT NULL DEFAULT 'bottom';
