import "server-only";
import { db } from "@/db";
import { campaignRecipients, campaigns } from "@/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getCampaignStatus } from "./queries";
import { resolveCampaignAudience } from "./audience";
import { renderCampaignHtml, renderCampaignText } from "./template";

/** Resend accepte au maximum 100 emails par appel à /emails/batch. */
const BATCH_SIZE = 100;
/** Plafond quotidien du plan gratuit Resend. */
const DAILY_LIMIT = 100;

export type SendResult = {
  ok: boolean;
  sent: number;
  failed: number;
  remaining: number;
  /** vrai quand on s'est arrêté sur le quota, pas sur une erreur */
  quotaReached: boolean;
  error?: string;
};

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001"
  );
}

/** Envois déjà partis aujourd'hui, toutes campagnes confondues. */
async function sentToday(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(
      and(eq(campaignRecipients.status, "sent"), gte(campaignRecipients.sentAt, start))
    );
  return row?.n ?? 0;
}

/**
 * Matérialise les destinataires. L'index unique (campaign_id, lower(email))
 * rend l'opération rejouable : relancer après une interruption n'ajoute pas
 * de doublon et ne réexpédie à personne.
 */
export async function materializeRecipients(campaignId: string): Promise<number> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error("Campagne introuvable");

  const { recipients } = await resolveCampaignAudience({
    tagIds: (campaign.targetTagIds as string[]) ?? [],
    emails: (campaign.targetEmails as string[]) ?? [],
  });
  if (recipients.length === 0) return 0;

  await db
    .insert(campaignRecipients)
    .values(
      recipients.map((r) => ({
        campaignId,
        contactId: r.contactId,
        email: r.email,
      }))
    )
    .onConflictDoNothing();

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));
  return row?.n ?? 0;
}

async function sendBatch(
  payload: Array<Record<string, unknown>>
): Promise<{ ids: (string | null)[]; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ids: [], error: "RESEND_API_KEY manquant" };

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await res.json().catch(() => null)) as
    | { data?: { id: string }[]; message?: string }
    | null;

  if (!res.ok) {
    return { ids: [], error: json?.message || `HTTP ${res.status}` };
  }
  return { ids: (json?.data ?? []).map((d) => d?.id ?? null) };
}

/**
 * Envoie une campagne, ou reprend un envoi interrompu.
 *
 * Chaque destinataire est marqué au fur et à mesure : une coupure au milieu
 * laisse la campagne en "sending" avec des lignes encore "pending", et un
 * nouvel appel repart exactement de là.
 */
