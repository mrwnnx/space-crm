-- Un tap sur un bouton de modèle fait quelque chose dans le CRM : tag (le
-- segment), réponse libre dans la fenêtre ouverte par le tap, tâche d'appel
-- avec le créneau choisi, ou désabonnement. Une ligne par (modèle, bouton).
set lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS whatsapp_button_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  button_text text NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  reply_text text,
  -- now | evening | tomorrow : le créneau demandé pour un rappel téléphonique.
  call_slot text,
  opt_out boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (template, button_text)
);
--> statement-breakpoint
-- Le modèle envoyé, sur la bulle : c'est ce qui permet de savoir à QUEL
-- modèle un bouton répond (le webhook donne le wamid cité, pas le nom).
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS template text;
