-- Audit perf du 2026-09-22 : le badge « WhatsApp non lus » (getWhatsAppUnreadCount,
-- interrogé toutes les 15 s sur chaque écran) = ~95 % du temps CPU de la base
-- depuis le 02/08 (47 042 appels × 697 ms). Pour chaque message entrant, la
-- requête retrouve le lead « porteur » du numéro en relisant toute la table
-- leads avec un regexp_replace par ligne.
--
-- Index d'expression = EXACTEMENT la clé CLE_TEL de src/lib/whatsapp-inbox.ts
-- (8 derniers chiffres du numéro), + created_at DESC pour le « order by … limit 1 ».
-- Sert aussi la liste des conversations et le fil.
--
-- CONCURRENTLY : aucun verrou, la prod continue de tourner pendant la création.
-- Retour arrière : DROP INDEX CONCURRENTLY IF EXISTS leads_phone_key_idx;
set lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_phone_key_idx
  ON leads ((right(regexp_replace(coalesce(mobile_no, ''), '\D', '', 'g'), 8)), created_at DESC);
