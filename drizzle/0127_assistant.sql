-- Le fil de conversation avec l'assistant.
--
-- Par utilisateur : Marwen et Fatma ne partagent pas leurs échanges. Rien
-- n'est effacé automatiquement — on relit ce qu'on a demandé hier.
--
-- Les appels d'outils ne sont PAS conservés : seul ce qui a été dit et répondu
-- a besoin de survivre au rafraîchissement. Garder les allers-retours internes
-- gonflerait la table pour un contenu que personne ne relira jamais.
create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  role text not null,
  content text not null,
  created_at timestamp not null default now()
);

create index if not exists assistant_messages_user_idx
  on assistant_messages (user_email, created_at);
