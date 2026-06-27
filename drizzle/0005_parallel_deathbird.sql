-- Migration 0005 — Phase 3a : flag possibleDuplicate sur contacts (fix dédup P2)
-- Idempotente.
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "possible_duplicate" boolean DEFAULT false NOT NULL;
