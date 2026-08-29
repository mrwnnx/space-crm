-- Habillage commun des emails : en-tête (logo) + pied de page, appliqué à tous
-- les envois. Table à ligne unique, même motif que wp_connection.
CREATE TABLE IF NOT EXISTS email_branding (
  id boolean PRIMARY KEY DEFAULT true,
  logo_url text,
  logo_width integer NOT NULL DEFAULT 150,
  footer_text text,
  accent_color text NOT NULL DEFAULT '#1a1a1a',
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT email_branding_single_row CHECK (id)
);
