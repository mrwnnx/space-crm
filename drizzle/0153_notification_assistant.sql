-- Assistant WhatsApp : quand il passe la main, une notification (la cloche)
-- mène à la conversation, où sa proposition attend d'être validée.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'assistant_escalade';
