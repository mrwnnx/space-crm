-- Qui a encaissé, et la preuve.
--
-- Les deux vivent sur l'ÉCHÉANCE et non sur le lead : quelqu'un qui paie en
-- trois fois peut verser le premier en espèces à Fatma et le deuxième par
-- virement. Un seul champ par dossier perdrait cette information, et c'est
-- exactement celle qu'on cherche quand l'argent manque.
--
-- `received_by` porte l'email d'un membre de l'équipe, ou la valeur 'banque'
-- pour un virement arrivé sur le compte. Pas de clé étrangère vers
-- allowed_emails : retirer quelqu'un de l'équipe ne doit pas effacer la trace
-- de ce qu'il a encaissé.
--
-- `proof_path` est le chemin DANS le bucket privé, jamais une URL : l'adresse
-- signée se fabrique à la lecture et expire. Un justificatif de virement porte
-- un RIB et un nom.

alter table payment_schedules
  add column if not exists received_by text,
  add column if not exists proof_path text,
  add column if not exists proof_name text,
  add column if not exists proof_uploaded_at timestamp;
