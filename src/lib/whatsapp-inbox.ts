import "server-only";
import { db } from "@/db";
import { activities, leads, leadSources, whatsappConversations, whatsappMessages } from "@/db/schema";
import { asc, and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getOrCreateContactForLead } from "@/lib/queries";

/**
 * La page « WhatsApp » — une conversation par numéro.
 *
 * Il n'y a PAS de table de messages : tout WhatsApp, reçu ou envoyé, est déjà
 * une ligne d'`activities` (type « whatsapp », direction inbound / outbound),
 * posée par le webhook, le composeur 1-à-1 et les automatisations. Ce module
 * ne fait que les lire par lead, et tenir l'état « lu » dans
 * `whatsapp_conversations`.
 *
 * Point d'entrée UNIQUE d'un message reçu : `ingestInboundWhatsApp`. Le webhook
 * l'appelle et c'est là — et nulle part ailleurs — qu'une réponse automatique
 * (lot 3, l'IA) se branchera.
 */

/** La fenêtre de Meta : 24 h après le dernier message DU CLIENT, texte libre permis. */
export const FENETRE_MS = 24 * 60 * 60 * 1000;

export function fenetreOuverte(lastInboundAt: Date | null, now = new Date()): boolean {
  return !!lastInboundAt && now.getTime() - lastInboundAt.getTime() < FENETRE_MS;
}

/** Nom de la source posée sur un lead né d'un message WhatsApp. */
export const SOURCE_WHATSAPP = "WhatsApp entrant";

/**
 * Une conversation, c'est UN NUMÉRO — pas un lead. La même personne a souvent
 * deux leads (un par formation, ou un ancien et un nouveau) avec le même
 * mobile ; ses messages, eux, arrivent sur un seul fil. Les leads d'un numéro
 * sont donc réunis, et la fiche « porteuse » est la plus récente : c'est elle
 * que le webhook alimente et sur elle que se pose l'état « lu ».
 */
export type Conversation = {
  leadId: string; // la fiche porteuse (la plus récente pour ce numéro)
  fullName: string;
  mobileNo: string | null;
  bootcamp: string | null;
  lastAt: Date;
  lastDirection: "inbound" | "outbound";
  lastContent: string | null;
  lastInboundAt: Date | null;
  unread: number;
};

/** La clé d'un numéro : ses 8 derniers chiffres — cf. le rapprochement du webhook. */
const CLE_TEL = sql`right(regexp_replace(coalesce(${leads.mobileNo}, ''), '\\D', '', 'g'), 8)`;

export async function getWhatsAppConversations(): Promise<Conversation[]> {
  const rows = await db.execute<{
    lead_id: string;
    full_name: string;
    mobile_no: string | null;
    bootcamp: string | null;
    last_at: Date;
    last_inbound_at: Date | null;
    last_direction: "inbound" | "outbound";
    last_content: string | null;
    unread: number;
  }>(sql`
    with msgs as (
      select a.direction, a.content, a.created_at,
             right(regexp_replace(l.mobile_no, '\\D', '', 'g'), 8) as tel
      from activities a
      join leads l on l.id = a.reference_id
      where a.type = 'whatsapp' and a.reference_type = 'lead'
        and l.mobile_no is not null and l.mobile_no <> ''
    ),
    grp as (
      select tel,
             max(created_at) as last_at,
             max(created_at) filter (where direction = 'inbound') as last_inbound_at
      from msgs
      group by tel
    )
    select porteur.id as lead_id, porteur.full_name, porteur.mobile_no, b.name as bootcamp,
           g.last_at, g.last_inbound_at,
           last.direction as last_direction, last.content as last_content,
           (select count(*)::int from msgs x
             where x.tel = g.tel and x.direction = 'inbound'
               and x.created_at > coalesce(c.read_at, '-infinity'::timestamp)) as unread
    from grp g
    join lateral (
      select direction, content from msgs m
      where m.tel = g.tel order by m.created_at desc limit 1
    ) last on true
    join lateral (
      select l.id, l.full_name, l.mobile_no, l.bootcamp_id from leads l
      where right(regexp_replace(coalesce(l.mobile_no, ''), '\\D', '', 'g'), 8) = g.tel
      order by l.created_at desc limit 1
    ) porteur on true
    left join bootcamps b on b.id = porteur.bootcamp_id
    left join whatsapp_conversations c on c.lead_id = porteur.id
    order by g.last_at desc
  `);

  return rows.map((r) => ({
    leadId: r.lead_id,
    fullName: r.full_name,
    mobileNo: r.mobile_no,
    bootcamp: r.bootcamp,
    lastAt: new Date(r.last_at),
    lastDirection: r.last_direction,
    lastContent: r.last_content,
    lastInboundAt: r.last_inbound_at ? new Date(r.last_inbound_at) : null,
    unread: r.unread,
  }));
}

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export type Message = {
  id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  createdBy: string | null;
  createdAt: Date;
  status: MessageStatus | null; // null = envoyé avant qu'on garde les statuts, ou message reçu
  error: string | null;
};

