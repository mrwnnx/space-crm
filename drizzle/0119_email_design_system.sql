-- Configuration complète du design des emails, reprise de l'écran
-- « Default Configuration » de Tutor LMS.
-- Les couleurs de survol de Tutor ne sont PAS reprises : le survol n'existe
-- pas dans un client mail, ce seraient deux champs qui ne font rien.
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS logo_alt text;
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS logo_position text NOT NULL DEFAULT 'left';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS header_divider text NOT NULL DEFAULT '#e0e2ea';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS body_bg text NOT NULL DEFAULT '#ffffff';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS title_color text NOT NULL DEFAULT '#212327';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS text_color text NOT NULL DEFAULT '#5b616f';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS bold_color text NOT NULL DEFAULT '#212327';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS footnote_color text NOT NULL DEFAULT '#a4a8b2';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS primary_btn_text text NOT NULL DEFAULT '#ffffff';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS secondary_btn_bg text NOT NULL DEFAULT '#ffffff';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS secondary_btn_text text NOT NULL DEFAULT '#3e64de';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS secondary_btn_border text NOT NULL DEFAULT '#3e64de';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS button_position text NOT NULL DEFAULT 'left';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS sender_email text;
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS sender_name text;
