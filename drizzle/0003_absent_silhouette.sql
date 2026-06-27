-- Migration 0003 — Pivot formation-centric (Phase 1)
-- Idempotente : re-productible sans erreur (enums/colonnes/tables/constraints en IF NOT EXISTS).

-- ── Enums (idempotents) ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_plan') THEN
    CREATE TYPE "public"."payment_plan" AS ENUM('total', 'monthly');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='stage_kind') THEN
    CREATE TYPE "public"."stage_kind" AS ENUM('normal', 'converted', 'lost');
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='temperature') THEN
    CREATE TYPE "public"."temperature" AS ENUM('hot', 'cold');
  END IF;
END $$;--> statement-breakpoint

-- ── Nouvelles tables (idempotentes) ────────────────────
CREATE TABLE IF NOT EXISTS "form_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bootcamp_id" uuid,
	"name" text NOT NULL,
	"target_status_id" uuid,
	"temperature" "temperature" DEFAULT 'cold',
	"default_tag_ids" jsonb DEFAULT '[]'::jsonb,
	"webhook_token" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "form_sources_webhook_token_unique" UNIQUE("webhook_token")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_tags" (
	"lead_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "lead_tags_lead_id_tag_id_pk" PRIMARY KEY("lead_id","tag_id")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"plan" "payment_plan" NOT NULL,
	"due_date" date,
	"amount" numeric,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_status_id" uuid,
	"to_status_id" uuid,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);--> statement-breakpoint

-- ── Extensions de colonnes (idempotentes) ──────────────
ALTER TABLE "bootcamps" ADD COLUMN IF NOT EXISTS "price_total" numeric;--> statement-breakpoint
ALTER TABLE "bootcamps" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'TND' NOT NULL;--> statement-breakpoint
ALTER TABLE "bootcamps" ADD COLUMN IF NOT EXISTS "monthly_count" integer;--> statement-breakpoint
ALTER TABLE "bootcamps" ADD COLUMN IF NOT EXISTS "monthly_amount" numeric;--> statement-breakpoint
ALTER TABLE "lead_statuses" ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_statuses" ADD COLUMN IF NOT EXISTS "kind" "stage_kind" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "temperature" "temperature" DEFAULT 'cold' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "stage_entered_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_at" timestamp;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "raw_payload" jsonb;--> statement-breakpoint

-- ── Foreign keys (idempotentes via DO blocks) ──────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='form_sources_bootcamp_id_bootcamps_id_fk') THEN
    ALTER TABLE "form_sources" ADD CONSTRAINT "form_sources_bootcamp_id_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "public"."bootcamps"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='form_sources_target_status_id_lead_statuses_id_fk') THEN
    ALTER TABLE "form_sources" ADD CONSTRAINT "form_sources_target_status_id_lead_statuses_id_fk" FOREIGN KEY ("target_status_id") REFERENCES "public"."lead_statuses"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_tags_lead_id_leads_id_fk') THEN
    ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_tags_tag_id_tags_id_fk') THEN
    ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payment_schedules_lead_id_leads_id_fk') THEN
    ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stage_history_lead_id_leads_id_fk') THEN
    ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leads_contact_id_contacts_id_fk') THEN
    ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- ── Backfill kind/isSystem sur les 11 lead_statuses existants ──
-- Règle : ILIKE '%converti%' → converted ; ILIKE '%lost%' OR '%perdu%' → lost. Idempotent.
UPDATE "lead_statuses" SET kind='converted', is_system=true WHERE name ILIKE '%converti%';--> statement-breakpoint
UPDATE "lead_statuses" SET kind='lost', is_system=true WHERE name ILIKE '%lost%' OR name ILIKE '%perdu%';--> statement-breakpoint

-- ── Index anti-doublon (NON uniques — doublons existants) ──
-- TODO doublons à résoudre AVANT de passer en UNIQUE :
--   contacts : 2 lignes partagent theetikks@gmail.com
--   leads    : 2 lignes partagent (bootcamp 00000000-0000-0000-0000-000000000001, theetikks@gmail.com)
-- Une fois nettoyés, remplacer par CREATE UNIQUE INDEX.
CREATE INDEX IF NOT EXISTS "contacts_email_norm_idx"
  ON "contacts" (lower(trim("email"))) WHERE "email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_bootcamp_email_norm_idx"
  ON "leads" ("bootcamp_id", lower(trim("email"))) WHERE "email" IS NOT NULL;--> statement-breakpoint

-- ── TODO backfill kind : bootcamps sans stage converted ──
-- Aucun stage existant ne matche ILIKE '%converti%' (noms "Converted" EN / "Inscrit" FR).
-- Après backfill, AUCUN bootcamp n'a de stage kind='converted' ; seul kind='lost' est couvert
--   - 00000000-0000-0000-0000-000000000001 ("Formation par défaut") : "Lost"→lost ; "Converted"(EN) resté normal
--   - e8211853-4846-462f-84b7-49e8e42696e6 : "Perdu"→lost ; aucun converted
-- Action : appeler ensureSystemStages(<bootcampId>) (DAL) pour semer "Converti", ou renommer
-- "Converted"/"Inscrit" et les marquer kind='converted', is_system=true.
