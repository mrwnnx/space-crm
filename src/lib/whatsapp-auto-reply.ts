import "server-only";
import { db } from "@/db";
import { activities, leads } from "@/db/schema";
import { and, desc, eq, gt, inArray, like } from "drizzle-orm";
import { getWhatsAppSettings } from "@/lib/whatsapp-settings";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { createActivity } from "@/lib/queries";
import { getWhatsAppThread, recordWhatsAppSent } from "@/lib/whatsapp-inbox";

/**
 * Les réponses automatiques à texte fixe — bienvenue et absence — comme dans
 * l'app WhatsApp Business. Appelées par `ingestInboundWhatsApp` UNE FOIS le
 * message reçu rangé : un raté ici ne perd jamais le message.
 *
 * Elles partent en texte libre : le lead vient d'écrire, la fenêtre de 24 h
 * est ouverte par construction.
 *
 * Ce n'est PAS l'IA (lot 3, `aiReplyEnabled`) : ici on ne lit pas la question.
 */

export const SUJET_BIENVENUE = "Bienvenue automatique";
export const SUJET_ABSENCE = "Message d'absence automatique";

/** Heure et jour ISO (1 = lundi … 7 = dimanche) à Tunis, quelle que soit la région du serveur. */
export function maintenantATunis(now = new Date()): { heure: number; jour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Tunis",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const heure = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const jours: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const jour = jours[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 1;
  return { heure, jour };
}

/** Hors horaires = jour non ouvré, ou heure hors [start, end). */
export function estHorsHoraires(
  r: { awayStart: number; awayEnd: number; awayDays: string },
  now = new Date()
): boolean {
  const { heure, jour } = maintenantATunis(now);
  const jours = r.awayDays.split(",").map(Number).filter(Boolean);
  if (!jours.includes(jour)) return true;
  return heure < r.awayStart || heure >= r.awayEnd;
}

function remplir(texte: string, lead: { fullName: string; bootcamp: string | null }) {
  return texte
    .replace(/\{\{firstName\}\}/g, lead.fullName.split(" ")[0] ?? "")
    .replace(/\{\{formation\}\}/g, lead.bootcamp?.split(" · ")[0] ?? "");
}

/**
 * Décide et envoie. `premierMessage` = ce message est le premier jamais reçu
 * de ce numéro (bienvenue). Ne jette jamais.
 */
export async function repondreAutomatiquement(leadId: string, premierMessage: boolean): Promise<void> {
  try {
    const r = await getWhatsAppSettings();
    if (!r.welcomeEnabled && !r.awayEnabled) return;

    const fil = await getWhatsAppThread(leadId);
    if (!fil?.lead.mobileNo) return;

    let sujet: string | null = null;
    let texte = "";
    if (r.welcomeEnabled && premierMessage && r.welcomeText.trim()) {
      sujet = SUJET_BIENVENUE;
      texte = r.welcomeText;
    } else if (r.awayEnabled && r.awayText.trim() && estHorsHoraires(r)) {
      // Une seule fois par 24 h pour ce numéro — sur toutes ses fiches.
      const fiches = await db.query.leads.findMany({
        where: eq(leads.mobileNo, fil.lead.mobileNo),
        columns: { id: true },
      });
      const ids = [fil.lead.id, ...fiches.map((f) => f.id)];
      const deja = await db.query.activities.findFirst({
        where: and(
          inArray(activities.referenceId, ids),
          eq(activities.type, "whatsapp"),
          like(activities.subject, `${SUJET_ABSENCE}%`),
          gt(activities.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        ),
        orderBy: [desc(activities.createdAt)],
      });
      if (deja) return;
      sujet = SUJET_ABSENCE;
      texte = r.awayText;
    }
    if (!sujet) return;

    const corps = remplir(texte, fil.lead).trim();
    const envoi = await sendWhatsApp({ to: fil.lead.mobileNo, body: corps });
    if (!envoi.ok) {
      console.error(`${sujet} — échec :`, envoi.error);
      return;
    }
    const activite = await createActivity({
      referenceType: "lead",
      referenceId: fil.lead.id,
      type: "whatsapp",
      direction: "outbound",
      subject: sujet,
      content: corps,
      createdBy: "automation",
    });
    if (envoi.sid) await recordWhatsAppSent(envoi.sid, activite.id);
  } catch (e) {
    console.error("Réponse automatique WhatsApp :", e);
  }
}
