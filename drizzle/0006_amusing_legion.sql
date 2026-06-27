-- Migration 0006 — intendedPlan sur leads (plan envisagé avant inscription)
-- Idempotente. L'enum payment_plan existe déjà (P1).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "intended_plan" "payment_plan";
