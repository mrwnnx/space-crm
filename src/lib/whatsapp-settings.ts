import "server-only";
import { db } from "@/db";
import { whatsappSettings } from "@/db/schema";

/**
 * Les réglages du service WhatsApp — une ligne, créée à la première lecture.
 *
 * `aiReplyEnabled` n'a pas encore d'effet : la réponse automatique (lot 3)
 * le lira. Il existe d'abord pour que ce jour-là il n'y ait rien à ajouter à
 * l'écran, et pour que l'éteindre soit un clic.
 */
export async function getWhatsAppSettings() {
  const row = await db.query.whatsappSettings.findFirst();
  if (row) return row;
  const [created] = await db.insert(whatsappSettings).values({}).onConflictDoNothing().returning();
  return created ?? { id: true, aiReplyEnabled: false, updatedAt: new Date() };
}

export async function setAiReplyEnabled(enabled: boolean) {
  await getWhatsAppSettings(); // garantit la ligne
  await db.update(whatsappSettings).set({ aiReplyEnabled: enabled, updatedAt: new Date() });
}

export type AutoRepliesInput = {
  welcomeEnabled: boolean;
  welcomeText: string;
  awayEnabled: boolean;
  awayText: string;
  awayStart: number;
  awayEnd: number;
  awayDays: number[]; // ISO 1-7
};

export async function saveAutoReplies(input: AutoRepliesInput) {
  await getWhatsAppSettings(); // garantit la ligne
  await db.update(whatsappSettings).set({
    welcomeEnabled: input.welcomeEnabled,
    welcomeText: input.welcomeText,
    awayEnabled: input.awayEnabled,
    awayText: input.awayText,
    awayStart: input.awayStart,
    awayEnd: input.awayEnd,
    awayDays: input.awayDays.join(","),
    updatedAt: new Date(),
  });
}
