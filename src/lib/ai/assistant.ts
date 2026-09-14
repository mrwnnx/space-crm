import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, runTool } from "@/lib/ai/assistant-tools";

const MODEL = "claude-opus-5";

/** Un agent qui boucle sans fin coûte cher et n'aboutit pas : on borne. */
const MAX_TOURS = 8;
const MAX_TOKENS = 4000;

const SYSTEM = `Tu es l'assistant du CRM de The Space Academy, une école de design en Tunisie. Tu parles à Marwen, le fondateur, ou à Fatma, qui suit les leads au téléphone.

Tu as accès en LECTURE aux données du CRM par des outils. Tu ne peux rien modifier pour l'instant : si on te demande une action qui écrit (déplacer, taguer, envoyer, inscrire), dis simplement que tu ne sais pas encore le faire et propose ce que tu peux faire à la place.

Comment travailler :
- Sers-toi des outils avant de répondre. Ne devine jamais un chiffre : va le chercher.
- Pour parler d'un lead précis, trouve d'abord son identifiant avec chercher_leads.
- Quand on te dit « lui » ou « ce lead » et qu'un lead est ouvert à l'écran, c'est de celui-là qu'il s'agit.

Comment répondre :
- En français, court, tutoiement. Pas de politesse, pas de préambule, pas de conclusion.
- Des noms et des chiffres, pas des généralités. « Appelle Ahmed Ben Salah, 92, il a cliqué la vidéo » et pas « concentre-toi sur les leads engagés ».
- Quand tu listes des gens, mets leur téléphone : le geste suivant est un appel.
- Si les données ne permettent pas de répondre, dis-le. Ne comble jamais un trou par une supposition.
- Un chiffre calculé sur peu de cas ne vaut rien : précise l'effectif quand il est petit.

Contexte utile : la plupart des leads viennent d'un formulaire de brochure ou d'inscription sur thespace.academy. Les gens répondent au téléphone et sur WhatsApp, beaucoup moins par email.`;

export type AssistantTurn =
  | { ok: true; reponse: string; outils: string[] }
  | { ok: false; message: string };

export async function askAssistant(
  historique: { role: "user" | "assistant"; content: string }[],
  question: string,
  contexte: string | null
): Promise<AssistantTurn> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Clé Anthropic absente — l'assistant ne peut pas répondre." };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [
    // Le fil précédent, borné : au-delà, on paie pour du contexte que personne
    // ne relit, et les vieux échanges brouillent la question du moment.
    ...historique.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: contexte ? `${contexte}\n\n${question}` : question },
  ];

  const outils: string[] = [];

  try {
    for (let tour = 0; tour < MAX_TOURS; tour++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        tools: TOOLS,
        messages,
      });

      const demandes = res.content.filter((c) => c.type === "tool_use");
      if (demandes.length === 0) {
        const texte = res.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();
        return { ok: true, reponse: texte || "Je n'ai rien trouvé à répondre.", outils };
      }

      messages.push({ role: "assistant", content: res.content });

      // Les outils d'un même tour sont indépendants : les lancer ensemble
      // divise l'attente quand le modèle en demande trois d'un coup.
      const resultats = await Promise.all(
        demandes.map(async (d) => {
          outils.push(d.name);
          let sortie: string;
          try {
            sortie = await runTool(d.name, (d.input ?? {}) as Record<string, unknown>);
          } catch (e) {
            // Un outil qui tombe ne doit pas tuer la conversation : le modèle
            // reçoit l'erreur et peut tenter autrement.
            sortie = `Erreur de l'outil : ${e instanceof Error ? e.message : "inconnue"}`;
          }
          return { type: "tool_result" as const, tool_use_id: d.id, content: sortie };
        })
      );
      messages.push({ role: "user", content: resultats });
    }

    return { ok: false, message: "Je me suis perdu dans mes recherches. Reformule ta question ?" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return {
      ok: false,
      message: /401|authentication|api[_ ]key/i.test(msg)
        ? "Clé Anthropic refusée ou expirée — l'assistant est muet tant qu'elle n'est pas renouvelée."
        : `Ça n'a pas marché : ${msg}`,
    };
  }
}
