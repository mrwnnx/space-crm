import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { activities, comments, leadInsights, leads, leadTags, tags, tasks } from "@/db/schema";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getLeadTimeline } from "@/lib/queries";
import { getFilWhatsApp, signauxWhatsApp, type SignalWhatsApp } from "@/lib/ai/lead-whatsapp";

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
  temperature: z
    .enum(["hot", "cold"])
    .describe(
      "La température que tu PROPOSES au commercial (il décide) : hot = à traiter en priorité, il avance vers l'inscription ; cold = rien d'actif, ou il s'éloigne."
    ),
  preuve: z
    .string()
    .describe(
      "LE fait qui justifie la température, 20 mots maximum : sa phrase exacte entre guillemets (« كيفاش ننجم نخلص ») ou un fait daté (« 3 messages lus sans réponse depuis le 12/09 »). Jamais une impression."
    ),
  prochaine_action: z
    .string()
    .describe(
      "L'action en 3 à 8 mots, à l'infinitif, sans nom propre : « l'appeler aujourd'hui », « lui envoyer le code promo », « laisser mûrir une semaine », « ne plus relancer »."
    ),
});

const SYSTEM = `Tu qualifies des candidats à une formation UX/UI en Tunisie (The Space Academy).

Tu reçois le formulaire d'inscription ET tout le dossier de la personne : ses messages WhatsApp et emails dans les deux sens, les appels et leur résultat, les notes et commentaires de l'équipe, les changements de colonne, les tâches, les paiements, les messages automatiques envoyés. Le dossier va du plus récent au plus ancien.

Les textes sont écrits en français, en arabe tunisien (derija) ou dans un mélange des deux. Lis-les tels quels, ne traduis pas.

Ton rôle est d'aider un commercial à décider quoi faire MAINTENANT avec cette personne. Ce qu'elle a dit ou fait récemment pèse plus que le formulaire d'origine : une réponse WhatsApp d'hier compte plus qu'une motivation écrite il y a un mois. Sois franc : si rien de substantiel n'est écrit, dis « indetermine » plutôt que d'inventer un profil. Si la personne cherche manifestement autre chose que cette formation, dis « hors_cible ». Si elle a dit non, ou demandé qu'on arrête, dis-le dans la recommandation.

Tu reçois aussi des SIGNAUX WhatsApp calculés sur tout le fil de son numéro (toutes ses fiches). Ce sont des faits, pas des avis : appuie-toi dessus pour la température.
- Chaud : questions de prix, de paiement, de date ou d'inscription ; formulaire « نحب نسجل » rempli ; répond vite ; écrit de lui-même ; dit qu'il TRAVAILLE — c'est un bon signe, il peut payer.
- Froid : « ما يهمنيش » ; messages lus sans réponse ; silence après nos relances.
- Frein : trop cher, pas le temps, veut réfléchir — un frein n'est pas un refus, dis-le dans la prochaine action.
Le plus récent l'emporte : une question de prix d'hier après un silence d'un mois, c'est chaud.

Réponds en français, brièvement. Pas de politesse, pas de préambule.`;

const DOSSIER_MAX = 12_000; // caractères : au-delà, on coupe le plus ancien

/**
 * Tout ce qui s'est passé avec cette personne, du plus récent au plus ancien,
 * en texte : c'est ce que le modèle lit en plus du formulaire. Chaque
 * nouvelle activité change ce texte, donc le hash, donc déclenche une relecture.
 *
 * Le WhatsApp vient du NUMÉRO, pas de la fiche : ses messages envoyés depuis
 * une autre fiche (autre formation, session reportée) sont la même
 * conversation. Les signaux calculés sur ce fil sortent à part : ils vont dans
 * l'entrée du modèle ET sur l'écran.
 */
