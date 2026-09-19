import "server-only";
import { db } from "@/db";
import { whatsappButtonActions, whatsappMessages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { attachTagToLead, createActivity, createTask } from "@/lib/queries";
import { recordWhatsAppSent } from "@/lib/whatsapp-inbox";
import { echeanceTunis } from "@/lib/automation-delays";

// Un tap sur un bouton de modèle = une réponse du lead (la fenêtre de 24 h
// s'ouvre) ET une intention lisible par le CRM. Ici on la traduit : tag,
// réponse libre, tâche d'appel au créneau choisi, désabonnement. Le texte du
// bouton suffit à l'identifier ; le modèle cité lève l'ambiguïté quand deux
// modèles ont un bouton du même nom.

export type ActionBouton = typeof whatsappButtonActions.$inferSelect;

export const CALL_SLOTS = [
  { value: "now", label: "Maintenant" },
  { value: "evening", label: "Ce soir après 18 h" },
  { value: "tomorrow", label: "Demain matin" },
] as const;

/** L'échéance d'une tâche d'appel pour un créneau, heure de Tunis. */
export function echeanceCreneau(slot: string, now = new Date()): Date {
  if (slot === "evening") return echeanceTunis(now, 0, 18);
  if (slot === "tomorrow") return echeanceTunis(now, 1, 10);
  return now;
}

/** L'action configurée pour ce bouton, si elle existe. */
export async function trouverAction(
  buttonText: string,
  replyToWamid: string | null | undefined
): Promise<ActionBouton | null> {
  const texte = buttonText.trim();
  if (!texte) return null;
  let template: string | null = null;
  if (replyToWamid) {
    const m = await db.query.whatsappMessages.findFirst({
      where: eq(whatsappMessages.wamid, replyToWamid),
      columns: { template: true },
    });
    template = m?.template ?? null;
  }
  if (template) {
    const exacte = await db.query.whatsappButtonActions.findFirst({
      where: and(eq(whatsappButtonActions.template, template), eq(whatsappButtonActions.buttonText, texte)),
    });
    if (exacte) return exacte;
  }
  // Sans modèle connu (ancien client, bulle d'avant 0143) : le texte seul,
  // s'il n'est pas ambigu.
  const candidates = await db.query.whatsappButtonActions.findMany({
    where: eq(whatsappButtonActions.buttonText, texte),
  });
  return candidates.length === 1 ? candidates[0] : null;
}

/** Applique l'action. Ne jette jamais : le message est déjà rangé. Rend true si une réponse est partie. */
export async function appliquerActionBouton(
  action: ActionBouton,
  lead: { id: string; contactId: string | null; mobileNo: string; fullName: string },
  texteRecu: string
): Promise<{ aRepondu: boolean }> {
  let aRepondu = false;
  try {
    if (action.tagId) await attachTagToLead(lead.id, action.tagId);

    if (action.callSlot) {
      const slot = CALL_SLOTS.find((s) => s.value === action.callSlot);
      await createTask({
        title: `Rappeler ${lead.fullName} — ${slot?.label ?? action.callSlot}`,
        priority: action.callSlot === "now" ? "high" : "medium",
        status: "todo",
        dueDate: echeanceCreneau(action.callSlot),
        description: `Le lead a choisi « ${texteRecu} » sur WhatsApp.`,
        referenceType: "lead",
        referenceId: lead.id,
        createdBy: "whatsapp",
      });
    }

    if (action.optOut && lead.contactId) {
      const { appliquerOptOut } = await import("@/lib/whatsapp-optout");
      await appliquerOptOut(lead, "stop", texteRecu);
      aRepondu = true; // la confirmation STOP tient lieu de réponse
    } else if (action.replyText?.trim()) {
      const corps = action.replyText.trim();
      const envoi = await sendWhatsApp({ to: lead.mobileNo, body: corps });
      if (envoi.ok) {
        const activite = await createActivity({
          referenceType: "lead",
          referenceId: lead.id,
          type: "whatsapp",
          direction: "outbound",
          subject: `Réponse automatique au bouton « ${texteRecu} »`,
          content: corps,
          createdBy: "automation",
        });
        if (envoi.sid) await recordWhatsAppSent(envoi.sid, activite.id);
        aRepondu = true;
      } else {
        console.error("Réponse au bouton — échec :", envoi.error);
      }
    }
  } catch (e) {
    console.error("Action de bouton WhatsApp :", e);
  }
  return { aRepondu };
}

// ── Réglage depuis Paramètres → WhatsApp ────────────────────────────────

export async function listButtonActions(): Promise<ActionBouton[]> {
  return db.query.whatsappButtonActions.findMany();
}

export async function saveButtonAction(input: {
  template: string;
  buttonText: string;
  tagId: string | null;
  replyText: string | null;
  callSlot: string | null;
  optOut: boolean;
}) {
  const vide = !input.tagId && !input.replyText?.trim() && !input.callSlot && !input.optOut;
  if (vide) {
    await db
      .delete(whatsappButtonActions)
      .where(and(eq(whatsappButtonActions.template, input.template), eq(whatsappButtonActions.buttonText, input.buttonText)));
    return;
  }
  const valeurs = {
    tagId: input.tagId,
    replyText: input.replyText?.trim() || null,
    callSlot: input.callSlot,
    optOut: input.optOut,
  };
  await db
    .insert(whatsappButtonActions)
    .values({ template: input.template, buttonText: input.buttonText, ...valeurs })
    .onConflictDoUpdate({
      target: [whatsappButtonActions.template, whatsappButtonActions.buttonText],
      set: valeurs,
    });
}
