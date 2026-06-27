CREATE TYPE "public"."bootcamp_status" AS ENUM('draft', 'open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bootcamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"start_date" date,
	"end_date" date,
	"status" "bootcamp_status" DEFAULT 'open' NOT NULL,
	"capacity" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bootcamps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "lead_statuses" ADD COLUMN "bootcamp_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bootcamp_id" uuid;--> statement-breakpoint
ALTER TABLE "lead_statuses" ADD CONSTRAINT "lead_statuses_bootcamp_id_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "public"."bootcamps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_bootcamp_id_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "public"."bootcamps"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- ── Migration de données : Formation par défaut ──────────
-- Tous les statuts et leads existants sont rattachés à une formation "par défaut"
-- pour ne perdre aucune donnée lors du passage au modèle centré formations.
INSERT INTO "bootcamps" ("id", "name", "slug", "description", "status")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Formation par défaut',
  'default',
  'Formation créée automatiquement pour accueillir les leads et statuts existants avant la refonte formations.',
  'open'
);--> statement-breakpoint

UPDATE "lead_statuses"
SET "bootcamp_id" = '00000000-0000-0000-0000-000000000001'
WHERE "bootcamp_id" IS NULL;--> statement-breakpoint

UPDATE "leads"
SET "bootcamp_id" = '00000000-0000-0000-0000-000000000001'
WHERE "bootcamp_id" IS NULL;--> statement-breakpoint

-- Rend bootcamp_id NOT NULL une fois que toutes les lignes existantes sont remplies.
ALTER TABLE "lead_statuses" ALTER COLUMN "bootcamp_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "bootcamp_id" SET NOT NULL;