async function buildDossier(leadId: string): Promise<{ texte: string; signaux: SignalWhatsApp[]; aEcritSurWhatsApp: boolean }> {
  const [acts, coms, timeline, taches, etiquettes, fil] = await Promise.all([
    db
      .select({ at: activities.createdAt, type: activities.type, direction: activities.direction, subject: activities.subject, content: activities.content, by: activities.createdBy })
      .from(activities)
      .where(and(eq(activities.referenceType, "lead"), eq(activities.referenceId, leadId), ne(activities.type, "whatsapp")))
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
    getFilWhatsApp(leadId),
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
  // Le fil WhatsApp du numéro. « lu » dit qu'il a vu sans répondre — c'est
  // précisément ce qu'un texte seul ne montre pas.
  for (const m of fil.messages) {
    const sens =
      m.direction === "inbound"
        ? "reçu de la personne"
        : `${m.by === "automation" ? "envoyé automatiquement" : `envoyé par ${m.by ?? "l'équipe"}`}${m.status === "read" ? " (lu)" : m.status === "failed" ? " (échec d'envoi)" : ""}`;
    const fiche = m.autreFiche ? ` [fiche « ${m.autreFiche} »]` : "";
    lignes.push({ at: m.at, texte: `[${quand(m.at)}] WhatsApp — ${sens}${fiche}${m.content ? ` : ${m.content}` : ""}` });
  }
  // La chronologie apporte ce que les activités n'ont pas : colonnes, appels
  // avec résultat, ouvertures et clics, paiements. Sans doubler les emails
  // ni les WhatsApp (le fil du numéro ci-dessus les porte, texte compris).
  for (const e of timeline) {
    if (e.kind === "email" || e.kind === "note" || e.kind === "whatsapp") continue;
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
  return {
    texte: [...entete, "", corps || "(aucun échange, aucune action pour l'instant)"].join("\n"),
    signaux: signauxWhatsApp(fil),
    aEcritSurWhatsApp: fil.messages.some((m) => m.direction === "inbound"),
  };
}

const SENS: Record<SignalWhatsApp["sens"], string> = { chaud: "🔥 chaud", froid: "❄️ froid", frein: "⚠️ frein" };

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
  dossier: string,
  signaux: SignalWhatsApp[] = []
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
    // Seulement s'il y en a : une fiche sans WhatsApp garde le même texte,
    // donc le même hash, et n'est pas relue pour rien.
    ...(signaux.length
      ? ["", "── SIGNAUX WHATSAPP (calculés sur tout le fil du numéro) ──", ...signaux.map((s) => `${SENS[s.sens]} : ${s.label}`)]
      : []),
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

// Marque les lectures écrites SANS appeler l'IA.
const SANS_IA = "sans-ia";

/**
 * La personne a-t-elle dit ou fait quelque chose de lisible ? Un message reçu,
 * une note, un commentaire ou un appel. Le formulaire d'arrivée et nos envois
 * automatiques ne comptent pas : mesuré le 25/09, sur 324 fiches sans rien de
 * tout ça, l'IA a répondu « indéterminé » 316 fois — on payait pour rien.
 */
async function aUnSignal(leadId: string, motivation: string | null) {
  if (motivation?.trim()) return true;
  const [r] = await db.execute<{ oui: boolean }>(sql`
    select exists (select 1 from activities a where a.reference_type = 'lead' and a.reference_id = ${leadId}
                     and ((a.direction = 'inbound' and a.type <> 'webhook_in') or a.type in ('note', 'call', 'comment')))
        or exists (select 1 from comments c where c.reference_type = 'lead' and c.reference_id = ${leadId})
        or exists (select 1 from call_logs cl where cl.reference_type = 'lead' and cl.reference_id = ${leadId}) as oui`);
  return !!r?.oui;
}

/**
 * Lit un lead et écrit son insight. Ne jette jamais : une erreur sur un lead
 * ne doit pas arrêter le lot.
 */
export async function analyzeLead(lead: Parameters<typeof buildInput>[0] & { id: string }): Promise<{
  outcome: AnalyzeOutcome;
  error?: string;
}> {
  const dossier = await buildDossier(lead.id);
  const input = buildInput(lead, dossier.texte, dossier.signaux);
  const sourceHash = hashInput(input);

  const existing = await db.query.leadInsights.findFirst({
    where: eq(leadInsights.leadId, lead.id),
  });
  // Rien n'a changé depuis la dernière lecture : inutile de repayer.
  //
  // `recommendation` fait partie de la condition : les analyses faites avant
  // l'ajout du champ ont le bon hash et le bon modèle, elles ne seraient donc
  // JAMAIS reprises et resteraient sans recommandation pour toujours.
  // `suggestedTemperature`, même raison pour les champs de 0156 (toujours
  // rempli par le modèle : c'est un enum obligatoire du schéma).
  if (
    existing &&
    existing.sourceHash === sourceHash &&
    existing.model === MODEL &&
    existing.recommendation !== null &&
    existing.suggestedTemperature !== null
  ) {
    return { outcome: "inchangé" };
  }

  // Rien à lire : on écrit la réponse que l'IA aurait donnée, sans la payer.
  // Elle compte comme lue (le bouton « Analyser » ne tourne pas en boucle) ;
  // le premier message, note ou appel changera le hash et la fera relire.
  // Un message reçu sur une AUTRE fiche du même numéro est un signal aussi.
  if (!dossier.aEcritSurWhatsApp && !(await aUnSignal(lead.id, lead.motivation))) {
    if (existing?.model === SANS_IA && existing.sourceHash === sourceHash && existing.nextAction !== null) return { outcome: "inchangé" };
    const values = {
      leadId: lead.id,
      summary: "Rien à lire pour l'instant : aucun message, note ou appel, et pas de motivation écrite.",
      intent: "indetermine" as const,
      objection: null,
      recommendation: "Premier contact à faire : appeler ou écrire pour ouvrir l'échange.",
      // Rien lu, rien à proposer : la température reste celle qu'un humain a mise.
      suggestedTemperature: null,
      temperatureProof: null,
      nextAction: "ouvrir l'échange",
      waSignals: dossier.signaux,
      sourceHash,
      model: SANS_IA,
      createdAt: new Date(),
    };
    await db
      .insert(leadInsights)
      .values(values)
      .onConflictDoUpdate({ target: leadInsights.leadId, set: values });
    return { outcome: "analysé" };
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
      // 2048 : trois champs de plus (0156) — une sortie tronquée se lit
      // « Réponse illisible », pas « trop courte ».
      max_tokens: 2048,
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
      suggestedTemperature: parsed.temperature,
      temperatureProof: parsed.preuve.trim() || null,
      nextAction: parsed.prochaine_action.trim() || null,
      waSignals: dossier.signaux,
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

/**
 * Relecture ~30 min après la fin d'une conversation WhatsApp (appelée par le
 * cron, cf. /api/cron/lead-insights).
 *
 * Candidats : les fiches dont le dernier WhatsApp REÇU date de plus de 30 min
 * — la conversation est retombée — ET est postérieur à leur dernière lecture.
 * Une seule requête agrégée, bornée aux 3 derniers jours : au-delà, la
 * relecture à l'ouverture de la fiche s'en charge. Le hash fait le reste : pas
 * d'appel si rien n'a changé.
 *
 * `limite` et `budgetMs` bornent le coût et la durée d'un passage ; ce qui
 * reste passe au suivant, les plus récents d'abord.
 */
export async function relireConversationsRetombees(limite = 10, budgetMs = 100_000) {
  const debut = Date.now();
  const candidats = await db.execute<{ lead_id: string }>(sql`
    select d.lead_id
    from (
      select a.reference_id as lead_id, max(a.created_at) as dernier
      from activities a
      where a.reference_type = 'lead' and a.type = 'whatsapp' and a.direction = 'inbound'
        and a.created_at > now() - interval '3 days'
      group by a.reference_id
    ) d
    left join lead_insights li on li.lead_id = d.lead_id
    where d.dernier < now() - interval '30 minutes'
      and (li.created_at is null or li.created_at < d.dernier)
    order by d.dernier desc
    limit ${limite}
  `);
  const ids = candidats.map((c) => c.lead_id);
  const bilan = { candidats: ids.length, analyses: 0, inchanges: 0, erreurs: 0, reportes: 0 };
  if (!ids.length) return bilan;

  const fiches = await db.query.leads.findMany({
    where: inArray(leads.id, ids),
    columns: { id: true, fullName: true, jobTitle: true, motivation: true, intendedPlan: true, promoCode: true },
    with: { bootcamp: { columns: { name: true } }, contact: { columns: { age: true } } },
  });

  // Séquentiel, pour la même raison que analyzeLeadsAction : N appels en
  // parallèle tiendraient N connexions pendant la latence du modèle.
  for (const f of fiches) {
    if (Date.now() - debut > budgetMs) {
      bilan.reportes++;
      continue;
    }
    const r = await analyzeLead(f);
    if (r.outcome === "analysé") bilan.analyses++;
    else if (r.outcome === "inchangé") bilan.inchanges++;
    else bilan.erreurs++;
  }
  return bilan;
}
