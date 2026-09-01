-- Retrait de tout l'envoi automatique d'emails.
-- Mesuré avant suppression : sequences=1, sequence_steps=2, enrollments=0,
-- sends=0, automations=0, automation_runs=0 — aucun email n'est jamais parti.
-- Les campagnes et les envois 1-à-1 depuis une fiche ne sont pas touchés.
DROP TABLE IF EXISTS sequence_sends CASCADE;
DROP TABLE IF EXISTS sequence_enrollments CASCADE;
DROP TABLE IF EXISTS sequence_steps CASCADE;
DROP TABLE IF EXISTS sequences CASCADE;
DROP TABLE IF EXISTS automation_runs CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TYPE IF EXISTS sequence_trigger;
DROP TYPE IF EXISTS sequence_step_condition;
DROP TYPE IF EXISTS sequence_enrollment_status;
DROP TYPE IF EXISTS automation_run_status;
