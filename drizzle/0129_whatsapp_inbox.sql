-- La page « WhatsApp » : une conversation par lead, avec son état lu / non-lu.
--
-- `read_at` = la dernière fois qu'un humain a OUVERT la conversation. Un message
-- reçu après cette date est « non lu ». Pas de ligne = jamais ouverte.
-- L'état est partagé par toute l'équipe : c'est la boîte de l'école, pas celle
-- d'une personne — si Fatma a lu, Marwen n'a pas besoin de relire.
--
-- Table séparée plutôt qu'une colonne sur `leads` : un ALTER TABLE leads attend
-- un verrou ACCESS EXCLUSIVE, et des sessions du pooler (Supavisor) gardent des
-- transactions ouvertes pendant des heures sur `leads`. L'ALTER a été annulé
-- deux fois par le statement_timeout le 2026-09-16, en bloquant la prod entre
-- temps. Une table neuve ne verrouille rien.
create table if not exists whatsapp_conversations (
  lead_id uuid primary key references leads(id) on delete cascade,
  read_at timestamp
);
