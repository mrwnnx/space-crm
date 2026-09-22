CREATE TABLE IF NOT EXISTS "whatsapp_blasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bootcamp_id" uuid NOT NULL REFERENCES "bootcamps"("id") ON DELETE cascade,
  "status_id" uuid NOT NULL REFERENCES "lead_statuses"("id") ON DELETE cascade,
  "template" text NOT NULL,
  "language" text DEFAULT 'ar' NOT NULL,
  "variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cap_policy" text DEFAULT 'reporter' NOT NULL,
  "state" text DEFAULT 'running' NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_blast_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blast_id" uuid NOT NULL REFERENCES "whatsapp_blasts"("id") ON DELETE cascade,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE cascade,
  "status" text DEFAULT 'pending' NOT NULL,
  "reason" text,
  "scheduled_at" timestamp,
  "sent_at" timestamp,
  "whatsapp_id" text,
  CONSTRAINT "whatsapp_blast_targets_unique" UNIQUE ("blast_id", "lead_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_blast_targets_due_idx" ON "whatsapp_blast_targets" ("status", "scheduled_at");
