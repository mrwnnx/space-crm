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
