-- Migration 0007 — allowed_emails (pré-déploiement)
CREATE TABLE IF NOT EXISTS "allowed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_emails_email_unique" UNIQUE("email")
);

-- Seed : décommente après avoir créé le premier compte
-- INSERT INTO allowed_emails (email, note) VALUES ('marwen@etikks.com', 'fondateur');
-- Pour autoriser un nouvel email depuis Supabase SQL Editor :
-- INSERT INTO public.allowed_emails (email, note) VALUES ('email@exemple.com', 'description');
