-- Migration 0004 — Phase 2 : capture inbound (field_mapping + form_source_id)
-- Idempotente.
ALTER TABLE "form_sources" ADD COLUMN IF NOT EXISTS "field_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "form_source_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_form_source_id_form_sources_id_fk') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_form_source_id_form_sources_id_fk" FOREIGN KEY ("form_source_id") REFERENCES "public"."form_sources"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
