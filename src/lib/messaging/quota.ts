import "server-only";
import { and, eq, gte, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { campaignRecipients, automationRuns } from "@/db/schema";

/**
 * Plafond quotidien d'envoi, pour TOUT le compte Resend.
 *
 * Réglable par `EMAIL_DAILY_LIMIT` : le plan gratuit plafonne à 100/jour, le
 * plan Pro n'a **aucune limite quotidienne** (50 000/mois). Sans cette
 * variable, passer à Pro n'aurait rien changé — le CRM aurait continué de
 * brider à 100 sans le dire, et le symptôme (« ma campagne s'arrête toute
 * seule ») n'aurait désigné aucune cause.
 *
 * On garde toujours un plafond, même sur Pro : c'est le seul garde-fou contre
 * une campagne partie sur la mauvaise cible. Mettre un nombre haut, pas
 * l'infini.
 */
function lireLimite(): number {
  const brut = process.env.EMAIL_DAILY_LIMIT;
  if (!brut) return 100;
  const n = Number.parseInt(brut, 10);
  // Une valeur illisible retombe sur le plan gratuit : mieux vaut trop prudent
  // qu'un plafond accidentellement absent.
  return Number.isFinite(n) && n > 0 ? n : 100;
}

export const DAILY_LIMIT = lireLimite();

/**
 * Emails déjà partis aujourd'hui, campagnes ET automatisations confondues.
 *
 * Le plafond Resend est celui du compte, pas celui d'une fonctionnalité :
 * ne compter que les campagnes laissait les automatisations passer par-dessus
 * sans être décomptées, et le refus n'apparaissait qu'après coup, à l'envoi.
 */
export async function sentToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.status, "sent"), gte(campaignRecipients.sentAt, start)));

  // Les WhatsApp (whatsapp_id posé) ne passent pas par Resend : Meta a son
  // propre plafond. Les compter ici volait des emails au quota du jour.
  const [a] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(automationRuns)
    .where(
      and(
        eq(automationRuns.status, "sent"),
        gte(automationRuns.sentAt, start),
        isNull(automationRuns.whatsappId)
      )
    );

  return (c?.n ?? 0) + (a?.n ?? 0);
}
