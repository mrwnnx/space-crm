CREATE TYPE "public"."notification_type" AS ENUM('lead_assigned', 'lead_status_change', 'deal_status_change', 'task_assigned', 'task_due', 'comment', 'mention');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"reference_type" "reference_type",
	"reference_id" uuid,
	"user_id" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
