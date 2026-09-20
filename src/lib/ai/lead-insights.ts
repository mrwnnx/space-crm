import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { activities, comments, leadInsights, leadTags, tags, tasks } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getLeadTimeline } from "@/lib/queries";

const MODEL = "claude-opus-5";

const InsightSchema = z.object({
  summary: z
    .string()
    .describe("Une ou deux phrases, en français : qui est cette personne, ce qu'elle cherche, et OÙ ON EN EST avec elle d'après le dossier (dernier contact, ce qu'elle a répondu). 40 mots maximum."),
  intent: z
    .enum(["serieux", "curieux", "hors_cible", "indetermine"])
    .describe(
      "serieux = motivation claire et engagement probable ; curieux = intéressé mais vague ; hors_cible = ne correspond pas à la formation ; indetermine = pas assez d'éléments"
    ),
  objection: z
    .string()
    .describe(
      "L'obstacle le plus probable à son inscription, en 5 mots maximum (ex. « prix », « manque de temps », « niveau de départ »). Vide si aucun ne ressort."
    ),
  recommendation: z
    .string()
    .describe(
      "La prochaine action concrète, en UNE phrase de 25 mots maximum, à l'impératif, déduite du dossier : « Réponds à son WhatsApp d'hier sur les horaires du soir, puis propose l'appel. » Parle de l'action et de l'angle, pas de généralités. Vide si tu n'as vraiment rien pour trancher."
    ),
});

const SYSTEM = `Tu qualifies des candidats à une formation UX/UI en Tunisie (The Space Academy).

Tu reçois le formulaire d'inscription ET tout le dossier de la personne : ses messages WhatsApp et emails dans les deux sens, les appels et leur résultat, les notes et commentaires de l'équipe, les changements de colonne, les tâches, les paiements, les messages automatiques envoyés. Le dossier va du plus récent au plus ancien.

Les textes sont écrits en français, en arabe tunisien (derija) ou dans un mélange des deux. Lis-les tels quels, ne traduis pas.

Ton rôle est d'aider un commercial à décider quoi faire MAINTENANT avec cette personne. Ce qu'elle a dit ou fait récemment pèse plus que le formulaire d'origine : une réponse WhatsApp d'hier compte plus qu'une motivation écrite il y a un mois. Sois franc : si rien de substantiel n'est écrit, dis « indetermine » plutôt que d'inventer un profil. Si la personne cherche manifestement autre chose que cette formation, dis « hors_cible ». Si elle a dit non, ou demandé qu'on arrête, dis-le dans la recommandation.

Réponds en français, brièvement. Pas de politesse, pas de préambule.`;

const DOSSIER_MAX = 12_000; // caractères : au-delà, on coupe le plus ancien

/**
 * Tout ce qui s'est passé avec cette personne, du plus récent au plus ancien,
 * en texte : c'est ce que le modèle lit en plus du formulaire. Chaque
 * nouvelle activité change ce texte, donc le hash, donc déclenche une relecture.
 */
async function buildDossier(leadId: string): Promise<string> {
  const [acts, coms, timeline, taches, etiquettes] = await Promise.all([
    db
      .select({ at: activities.createdAt, type: activities.type, direction: activities.direction, subject: activities.subject, content: activities.content, by: activities.createdBy })
      .from(activities)
      .where(and(eq(activities.referenceType, "lead"), eq(activities.referenceId, leadId)))
      .orderBy(desc(activities.createdAt)),
    db
      .select({ at: comments.createdAt, content: comments.content, by: comments.createdBy })
      .from(comments)
      .where(and(eq(comments.referenceType, "lead"), eq(comments.referenceId, leadId)))
      .orderBy(desc(comments.createdAt)),
    getLeadTimeline(leadId),
    db
      .select({ title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.referenceType, "lead"), eq(tasks.referenceId, leadId))),
    db
      .select({ name: tags.name })
      .from(leadTags)
      .innerJoin(tags, eq(tags.id, leadTags.tagId))
      .where(eq(leadTags.leadId, leadId)),
  ]);

  const quand = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Africa/Tunis", dateStyle: "short", timeStyle: "short" });
  const TYPE: Record<string, string> = {
    email: "Email", whatsapp: "WhatsApp", sms: "SMS", call: "Appel", note: "Note de l'équipe", comment: "Commentaire de l'équipe", webhook_in: "Formulaire", status_change: "Changement de colonne", task: "Tâche",
  };
  const qui = (a: { direction: string; by: string | null }) =>
    a.direction === "inbound" ? "reçu de la personne" : a.by === "automation" ? "envoyé automatiquement" : `envoyé par ${a.by ?? "l'équipe"}`;

  const lignes: { at: Date; texte: string }[] = [];
  for (const a of acts) {
    const corps = (a.content ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    lignes.push({ at: a.at, texte: `[${quand(a.at)}] ${TYPE[String(a.type)] ?? a.type} — ${qui(a)}${a.subject ? ` — ${a.subject}` : ""}${corps ? ` : ${corps}` : ""}` });
  }
  for (const c of coms) {
    lignes.push({ at: c.at, texte: `[${quand(c.at)}] Commentaire de ${c.by ?? "l'équipe"} : ${c.content.replace(/\s+/g, " ").trim().slice(0, 600)}` });
  }
  // La chronologie apporte ce que les activités n'ont pas : colonnes, appels
  // avec résultat, ouvertures et clics, paiements. Sans doubler les emails.
  for (const e of timeline) {
    if (e.kind === "email" || e.kind === "note") continue;
    lignes.push({ at: e.at, texte: `[${quand(e.at)}] ${e.label}${e.detail ? ` — ${e.detail}` : ""}${e.actor ? ` (${e.actor})` : ""}` });
  }
  lignes.sort((x, y) => y.at.getTime() - x.at.getTime());

  const entete = [
    etiquettes.length ? `Tags : ${etiquettes.map((t) => t.name).join(", ")}` : null,
    taches.length
      ? `Tâches : ${taches.map((t) => `${t.title} (${t.status === "done" ? "faite" : "à faire"}${t.dueDate ? `, ${quand(t.dueDate)}` : ""})`).join(" · ")}`
      : null,
  ].filter(Boolean);

  let corps = lignes.map((l) => l.texte).join("\n");
  if (corps.length > DOSSIER_MAX) corps = corps.slice(0, DOSSIER_MAX) + "\n[… plus ancien coupé]";
  return [...entete, "", corps || "(aucun échange, aucune action pour l'instant)"].join("\n");
}

