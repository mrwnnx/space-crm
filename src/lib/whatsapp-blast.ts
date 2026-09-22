import "server-only";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { contacts, leads, whatsappBlasts, whatsappBlastTargets } from "@/db/schema";
import { buildVariables } from "@/lib/automations";
import { categorieDuModele, MARKETING_CAP_MS, whatsAppConsentCheck } from "@/lib/whatsapp-consent";
import { estNumeroDeTest } from "@/lib/messaging/whatsapp";

/**
 * L'envoi d'un modèle à TOUTE une colonne, à l'instant où on clique.
 *
 * Deux temps, exprès : on calcule d'abord qui recevrait quoi (`apercuBlast`),
 * l'écran le montre, et seulement ensuite on met en file (`creerBlast`). Le
 * cron vide la file — jamais 200 messages dans une requête serveur.
 *
 * Les garde-fous sont ceux d'une règle de colonne : consentement, STOP,
 * « 1 marketing par 24 h ». Le plafond 24 h est le seul dont l'issue se
 * choisit : reporter la personne, ou la laisser hors de cette vague.
 */

export type CapPolicy = "reporter" | "exclure";

/** Ce qu'on sait faire d'un lead pour cette vague. */
type Verdict =
  | { sort: "envoyer"; leadId: string }
  | { sort: "reporter"; leadId: string; quand: Date }
  | { sort: "sauter"; leadId: string; raison: string };

export type ApercuBlast = {
  total: number;
  envoyer: number;
  reporter: number;
  sauter: number;
  /** Les motifs de saut, regroupés : « Aucun numéro » → 12. */
  motifs: { raison: string; n: number }[];
  /** La plus proche des échéances des reportés, pour l'annoncer. */
  premierReport: Date | null;
};

type LeadDeVague = Awaited<ReturnType<typeof leadsDeLaColonne>>[number];

async function leadsDeLaColonne(statusId: string) {
  return db.query.leads.findMany({
    where: eq(leads.statusId, statusId),
    with: { contact: true, bootcamp: true },
  });
}

/**
 * Le verdict pour un lead, sans rien envoyer. `marketing` et `capPolicy` sont
 * passés pour ne pas réinterroger Meta à chaque ligne.
 */
async function verdict(
  lead: LeadDeVague,
  modele: { template: string; language: string; variables: string[] },
  marketing: boolean,
  capPolicy: CapPolicy
): Promise<Verdict> {
  const id = lead.id;
  if (!lead.mobileNo) return { sort: "sauter", leadId: id, raison: "Aucun numéro de téléphone" };

  const test = estNumeroDeTest(lead.mobileNo);
  if (marketing && !test) {
    const dernier = lead.contact?.whatsappMarketingLastAt;
    if (dernier && Date.now() - dernier.getTime() < MARKETING_CAP_MS) {
      if (capPolicy === "exclure") {
        return { sort: "sauter", leadId: id, raison: "A déjà reçu un marketing il y a moins de 24 h" };
      }
      return { sort: "reporter", leadId: id, quand: new Date(dernier.getTime() + MARKETING_CAP_MS + 5 * 60_000) };
    }
  }

  const garde = await whatsAppConsentCheck(
    lead.contact ? { ...lead.contact, mobileNo: lead.contact.mobileNo ?? lead.mobileNo } : null,
    modele.template,
    modele.language
  );
  if (!garde.ok) return { sort: "sauter", leadId: id, raison: garde.reason };

  // Une variable vide fait refuser le message par Meta (#131008) : autant le
  // voir dans le décompte plutôt que dans les échecs.
  const vars = buildVariables(lead, modele.language.startsWith("ar"));
  const vide = modele.variables.find((n) => !(vars[n] ?? n).trim());
  if (vide) return { sort: "sauter", leadId: id, raison: `Variable « ${vide} » vide pour ce lead` };

  return { sort: "envoyer", leadId: id };
}

