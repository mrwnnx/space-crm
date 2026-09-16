-- Un lead peut exister SANS formation.
--
-- Le schéma Drizzle le permettait déjà (bootcampId nullable depuis le pivot),
-- mais la base gardait le NOT NULL posé par 0002 : un « deux modèles
-- parallèles » de plus, muet jusqu'au premier insert sans formation.
--
-- Qui en a besoin : un lead né d'un message WhatsApp — une école reçoit la
-- question avant de savoir pour quelle formation. Il vit hors des kanbans
-- (pas de colonne) jusqu'à ce qu'on lui attribue une formation.
--
-- lock_timeout : l'ALTER prend un verrou exclusif sur `leads`. S'il ne l'obtient
-- pas en 5 s, on abandonne plutôt que de bloquer la prod derrière nous.
set lock_timeout = '5s';
--> statement-breakpoint
alter table leads alter column bootcamp_id drop not null;
