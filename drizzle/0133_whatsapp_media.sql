-- Les pièces jointes WhatsApp : photos, vidéos, PDF, vocaux, stickers.
--
-- Meta ne garde un média que 30 jours et son URL de téléchargement 5 minutes :
-- on le rapatrie à la réception dans le bucket public `whatsapp-media`, et on
-- garde ici le chemin, le type et l'URL à afficher. Une ligne par bulle.
set lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS whatsapp_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- image | video | audio | document | sticker
  mime_type text,
  url text NOT NULL,            -- URL publique du bucket, prête à afficher
  storage_path text NOT NULL,
  filename text,                -- nom d'origine, pour les documents
  size integer,
  created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS whatsapp_media_activity_idx ON whatsapp_media (activity_id);
