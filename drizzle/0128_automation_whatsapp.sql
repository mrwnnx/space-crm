-- Une automatisation de colonne peut désormais envoyer par WhatsApp.
--
-- `channel` par défaut à 'email' : les règles existantes gardent leur
-- comportement sans qu'on y touche.
--
-- `email_template_id` perd son NOT NULL — une règle WhatsApp n'a pas de modèle
-- d'email. La cohérence est portée par la contrainte ci-dessous plutôt que par
-- le code : une règle sans modèle du tout serait silencieusement inerte.
--
-- `whatsapp_variables` liste des NOMS de variables du CRM (firstName,
-- formation, dateDebut…) dans l'ordre où Meta les attend. Meta ne connaît pas
-- les noms : ses modèles portent {{1}}, {{2}}… C'est donc la POSITION dans ce
-- tableau qui fait la correspondance.
alter table automations
  add column if not exists channel text not null default 'email',
  add column if not exists whatsapp_template text,
  add column if not exists whatsapp_language text not null default 'fr',
  add column if not exists whatsapp_variables jsonb not null default '[]'::jsonb;

alter table automations alter column email_template_id drop not null;

alter table automations drop constraint if exists automations_channel_coherent;
alter table automations add constraint automations_channel_coherent check (
  (channel = 'email'    and email_template_id is not null) or
  (channel = 'whatsapp' and whatsapp_template is not null)
);

-- L'identifiant rendu par Meta, comme `resend_id` l'est pour l'email : sans
-- lui, impossible de rattacher un accusé de livraison à la bonne ligne.
alter table automation_runs
  add column if not exists whatsapp_id text;