export async function sendCampaign(campaignId: string): Promise<SendResult> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Campagne introuvable" };
  const REFUSED: Record<string, string> = {
    sent: "Campagne déjà envoyée",
    cancelled: "Campagne annulée",
    archived: "Campagne archivée",
    paused: "Campagne suspendue — reprenez-la d'abord",
  };
  if (REFUSED[campaign.status]) {
    return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: REFUSED[campaign.status] };
  }
  if (!campaign.subject?.trim()) {
    return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Sujet manquant" };
  }
  if (!campaign.content?.trim()) {
    return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Contenu vide" };
  }

  // L'habillage est lu UNE fois : il est identique pour tous les destinataires,
  // et le relire par email ferait 500 requêtes pour la même ligne.
  const { getEmailBranding } = await import("@/lib/queries");
  const branding = await getEmailBranding();

  // Le même expéditeur que les envois unitaires : l'écran de design prime,
  // la variable d'environnement sert de repli.
  const from = branding?.senderEmail
    ? branding.senderName
      ? `${branding.senderName} <${branding.senderEmail}>`
      : branding.senderEmail
    : process.env.EMAIL_FROM;
  if (!from) {
    return { ok: false, sent: 0, failed: 0, remaining: 0, quotaReached: false, error: "Aucun expéditeur configuré" };
  }

  await materializeRecipients(campaignId);
  await db
    .update(campaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(eq(campaigns.id, campaignId));

  let sent = 0;
  let failed = 0;
  let quotaReached = false;
  const root = baseUrl();

  let pausedMidway = false;

  for (;;) {
    // Relu à chaque tour : sans ça, « suspendre » n'aurait aucun effet avant
    // la fin de l'envoi — la boucle ne regarderait jamais la décision prise
    // entre-temps.
    const live = await getCampaignStatus(campaignId);
    if (live === "paused" || live === "cancelled") {
      pausedMidway = true;
      break;
    }

    const budget = DAILY_LIMIT - (await sentToday());
    if (budget <= 0) {
      quotaReached = true;
      break;
    }

    const pending = await db
      .select({
        id: campaignRecipients.id,
        email: campaignRecipients.email,
        contactId: campaignRecipients.contactId,
      })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "pending")
        )
      )
      .limit(Math.min(BATCH_SIZE, budget));

    if (pending.length === 0) break;

    // Le lien de désinscription est propre à chaque destinataire : il est
    // reconstruit ici à partir du token du contact.
    const tokens = await db.query.contacts.findMany({
      columns: { id: true, unsubscribeToken: true },
      where: (c, { inArray }) =>
        inArray(
          c.id,
          pending.map((p) => p.contactId).filter((x): x is string => !!x)
        ),
    });
    const tokenByContact = new Map(tokens.map((t) => [t.id, t.unsubscribeToken]));

    // Sans token, pas de lien de désinscription valide — on n'envoie pas.
    // Cas réel : le contact a été supprimé après la matérialisation, et
    // `contact_id` est passé à NULL (ON DELETE SET NULL).
    const orphans = pending.filter(
      (p) => !p.contactId || !tokenByContact.get(p.contactId)
    );
    if (orphans.length > 0) {
      await db
        .update(campaignRecipients)
        .set({ status: "skipped", error: "Contact supprimé — pas de lien de désinscription" })
        .where(
          inArray(
            campaignRecipients.id,
            orphans.map((o) => o.id)
          )
        );
    }
    const sendable = pending.filter(
      (p) => p.contactId && tokenByContact.get(p.contactId)
    );
    if (sendable.length === 0) continue;

    const payload = sendable.map((p) => {
      // `?c=` : sans l'id de campagne, on saurait QUE la personne s'est
      // désabonnée, jamais À CAUSE DE QUOI — donc « désinscriptions » serait
      // incalculable par campagne.
      const url = `${root}/unsubscribe/${tokenByContact.get(p.contactId!)}?c=${campaignId}`;
      return {
        from,
        to: p.email,
        subject: campaign.subject!,
        html: renderCampaignHtml({ content: campaign.content, unsubscribeUrl: url, branding }),
        text: renderCampaignText(campaign.content, url),
        headers: {
          // Permet le désabonnement en un clic depuis Gmail — Google l'exige
          // désormais des expéditeurs de volume, et c'est un signal positif.
          "List-Unsubscribe": `<${url}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const { ids, error } = await sendBatch(payload);

    if (error) {
      // Échec du lot entier : on marque, on s'arrête, la reprise est possible.
      await db
        .update(campaignRecipients)
        .set({ status: "failed", error })
        .where(
          inArray(
            campaignRecipients.id,
            sendable.map((p) => p.id)
          )
        );
      failed += sendable.length;
      await db
        .update(campaigns)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
      return { ok: false, sent, failed, remaining: 0, quotaReached: false, error };
    }

    const now = new Date();
    for (let i = 0; i < sendable.length; i++) {
      // `status = 'pending'` dans le WHERE : le webhook Resend peut renvoyer un
      // rebond en moins de 2 s, donc AVANT que cette boucle n'ait fini de
      // marquer les 50 destinataires. Sans cette condition, on écrasait
      // `bounced` par `sent` et l'écran affichait « envoyé » pour un email
      // rebondi. Invisible en dessous de quelques dizaines d'envois.
      await db
        .update(campaignRecipients)
        .set({ status: "sent", resendId: ids[i] ?? null, sentAt: now })
        .where(
          and(
            eq(campaignRecipients.id, sendable[i].id),
            eq(campaignRecipients.status, "pending")
          )
        );
      sent++;
    }
  }

  const [rest] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, "pending")
      )
    );
  const remaining = rest?.n ?? 0;

  if (!pausedMidway) {
    await db
      .update(campaigns)
      .set({
        // Tant qu'il reste des destinataires en attente (quota atteint), la
        // campagne n'est PAS "sent" : elle reste reprenable.
        status: remaining > 0 ? "sending" : "sent",
        sentAt: remaining > 0 ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }
  // Si l'utilisateur a suspendu ou annulé pendant l'envoi, son choix prime :
  // on ne le réécrit pas.


  return { ok: true, sent, failed, remaining, quotaReached };
}
