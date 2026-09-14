import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Gap } from "@/lib/stats-gaps";
import type { GapTarget } from "@/lib/queries";

const MODEL = "claude-opus-5";

/**
 * Le conseil derrière une pastille ✦.
 *
 * ⚠️ Le modèle ne décide PAS s'il y a un problème — une règle l'a déjà fait, et
 * elle lui passe les chiffres et la liste des gens. Son travail se limite à
 * dire quoi faire, dans l'ordre. Il ne peut donc pas inventer un fait : tous
 * ceux dont il dispose sont vrais.
 */
const AdviceSchema = z.object({
  conseils: z
    .array(
      z.object({
        action: z
          .string()
          .describe(
            "UNE action concrète, à l'impératif, 25 mots maximum. Elle doit être faisable aujourd'hui depuis le CRM ou le téléphone. Appuie-toi sur les chiffres donnés et cite-les. Interdit : « améliorez votre taux », « optimisez », « mettez en place une stratégie »."
          ),
        pourquoi: z
          .string()
          .describe("Le chiffre qui justifie cette action, en 12 mots maximum. Vide si l'action se suffit."),
      })
    )
    .min(1)
    .max(2)
    .describe("Une ou deux actions, la plus rentable en premier. Deux seulement si la seconde est vraiment différente."),
});

export type StatsAdvice = z.infer<typeof AdviceSchema>;

const SYSTEM = `Tu conseilles le fondateur d'une école de design en Tunisie (The Space Academy) sur sa pipeline de prospects.

On te donne un constat déjà établi et des chiffres déjà vérifiés. Tu ne remets pas les chiffres en cause et tu n'en inventes aucun.

Ton seul travail : dire quoi faire, concrètement, aujourd'hui.

Règles :
- Parle de gens et de gestes, jamais de concepts. « Appelle les 20 qui ont demandé un rappel » et pas « améliore ton suivi ».
- Cite les chiffres qu'on te donne, ils rendent le conseil crédible.
- Une école tunisienne : les gens répondent au téléphone et sur WhatsApp, beaucoup moins par email.
- Si une seule action vaut le coup, n'en donne qu'une. Deux conseils tièdes valent moins qu'un bon.
- Tutoie. Pas de politesse, pas de préambule, pas de conclusion.
- Reste sur le sujet du constat. Si le constat parle des colonnes, ne conseille pas sur les paiements : chaque bloc a sa propre pastille.
- Ne propose jamais de vérifier quelque chose qui est marqué « déjà vérifié » dans les faits.`;

export async function adviseOnGap(
  gap: Gap,
  cibles: GapTarget[],
  contexte: { formation: string }
): Promise<{ ok: true; advice: StatsAdvice } | { ok: false; message: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Clé Anthropic absente — le constat et la liste restent lisibles." };
  }

  const input = [
    `Formation : ${contexte.formation}`,
    `Constat : ${gap.constat}`,
    "",
    "Chiffres vérifiés :",
    ...gap.faits.map((f) => `- ${f}`),
    cibles.length
      ? `\nLe CRM peut afficher immédiatement une liste de ${cibles.length} personnes concernées, avec leur téléphone.`
      : "\nAucune liste de personnes n'est associée à ce constat.",
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 1200,
      // Le conseil demande un vrai raisonnement — croiser plusieurs chiffres —
      // là où la classification d'un lead se contente de « low ».
      output_config: { format: zodOutputFormat(AdviceSchema), effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content: input }],
    });
    const parsed = res.parsed_output;
    if (!parsed) return { ok: false, message: "Réponse illisible du modèle." };
    return { ok: true, advice: parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    // Une clé expirée est le scénario attendu fin septembre : il faut le DIRE,
    // pas rendre un panneau vide.
    return {
      ok: false,
      message: /401|authentication|api[_ ]key/i.test(msg)
        ? "Clé Anthropic refusée ou expirée. Le constat et la liste restent utilisables."
        : `Le conseil n'a pas pu être écrit : ${msg}`,
    };
  }
}
