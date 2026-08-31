import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { leadInsights } from "@/db/schema";
import { eq } from "drizzle-orm";

const MODEL = "claude-opus-5";

const InsightSchema = z.object({
  summary: z
    .string()
    .describe("Une seule phrase, en français, qui résume qui est cette personne et ce qu'elle cherche. 20 mots maximum."),
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
});

const SYSTEM = `Tu qualifies des candidats à une formation UX/UI en Tunisie (The Space Academy).

Les textes sont écrits en français, en arabe tunisien (derija) ou dans un mélange des deux. Lis-les tels quels, ne traduis pas.

Ton rôle est d'aider un commercial à décider qui rappeler en premier. Sois franc : si quelqu'un n'a rien écrit de substantiel, dis « indetermine » plutôt que d'inventer un profil. Si une personne cherche manifestement autre chose que cette formation, dis « hors_cible ».

Réponds en français, brièvement. Pas de politesse, pas de préambule.`;

/** Ce qui est envoyé au modèle. Le hash de ce texte évite de repayer pour rien. */
function buildInput(lead: {
  fullName: string | null;
  jobTitle: string | null;
  motivation: string | null;
  intendedPlan: string | null;
  promoCode: string | null;
  bootcamp?: { name: string } | null;
  contact?: { age: number | null } | null;
}) {
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
  const input = buildInput(lead);
  const sourceHash = hashInput(input);

  const existing = await db.query.leadInsights.findFirst({
    where: eq(leadInsights.leadId, lead.id),
  });
  // Rien n'a changé depuis la dernière lecture : inutile de repayer.
  if (existing && existing.sourceHash === sourceHash && existing.model === MODEL) {
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
      output_config: { format: zodOutputFormat(InsightSchema), effort: "low" },
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
