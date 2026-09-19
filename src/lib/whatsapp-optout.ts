import "server-only";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { createActivity } from "@/lib/queries";
import { recordWhatsAppSent } from "@/lib/whatsapp-inbox";
import { TEXTE_START, TEXTE_STOP } from "@/lib/whatsapp-consent";

// STOP / START reçus sur WhatsApp. Meta exige d'honorer un opt-out tout de
// suite ; un START vaut opt-in (donné dans le fil, c'est admis). La
// confirmation part en texte libre : la personne vient d'écrire, la fenêtre
// est ouverte. Ne jette jamais : le message est déjà rangé.
export async function appliquerOptOut(
  lead: { id: string; contactId: string | null; mobileNo: string },
  motCle: "stop" | "start",
  texteRecu: string
): Promise<void> {
  try {
    if (!lead.contactId) return;
    const now = new Date();
    if (motCle === "stop") {
      await db
        .update(contacts)
        .set({ whatsappUnsubscribedAt: now, updatedAt: now })
        .where(eq(contacts.id, lead.contactId));
    } else {
      await db
        .update(contacts)
        .set({
          whatsappUnsubscribedAt: null,
          whatsappConsentAt: now,
          whatsappConsentSource: "WhatsApp — a répondu START",
          whatsappConsentText: texteRecu.trim(),
          updatedAt: now,
        })
        .where(eq(contacts.id, lead.contactId));
    }

    const corps = motCle === "stop" ? TEXTE_STOP : TEXTE_START;
    const envoi = await sendWhatsApp({ to: lead.mobileNo, body: corps });
    if (!envoi.ok) {
      console.error(`Confirmation ${motCle.toUpperCase()} WhatsApp — échec :`, envoi.error);
      return;
    }
    const activite = await createActivity({
      referenceType: "lead",
      referenceId: lead.id,
      type: "whatsapp",
      direction: "outbound",
      subject: motCle === "stop" ? "Désabonnement WhatsApp confirmé (STOP)" : "Réabonnement WhatsApp confirmé (START)",
      content: corps,
      createdBy: "automation",
    });
    if (envoi.sid) await recordWhatsAppSent(envoi.sid, activite.id);
  } catch (e) {
    console.error("Opt-out WhatsApp :", e);
  }
}
