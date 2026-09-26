import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { moveLeadToStage } from "@/lib/queries";

/*
 * Ce qu'une réponse WhatsApp change dans le pipeline (décision de Marwen,
 * 26/09) : quelqu'un qui écrit a été CONTACTÉ. Il passe donc en « Contacté »
 * s'il était avant (Nouveau, Intéressé) ou en « Did not answer » — il vient
 * justement de répondre. Jamais de retour en arrière : Call Later, Payment
 * pending, Inscrit, Perdu ne bougent pas.
 */
export async function passerEnContacte(leadId: string) {
  const [l] = await db.execute<{
    status_id: string | null;
    kind: string | null;
    position: number | null;
    nom: string | null;
    cible: string | null;
    cible_position: number | null;
  }>(sql`
    select l.status_id, s.kind::text as kind, s.position, s.name as nom,
           c.id as cible, c.position as cible_position
    from leads l
    left join lead_statuses s on s.id = l.status_id
    left join lateral (
      select id, position from lead_statuses
      where bootcamp_id = l.bootcamp_id and kind = 'normal' and name ilike 'contact%'
      order by position limit 1
    ) c on true
    where l.id = ${leadId}`);
  if (!l?.cible || l.status_id === l.cible) return false;
  if (l.kind !== "normal") return false;
  const avant = (l.position ?? 0) < (l.cible_position ?? 0);
  const sansReponse = /did not answer|pas r[ée]pondu|injoignable/i.test(l.nom ?? "");
  if (!avant && !sansReponse) return false;
  await moveLeadToStage(leadId, l.cible);
  const { runStatusAutomations } = await import("@/lib/automations");
  await runStatusAutomations(leadId, l.cible);
  return true;
}

/**
 * Pour les déplacements « vers l'avant » (formulaire → Intéressé) : vrai si la
 * fiche est déjà plus loin que la colonne visée, pour ne pas la faire reculer.
 */
export async function dejaPlusLoin(leadId: string, colonne: string) {
  const [r] = await db.execute<{ plus_loin: boolean }>(sql`
    select coalesce(s.position > t.position and s.kind = 'normal', false) as plus_loin
    from leads l join lead_statuses s on s.id = l.status_id, lead_statuses t
    where l.id = ${leadId} and t.id = ${colonne}`);
  return !!r?.plus_loin;
}
