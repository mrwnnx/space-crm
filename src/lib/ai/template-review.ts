import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = "claude-opus-5";

/**
 * Relecture d'un modèle WhatsApp AVANT de l'envoyer à Meta : passera-t-il,
 * dans quelle catégorie Meta le rangera, quoi corriger — et une version
 * corrigée que l'équipe peut reprendre d'un clic.
 *
 * Les règles viennent des docs Meta (relevées le 19/09) et de ce que Meta
 * a réellement fait sur nos modèles : c'est ce vécu qui manque aux règles écrites.
 */
const SYSTEM = `Tu relis des modèles de message WhatsApp Business (API Cloud de Meta) pour une école de formation tunisienne, Space Academy (bootcamp UX/UI). Tu dis s'ils seront acceptés par Meta, dans quelle catégorie, et tu proposes une version corrigée.

Règles de Meta :
- Catégorie UTILITY = suite directe à une action de la personne (brochure demandée, inscription confirmée, paiement attendu, rappel de rendez-vous). MARKETING = promotion, offre, code promo, relance commerciale, incitation à acheter. Un prix, une réduction, une date limite d'offre, « dernières places », « ne rate pas » ou un appel à s'inscrire rendent un message MARKETING, même soumis en UTILITY : Meta le reclasse (vécu : un rappel d'appel manqué, un rappel une heure avant l'appel, tous deux soumis UTILITY, ont été reclassés MARKETING).
- Un MARKETING ne part qu'aux personnes qui ont accepté la publicité ; un UTILITY part à toute personne ayant demandé quelque chose.
- Refus classiques : texte qui commence ou finit par une variable {{n}} (vécu : refusé) ; variables non numérotées dans l'ordre ({{1}} {{2}} {{5}}) ; trop de variables pour peu de texte ; raccourcisseur de lien (bit.ly…) ; ton menaçant ou culpabilisant (« dernière chance sinon… ») ; demande de données sensibles (carte bancaire complète, CIN).
- Corps ≤ 1024 caractères ; pas de tabulation ni de suite de 5 espaces ; pas de lettres persanes (ی ک ھ), qui passent pour de l'arabe mais n'en sont pas.
- Un lien WhatsApp (wa.me, chat.whatsapp.com) est interdit dans un BOUTON (vécu : refusé) ; il est accepté dans le texte.
- Une modification ne change jamais la catégorie d'un modèle déjà créé.

Style de l'école (à garder dans ta version) :
- Arabe tunisien (derja) en écriture arabe, tutoiement, ton chaleureux et direct ; les mots d'usage courant en français ou en anglais restent en lettres latines (formation, session, groupe, paiement, bootcamp, lien…), jamais translittérés.
- Les modèles commencent par « عسلامة {{1}}، » puis un retour à la ligne, quand {{1}} est le prénom.
- Garde les variables existantes, leur numéro et leur sens ; n'en ajoute pas. Garde les emojis s'ils aident.

Ta réponse :
- verdict : "passe" (rien de bloquant), "risque" (acceptable mais Meta pourrait refuser ou reclasser), "refus" (Meta refusera tel quel).
- categorieProbable : la catégorie où Meta le rangera vraiment.
- problemes : chaque problème, une phrase claire en français, sans jargon. Liste vide s'il n'y en a pas.
- conseils : au plus 3 améliorations utiles (clarté, ton, efficacité), en français.
- versionProposee : le texte corrigé complet, prêt à envoyer. Si rien n'est à changer, recopie le texte tel quel.`;

const ReviewSchema = z.object({
  verdict: z.enum(["passe", "risque", "refus"]),
  categorieProbable: z.enum(["MARKETING", "UTILITY"]),
  problemes: z.array(z.string()),
  conseils: z.array(z.string()),
  versionProposee: z.string(),
});

export type TemplateReview = z.infer<typeof ReviewSchema>;

export async function reviewWhatsAppTemplate(input: {
  name: string;
  category: string;
  language: string;
  body: string;
  buttons: string[];
}): Promise<{ ok: true; review: TemplateReview } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY absente" };
  try {
    // Même en-tête que la lecture des leads : une clé « identity-linked » exige l'espace de travail.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}
    );
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { format: zodOutputFormat(ReviewSchema), effort: "medium" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Nom du modèle : ${input.name}`,
            `Catégorie demandée : ${input.category}`,
            `Langue : ${input.language}`,
            `Boutons : ${input.buttons.length ? input.buttons.join(" · ") : "aucun"}`,
            "",
            "Texte :",
            input.body,
          ].join("\n"),
        },
      ],
    });
    if (!response.parsed_output) return { ok: false, error: "Réponse illisible, réessaie." };
    return { ok: true, review: response.parsed_output };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de la relecture" };
  }
}
