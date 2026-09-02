-- Bannière commune à TOUS les emails : logo (ou image large) sur fond coloré,
-- avec une ligne de texte optionnelle. Un seul gabarit pour tout ce qui sort.
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS banner_bg text NOT NULL DEFAULT '#ffffff';
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS banner_image_url text;
ALTER TABLE email_branding ADD COLUMN IF NOT EXISTS banner_tagline text;