/**
 * Le fil d'un numéro, quelle que soit la fiche par laquelle on y entre :
 * `leadId` peut être une ancienne fiche, on remonte à la porteuse.
 */
export async function getWhatsAppThread(leadId: string) {
  const entree = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { id: true, mobileNo: true },
  });
  if (!entree) return null;

  const cle = (entree.mobileNo ?? "").replace(/\D/g, "").slice(-8);
  // Toutes les fiches de ce numéro, la plus récente en tête = la porteuse.
  const fiches = cle
    ? await db.query.leads.findMany({
        where: eq(CLE_TEL, cle),
        orderBy: [desc(leads.createdAt)],
        columns: { id: true, fullName: true, mobileNo: true, email: true },
        with: { bootcamp: { columns: { name: true } } },
      })
    : await db.query.leads.findMany({
        where: eq(leads.id, leadId),
        columns: { id: true, fullName: true, mobileNo: true, email: true },
        with: { bootcamp: { columns: { name: true } } },
      });
  const porteur = fiches[0];
  if (!porteur) return null;

  const rows = await db.query.activities.findMany({
    where: and(
      eq(activities.type, "whatsapp"),
      eq(activities.referenceType, "lead"),
      inArray(activities.referenceId, fiches.map((f) => f.id))
    ),
    orderBy: [asc(activities.createdAt)],
  });
  const statuts = rows.length
    ? await db.query.whatsappMessages.findMany({
        where: inArray(whatsappMessages.activityId, rows.map((a) => a.id)),
      })
    : [];
  const parActivite = new Map(statuts.map((s) => [s.activityId, s]));
  const messages: Message[] = rows.map((a) => {
    const st = parActivite.get(a.id);
    return {
      id: a.id,
      direction: a.direction,
      content: a.content,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
      status: (st?.status as MessageStatus | undefined) ?? null,
      error: st?.error ?? null,
    };
  });
  const lastInbound = [...messages].reverse().find((m) => m.direction === "inbound");

  return {
    lead: {
      id: porteur.id,
      fullName: porteur.fullName,
      mobileNo: porteur.mobileNo,
      email: porteur.email,
      // Toutes ses formations, la plus récente d'abord, sans doublon — une personne, un fil.
      bootcamp:
        [...new Set(fiches.map((f) => f.bootcamp?.name).filter((n): n is string => !!n))].join(" · ") ||
        null,
    },
    messages,
    lastInboundAt: lastInbound?.createdAt ?? null,
  };
}

