-- Digest quotidien : une ligne par jour envoyé. L'unicité de la date est la
-- garantie d'idempotence — le cron peut taper toutes les 15 min sans doublon.
CREATE TABLE IF NOT EXISTS digest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_on date NOT NULL UNIQUE,
  recipients integer NOT NULL DEFAULT 0,
  leads_listed integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
