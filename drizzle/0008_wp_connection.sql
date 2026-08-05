-- Connexion WordPress (thespace.academy) — table à ligne unique.
-- ⚠️ RÈGLE D'OR : appliquer CE SQL À LA MAIN dans le Supabase SQL Editor,
-- vérifier, PUIS pousser le code (./deploy.sh --allow-schema "...").

CREATE TABLE IF NOT EXISTS wp_connection (
  id                boolean PRIMARY KEY DEFAULT true,
  site_url          text NOT NULL,
  username          text NOT NULL,
  app_password      text NOT NULL,
  last_tested_at    timestamp,
  last_test_ok      boolean,
  last_test_message text,
  updated_at        timestamp NOT NULL DEFAULT now(),
  CONSTRAINT wp_connection_singleton CHECK (id)
);
