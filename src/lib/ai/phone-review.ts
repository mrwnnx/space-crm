import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = "claude-opus-5";

/**
 * La remarque de l'assistant sur un numéro que Meta ne pourra pas joindre :
 * ce qui cloche, et le numéro probable (indicatif compris) quand il se devine
 * — un mobile tunisien à 8 chiffres, un « 06… » français ou algérien, un
 * « 00… » international. Il ne corrige rien lui-même : il propose.
 */
const SYSTEM = `Tu aides une école tunisienne à corriger des numéros de téléphone mal saisis avant un envoi WhatsApp.
Meta exige le numéro international, indicatif compris, sans 0 ni + de tête (ex. 21650978686).

Repères :
- Tunisie : indicatif 216 + 8 chiffres (mobiles commençant par 2, 4, 5, 9). Un numéro à 8 chiffres est presque toujours tunisien.
- France : 06/07 + 8 chiffres en national → 33 6… / 33 7….
- Algérie : 05/06/07 + 8 chiffres en national → 213 5… / 6… / 7….
- Maroc : 06/07 + 8 chiffres → 212 6… / 7…. Libye 218, Égypte 20 (mobiles 01x en national → 20 1x…).
- « 00 » en tête = préfixe international à retirer.
- Trop peu de chiffres (moins de 8) : impossible à deviner, dis-le.
Sers-toi de l'email (domaine .fr, .dz, .tn…), du nom et du numéro WhatsApp s'il existe pour trancher entre plusieurs pays.

Réponds en français, en une ou deux phrases claires, sans jargon. Quand il faut confirmer, c'est auprès de la personne elle-même (c'est un lead, pas un enfant). Propose un numéro seulement si tu es raisonnablement sûr ; sinon numeroPropose vide.`;

const Schema = z.object({
  remarque: z.string(),
  numeroPropose: z.string(),
});

export async function reviewPhone(input: {
  nom: string;
  numero: string | null;
  email: string | null;
  whatsapp: string | null;
}): Promise<{ ok: true; remarque: string; numeroPropose: string | null } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY absente" };
  try {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    const client = new Anthropic(
      workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}
    );
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { format: zodOutputFormat(Schema), effort: "low" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Nom : ${input.nom}`,
            `Numéro saisi : ${input.numero ?? "(vide)"}`,
            `Email : ${input.email ?? "(aucun)"}`,
            `Numéro WhatsApp noté à part : ${input.whatsapp ?? "(aucun)"}`,
          ].join("\n"),
        },
      ],
    });
    const p = response.parsed_output;
    if (!p) return { ok: false, error: "Réponse illisible, réessaie." };
    const chiffres = p.numeroPropose.replace(/\D/g, "");
    return { ok: true, remarque: p.remarque.trim(), numeroPropose: chiffres || null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de la remarque" };
  }
}
