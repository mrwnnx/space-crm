-- Les réglages du service WhatsApp — table à ligne unique, même motif que
-- email_branding et wp_connection.
--
-- `ai_reply_enabled` : l'interrupteur de la réponse automatique par IA. Il
-- existe AVANT la réponse elle-même (lot 3) pour que celle-ci n'ait qu'à le
-- lire — et pour que Marwen puisse l'éteindre d'un clic le jour venu.
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id boolean PRIMARY KEY DEFAULT true,
  ai_reply_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_settings_single_row CHECK (id)
);