async function verdicts(
  statusId: string,
  modele: { template: string; language: string; variables: string[] },
  capPolicy: CapPolicy
): Promise<Verdict[]> {
  const categorie = await categorieDuModele(modele.template, modele.language);
  const marketing = categorie !== "UTILITY" && categorie !== "AUTHENTICATION";
  const liste = await leadsDeLaColonne(statusId);
  return Promise.all(liste.map((l) => verdict(l, modele, marketing, capPolicy)));
}

/** Le décompte montré AVANT d'envoyer quoi que ce soit. */
export async function apercuBlast(
  statusId: string,
  modele: { template: string; language: string; variables: string[] },
  capPolicy: CapPolicy
): Promise<ApercuBlast> {
  const v = await verdicts(statusId, modele, capPolicy);
  const sautes = v.filter((x) => x.sort === "sauter") as Extract<Verdict, { sort: "sauter" }>[];
  const reportes = v.filter((x) => x.sort === "reporter") as Extract<Verdict, { sort: "reporter" }>[];
  const parMotif = new Map<string, number>();
  for (const s of sautes) parMotif.set(s.raison, (parMotif.get(s.raison) ?? 0) + 1);
  return {
    total: v.length,
    envoyer: v.filter((x) => x.sort === "envoyer").length,
    reporter: reportes.length,
    sauter: sautes.length,
    motifs: [...parMotif.entries()].map(([raison, n]) => ({ raison, n })).sort((a, b) => b.n - a.n),
    premierReport: reportes.length ? new Date(Math.min(...reportes.map((r) => r.quand.getTime()))) : null,
  };
}

