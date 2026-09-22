-- Ferme l'API REST publique de Supabase (PostgREST) sur le schéma public.
--
-- Constat du 22/09 : RLS désactivé sur les 52 tables et le rôle `anon` avait
-- tous les droits → la clé anon, livrée au navigateur, lisait et modifiait
-- toute la base (leads, wp_connection.app_password, allowed_emails…).
--
-- Le CRM n'est pas concerné : il passe par Drizzle avec le rôle `postgres`,
-- propriétaire des tables et BYPASSRLS. Aucun `supabase.from()` dans src/.
-- Storage (schéma `storage`) et Auth (schéma `auth`) ne sont pas touchés.
--
-- Un seul envoi = une seule transaction : tout passe ou rien ne passe.
-- Retour arrière : drizzle/0147_lock_public_api.rollback.sql

-- 1. RLS sur chaque table existante, sans policy = tout refusé à anon/authenticated.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- 2. Retirer les droits eux-mêmes (double verrou).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3. Les tables FUTURES créées par nos migrations (rôle postgres) naissent fermées.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