/** Ce qui est envoyé au modèle. Le hash de ce texte évite de repayer pour rien. */
function buildInput(
  lead: {
    fullName: string | null;
    jobTitle: string | null;
    motivation: string | null;
    intendedPlan: string | null;
    promoCode: string | null;
    bootcamp?: { name: string } | null;
    contact?: { age: number | null } | null;
  },
  dossier: string
) {
  const lines = [
    `Formation visée : ${lead.bootcamp?.name ?? "inconnue"}`,
    `Situation déclarée : ${lead.jobTitle || "non renseignée"}`,
    `Âge : ${lead.contact?.age ?? "non renseigné"}`,
    `Formule choisie : ${
      lead.intendedPlan === "total"
        ? "paiement comptant"
        : lead.intendedPlan === "monthly"
          ? "paiement en plusieurs fois"
          : "non choisie"
    }`,
    `Code promo utilisé : ${lead.promoCode || "aucun"}`,
    "",
    "Ce que la personne a écrit quand on lui a demandé pourquoi elle veut suivre la formation :",
    lead.motivation?.trim() || "(elle n'a rien écrit)",
    "",
    "── LE DOSSIER, du plus récent au plus ancien ──",
    dossier,
  ];
  return lines.join("\n");
}

export function hashInput(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export type AnalyzeOutcome = "analysé" | "inchangé" | "erreur";

/**
 * Lit un lead et écrit son insight. Ne jette jamais : une erreur sur un lead
 * ne doit pas arrêter le lot.
 */
export async function analyzeLead(lead: Parameters<typeof buildInput>[0] & { id: string }): Promise<{
  outcome: AnalyzeOutcome;
  error?: string;
}> {
  const input = buildInput(lead, await buildDossier(lead.id));
  const sourceHash = hashInput(input);

  const existing = await db.query.leadInsights.findFirst({
    where: eq(leadInsights.leadId, lead.id),
  });
  // Rien n'a changé depuis la dernière lecture : inutile de repayer.
  //
  // `recommendation` fait partie de la condition : les analyses faites avant
  // l'ajout du champ ont le bon hash et le bon modèle, elles ne seraient donc
  // JAMAIS reprises et resteraient sans recommandation pour toujours.
  if (
    existing &&
    existing.sourceHash === sourceHash &&
    existing.model === MODEL &&
    existing.recommendation !== null
  ) {
    return { outcome: "inchangé" };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { outcome: "erreur", error: "ANTHROPIC_API_KEY absente" };
  }

  try {
    // Une clé « identity-linked » exige l'espace de travail en en-tête ; une
    // clé d'espace de travail classique le porte implicitement. On gère les deux.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}
    );
    const response = await client.messages.parse({
      model: MODEL,
      // Classification courte : pas besoin de plus, et ça borne le coût.
      max_tokens: 1024,
      // Classification courte : « low » réduit la profondeur de réflexion et la
      // latence, ce qui compte quand on enchaîne des dizaines de leads sous la
      // limite de durée d'une fonction serverless.
      // « medium » : le dossier demande plus de jugement qu'un formulaire seul.
      output_config: { format: zodOutputFormat(InsightSchema), effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: input }],
    });

    const parsed = response.parsed_output;
    if (!parsed) return { outcome: "erreur", error: "Réponse illisible" };

    const values = {
      leadId: lead.id,
      summary: parsed.summary.trim(),
      intent: parsed.intent,
      objection: parsed.objection.trim() || null,
      recommendation: parsed.recommendation.trim() || null,
      sourceHash,
      model: MODEL,
      createdAt: new Date(),
    };

    await db
      .insert(leadInsights)
      .values(values)
      .onConflictDoUpdate({ target: leadInsights.leadId, set: values });

    return { outcome: "analysé" };
  } catch (e) {
    return { outcome: "erreur", error: e instanceof Error ? e.message : "Échec de l'analyse" };
  }
}