/** Nombre de conversations (numéros) avec au moins un message non lu — la pastille du menu. */
export async function getWhatsAppUnreadCount(): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    with msgs as (
      select a.created_at, right(regexp_replace(l.mobile_no, '\\D', '', 'g'), 8) as tel
      from activities a
      join leads l on l.id = a.reference_id
      where a.type = 'whatsapp' and a.reference_type = 'lead' and a.direction = 'inbound'
        and l.mobile_no is not null and l.mobile_no <> ''
    )
    select count(distinct m.tel)::int as n
    from msgs m
    join lateral (
      select l.id from leads l
      where right(regexp_replace(coalesce(l.mobile_no, ''), '\\D', '', 'g'), 8) = m.tel
      order by l.created_at desc limit 1
    ) porteur on true
    left join whatsapp_conversations c on c.lead_id = porteur.id
    where m.created_at > coalesce(c.read_at, '-infinity'::timestamp)
  `);
  return rows[0]?.n ?? 0;
}

export async function markWhatsAppRead(leadId: string) {
  await db
    .insert(whatsappConversations)
    .values({ leadId, readAt: new Date() })
    .onConflictDoUpdate({ target: whatsappConversations.leadId, set: { readAt: new Date() } });
}

async function getOrCreateSourceWhatsApp() {
  const found = await db.query.leadSources.findFirst({ where: eq(leadSources.name, SOURCE_WHATSAPP) });
  if (found) return found;
  const [created] = await db.insert(leadSources).values({ name: SOURCE_WHATSAPP }).returning();
  return created;
}

/**
 * Un message reçu de Meta devient une activité sur un lead — et si personne
 * n'a ce numéro, le lead est CRÉÉ. Une école reçoit des questions avant de
 * savoir pour quelle formation : le lead naît sans formation ni colonne, hors
 * des kanbans, et Fatma lui en donne une depuis sa fiche quand elle sait.
 *
 * `from` arrive de Meta en chiffres seuls, indicatif compris (« 21627688700 »).
 */
export async function ingestInboundWhatsApp(input: {
  from: string;
  profileName: string | null;
  text: string;
}): Promise<{ leadId: string; leadCreated: boolean }> {
  // Rapprochement par les 8 derniers chiffres : le CRM stocke des numéros
  // tunisiens parfois sans indicatif, Meta les rend toujours avec. Le lead le
  // plus récent gagne : c'est lui que l'équipe suit.
  const fin = input.from.replace(/\D/g, "").slice(-8);
  let lead = await db.query.leads.findFirst({
    where: ilike(leads.mobileNo, `%${fin}%`),
    orderBy: [desc(leads.createdAt)],
    columns: { id: true },
  });
  let leadCreated = false;

  if (!lead) {
    const mobileNo = `+${input.from.replace(/\D/g, "")}`;
    const fullName = input.profileName?.trim() || mobileNo;
    const contact = await getOrCreateContactForLead({
      email: null,
      mobileNo,
      firstName: null,
      lastName: null,
      fullName,
    });
    const source = await getOrCreateSourceWhatsApp();
    const [created] = await db
      .insert(leads)
      .values({
        fullName,
        mobileNo,
        contactId: contact.id,
        sourceId: source.id,
        rawPayload: { whatsapp: { from: input.from, profileName: input.profileName } },
        stageEnteredAt: new Date(),
        lastContactedAt: new Date(),
      })
      .returning({ id: leads.id });
    lead = created;
    leadCreated = true;
  }

  await db.insert(activities).values({
    referenceType: "lead",
    referenceId: lead.id,
    type: "whatsapp",
    direction: "inbound",
    subject: `WhatsApp reçu${input.profileName ? ` de ${input.profileName}` : ""}`,
    content: input.text,
  });
  await db
    .update(leads)
    .set({ lastContactedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, lead.id));

  // ← Lot 3 : c'est ICI qu'une réponse automatique (IA) se décidera, une fois le
  // message rangé — jamais avant, pour qu'un échec de l'IA ne perde pas le message.

  return { leadId: lead.id, leadCreated };
}

// ── Statuts d'envoi ───────────────────────────────────

/** À appeler juste après un envoi réussi : lie le wamid de Meta à la bulle. */
export async function recordWhatsAppSent(wamid: string, activityId: string) {
  await db.insert(whatsappMessages).values({ wamid, activityId }).onConflictDoNothing();
}

const RANG: Record<MessageStatus, number> = { sent: 1, delivered: 2, read: 3, failed: 9 };

/**
 * Les erreurs de Meta, traduites. Le code brut n'apprend rien à Fatma ; la
 * phrase lui dit quoi faire. Les autres codes passent tels quels.
 */
const ERREURS: Record<number, string> = {
  131026: "Ce numéro n'est pas sur WhatsApp, ou a bloqué le numéro de l'école.",
  131047: "Plus de 24 h sans réponse de cette personne : seul un modèle approuvé peut partir.",
  131049: "Meta a limité les messages marketing vers cette personne pour l'instant.",
  131053: "Le fichier joint n'a pas pu être envoyé.",
  130472: "Cette personne fait partie d'un test de Meta : le message n'a pas été livré.",
  131042: "Problème de paiement sur le compte WhatsApp de l'école.",
};

/**
 * Un statut reçu par le webhook. On ne garde que le plus avancé : Meta peut
 * livrer « read » avant « delivered ». Un wamid inconnu (envoi d'avant cette
 * table, ou depuis un autre outil) est ignoré sans bruit.
 */
export async function applyWhatsAppStatus(input: {
  wamid: string;
  status: string;
  errors?: { code?: number; title?: string; message?: string }[];
}) {
  const statut = input.status as MessageStatus;
  if (!(statut in RANG)) return;
  const existant = await db.query.whatsappMessages.findFirst({
    where: eq(whatsappMessages.wamid, input.wamid),
  });
  if (!existant) return;
  if (RANG[(existant.status as MessageStatus)] >= RANG[statut]) return;

  const e = input.errors?.[0];
  const error =
    statut === "failed"
      ? (e?.code && ERREURS[e.code]) || e?.message || e?.title || "Échec de l'envoi, sans détail de Meta."
      : null;
  await db
    .update(whatsappMessages)
    .set({ status: statut, error, updatedAt: new Date() })
    .where(eq(whatsappMessages.wamid, input.wamid));
}
