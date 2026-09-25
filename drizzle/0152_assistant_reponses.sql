-- Assistant WhatsApp, étape 2 : chaque message reçu traité par l'assistant —
-- sa réponse proposée, sa note, et ce qui en a été fait.
CREATE TABLE IF NOT EXISTS ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  inbound_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL,
  question text NOT NULL,
  draft text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  -- pret (note ≥ seuil) | escalade (humain) | ignore (robot, bouton…)
  decision text NOT NULL,
  raisons text NOT NULL DEFAULT '',
  -- ce qui est parti réellement (numéros de test en répétition, ou mode auto)
  sent_text text,
  sent_wamid text,
  -- ce qu'un humain a finalement répondu (étape 4 : souvenirs)
  human_reply text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_replies_lead_idx ON ai_replies (lead_id, created_at DESC);
ALTER TABLE ai_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ai_replies FROM anon, authenticated;
