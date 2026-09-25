import "server-only";
import { db } from "@/db";
import { whatsappSettings } from "@/db/schema";

/**
 * Les réglages du service WhatsApp — une ligne, créée à la première lecture.
 *
 * `aiReplyEnabled` est inerte : l'assistant WhatsApp lit `aiMode` (0151).
 */
export async function getWhatsAppSettings() {
  const row = await db.query.whatsappSettings.findFirst();
  if (row) return row;
  const [created] = await db.insert(whatsappSettings).values({}).onConflictDoNothing().returning();
  return created ?? { id: true, aiReplyEnabled: false, updatedAt: new Date() };
}

/** L'assistant WhatsApp : mode (éteint / répétition / automatique), seuil, consignes. */
export async function saveAssistantReglages(input: { mode: "off" | "repetition" | "auto"; threshold: number; instructions: string }) {
  await getWhatsAppSettings(); // garantit la ligne
  await db
    .update(whatsappSettings)
    .set({ aiMode: input.mode, aiThreshold: input.threshold, aiInstructions: input.instructions, updatedAt: new Date() });
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
