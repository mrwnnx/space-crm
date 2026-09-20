-- Audit perf du 2026-09-20 : six tables n'avaient que leur clé primaire alors
-- que chaque fiche lead les interroge par (reference_type, reference_id) —
-- `activities` : 64 455 seq scans pour 51 par index. Et `leads` (9 822 lignes)
-- se filtre par colonne et par formation sans index dédié.
-- CONCURRENTLY : aucun verrou, la prod continue de tourner pendant la création.
-- ⚠️ CONCURRENTLY refuse une transaction : appliquer ligne à ligne, pas dans un BEGIN.
set lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_ref_idx    ON activities    (reference_type, reference_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS call_logs_ref_idx     ON call_logs     (reference_type, reference_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS comments_ref_idx      ON comments      (reference_type, reference_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS notes_ref_idx         ON notes         (reference_type, reference_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_ref_idx ON notifications (reference_type, reference_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_ref_idx         ON tasks         (reference_type, reference_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_status_idx      ON leads (status_id);
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_bootcamp_idx    ON leads (bootcamp_id);
