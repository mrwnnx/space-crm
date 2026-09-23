-- Audit perf du 2026-09-22, lot 2 : quatre recherches relisaient la table entière.
--
-- contacts : la requête filtre sur lower(trim(coalesce(email, ''))) (queries.ts:1355)
-- alors que contacts_email_norm_idx porte sur lower(trim(email)) → jamais utilisé
-- (18 989 appels × 3,5 ms). Même chose pour mobile_no (2 503 × 5,7 ms). On indexe
-- l'expression EXACTE plutôt que de toucher au code de rapprochement.
-- leads.contact_id : 21 232 appels en parcours complet (duplicates.ts, queries.ts:1590).
-- stage_history.lead_id : aucun index hors clé primaire.
--
-- CONCURRENTLY : aucun verrou, la prod continue de tourner pendant la création.
-- Retour arrière : DROP INDEX CONCURRENTLY IF EXISTS <nom>; pour chacun.
set lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_email_coalesce_idx ON contacts ((lower(trim(coalesce(email, '')))));
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS contacts_mobile_coalesce_idx ON contacts ((lower(trim(coalesce(mobile_no, '')))));
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_contact_id_idx ON leads (contact_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS stage_history_lead_id_idx ON stage_history (lead_id);