/** Met la vague en file. Rend l'identifiant et le décompte réellement enregistré. */
export async function creerBlast(input: {
  bootcampId: string;
  statusId: string;
  template: string;
  language: string;
  variables: string[];
  capPolicy: CapPolicy;
  createdBy?: string | null;
}) {
  const modele = { template: input.template, language: input.language, variables: input.variables };
  const v = await verdicts(input.statusId, modele, input.capPolicy);
  if (v.length === 0) return { ok: false as const, error: "Cette colonne n'a aucun lead." };

  const [blast] = await db
    .insert(whatsappBlasts)
    .values({
      bootcampId: input.bootcampId,
      statusId: input.statusId,
      template: input.template,
      language: input.language,
      variables: input.variables,
      capPolicy: input.capPolicy,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  await db.insert(whatsappBlastTargets).values(
    v.map((x) => ({
      blastId: blast.id,
      leadId: x.leadId,
      status: x.sort === "sauter" ? "skipped" : "pending",
      reason: x.sort === "sauter" ? x.raison : null,
      scheduledAt: x.sort === "reporter" ? x.quand : null,
    }))
  );

  return {
    ok: true as const,
    blastId: blast.id,
    envoyer: v.filter((x) => x.sort === "envoyer").length,
    reporter: v.filter((x) => x.sort === "reporter").length,
    sauter: v.filter((x) => x.sort === "sauter").length,
  };
}

/**
 * Vide la file : les destinataires dus des vagues en cours. Appelé par le cron
 * des automatisations — pas de nouveau job externe à créer.
 *
 * `limite` borne un passage : une grosse vague part sur plusieurs tours, ce qui
 * la lisse naturellement (Meta n'aime pas les rafales).
 */
export async function traiterBlasts(limite = 60) {
  const bilan = { sent: 0, skipped: 0, failed: 0 };
  const enCours = await db.query.whatsappBlasts.findMany({ where: eq(whatsappBlasts.state, "running") });
  if (enCours.length === 0) return bilan;

  const dus = await db.query.whatsappBlastTargets.findMany({
    where: and(
      inArray(
        whatsappBlastTargets.blastId,
        enCours.map((b) => b.id)
      ),
      eq(whatsappBlastTargets.status, "pending"),
      or(isNull(whatsappBlastTargets.scheduledAt), lte(whatsappBlastTargets.scheduledAt, new Date()))
    ),
    orderBy: [asc(whatsappBlastTargets.scheduledAt)],
    limit: limite,
  });

  for (const cible of dus) {
    const blast = enCours.find((b) => b.id === cible.blastId)!;
    const r = await envoyerCible(cible.id, cible.leadId, blast);
    bilan[r] += 1;
  }

  // Une vague dont plus rien n'est en attente est terminée.
  for (const b of enCours) {
    const reste = await db.query.whatsappBlastTargets.findFirst({
      where: and(eq(whatsappBlastTargets.blastId, b.id), eq(whatsappBlastTargets.status, "pending")),
      columns: { id: true },
    });
    if (!reste) {
      await db.update(whatsappBlasts).set({ state: "done", finishedAt: new Date() }).where(eq(whatsappBlasts.id, b.id));
    }
  }
  return bilan;
}

/** Un destinataire : les gardes sont rejouées au dernier moment, pas à la mise en file. */
async function envoyerCible(
  targetId: string,
  leadId: string,
  blast: typeof whatsappBlasts.$inferSelect
): Promise<"sent" | "skipped" | "failed"> {
  const clore = async (status: "sent" | "skipped" | "failed", reason: string | null, wamid?: string) => {
    await db
      .update(whatsappBlastTargets)
      .set({ status, reason, sentAt: status === "sent" ? new Date() : null, whatsappId: wamid ?? null })
      .where(eq(whatsappBlastTargets.id, targetId));
    return status;
  };

  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), with: { contact: true, bootcamp: true } });
  if (!lead) return clore("skipped", "Lead supprimé");
  // Le lead a bougé depuis le clic : la vague visait une colonne, pas une liste.
  if (lead.statusId !== blast.statusId) return clore("skipped", "Le lead a quitté la colonne avant l'envoi");

  const variables = (blast.variables as string[]) ?? [];
  const categorie = await categorieDuModele(blast.template, blast.language);
  const marketing = categorie !== "UTILITY" && categorie !== "AUTHENTICATION";
  const v = await verdict(
    lead,
    { template: blast.template, language: blast.language, variables },
    marketing,
    "exclure" // à l'échéance, un plafond encore fermé = on saute : le report a déjà eu lieu
  );
  if (v.sort === "sauter") return clore("skipped", v.raison);

  const vars = buildVariables(lead, blast.language.startsWith("ar"));
  const valeurs = variables.map((n) => vars[n] ?? n);

  const { sendWhatsAppTemplate } = await import("@/lib/messaging/whatsapp");
  const envoi = await sendWhatsAppTemplate({
    to: lead.mobileNo!,
    template: blast.template,
    langue: blast.language,
    variables: valeurs,
  });
  if (!envoi.ok) return clore("failed", envoi.error);

  const { createActivity } = await import("@/lib/queries");
  const activite = await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "whatsapp",
    direction: "outbound",
    subject: `WhatsApp en masse — modèle « ${blast.template} »`,
    content: valeurs.length ? `Variables : ${valeurs.join(" · ")}` : "Modèle sans variable",
    createdBy: blast.createdBy ?? "campagne",
  });
  const { recordWhatsAppSent } = await import("@/lib/whatsapp-inbox");
  await recordWhatsAppSent(envoi.id, activite.id, null, blast.template);

  if (marketing && lead.contactId) {
    await db.update(contacts).set({ whatsappMarketingLastAt: new Date() }).where(eq(contacts.id, lead.contactId));
  }
  return clore("sent", null, envoi.id);
}

/** Mettre en pause ou reprendre une vague (le bouton « Arrêter » de l'écran). */
export async function changerEtatBlast(blastId: string, state: "running" | "paused") {
  await db.update(whatsappBlasts).set({ state }).where(eq(whatsappBlasts.id, blastId));
}

/** L'avancement d'une vague, pour l'écran. */
export async function etatBlast(blastId: string) {
  const blast = await db.query.whatsappBlasts.findFirst({ where: eq(whatsappBlasts.id, blastId) });
  if (!blast) return null;
  const cibles = await db.query.whatsappBlastTargets.findMany({
    where: eq(whatsappBlastTargets.blastId, blastId),
    columns: { status: true, reason: true },
  });
  const par = (s: string) => cibles.filter((c) => c.status === s).length;
  return {
    state: blast.state,
    template: blast.template,
    total: cibles.length,
    sent: par("sent"),
    pending: par("pending"),
    skipped: par("skipped"),
    failed: par("failed"),
  };
}
