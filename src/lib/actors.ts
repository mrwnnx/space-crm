/**
 * Qui a fait quoi — la traduction d'un identifiant en nom lisible.
 *
 * Module neutre exprès : ni `"use client"`, ni `"server-only"`. Il est lu par la
 * requête (pour filtrer) ET par l'écran (pour afficher) ; l'enfermer d'un côté
 * casserait l'autre.
 *
 * La liste est écrite en dur, et c'est volontaire : l'équipe compte deux
 * personnes. Une table de correspondance pour deux noms coûterait plus cher que
 * ces six lignes. À compléter le jour où quelqu'un arrive.
 */

export type ActorGroup = "marwen" | "fatma" | "systeme" | "inconnu";

/** Un même humain peut avoir plusieurs adresses — `marwen@etikks.com` est un ancien compte. */
export const ACTOR_EMAILS: Record<Exclude<ActorGroup, "inconnu">, string[]> = {
  marwen: ["hello@thespace.academy", "marwen@etikks.com", "themarwen.tn@gmail.com"],
  fatma: ["contact.fatmaghorbel@gmail.com"],
  systeme: ["webhook", "automation", "assistant"],
};

export const ACTOR_LABEL: Record<ActorGroup, string> = {
  marwen: "Marwen",
  fatma: "Fatma",
  systeme: "Automatique",
  inconnu: "Auteur inconnu",
};

/** Le nom précis d'une ligne — plus fin que son groupe de filtre. */
export function actorName(raw: string | null): string {
  if (!raw) return "Auteur inconnu";
  if (raw === "webhook") return "Import";
  if (raw === "automation") return "Automatisation";
  if (raw === "assistant") return "Assistant";
  for (const [group, emails] of Object.entries(ACTOR_EMAILS)) {
    if (emails.includes(raw)) return ACTOR_LABEL[group as ActorGroup];
  }
  // Une adresse inconnue reste lisible : on montre ce qu'il y a avant l'arobase.
  return raw.split("@")[0];
}
