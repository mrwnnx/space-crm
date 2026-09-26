-- Les numéros « testeurs » de l'assistant WhatsApp, réglés depuis le CRM
-- (Paramètres → WhatsApp → Assistant IA) plutôt que sur Vercel : il leur
-- répond seul même en mode répétition.
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS ai_testers text NOT NULL DEFAULT '';
