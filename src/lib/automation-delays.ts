/**
 * Délais proposés dans l'écran d'automatisation.
 *
 * Module NEUTRE (ni "server-only" ni "use client") : la même liste sert à
 * l'écran (client) et à la validation serveur. Mise dans `automations.ts`
 * — qui est "server-only" — elle casserait le build du composant client.
 *
 * Au-delà de 0, la précision est au quart d'heure : la file part avec le
 * workflow GitHub, qui a le droit d'être en retard. D'où le « ≈ » : ne pas
 * promettre la minute.
 */
export const AUTOMATION_DELAYS = [
  { minutes: 0, label: "Immédiat" },
  { minutes: 15, label: "≈ 15 min" },
  { minutes: 60, label: "≈ 1 h" },
  { minutes: 180, label: "≈ 3 h" },
  { minutes: 1440, label: "≈ 1 jour" },
  { minutes: 2880, label: "≈ 2 jours" },
  { minutes: 10080, label: "≈ 7 jours" },
] as const;

export function delayLabel(minutes: number): string {
  return AUTOMATION_DELAYS.find((d) => d.minutes === minutes)?.label ?? `${minutes} min`;
}

// ── Le moment d'un envoi « J+n à h h », heure de Tunis ──────────────────
// Tunis est UTC+1 toute l'année (pas d'heure d'été) : une constante suffit,
// pas besoin d'une bibliothèque de fuseaux.
const TUNIS_OFFSET_MS = 60 * 60 * 1000;

/**
 * L'échéance d'une règle « J+delayDays à atHour » comptée depuis `entree`.
 * Si le moment est déjà passé (J+0 à 10 h, entré à 14 h), c'est le lendemain.
 */
export function echeanceTunis(entree: Date, delayDays: number, atHour: number): Date {
  const local = new Date(entree.getTime() + TUNIS_OFFSET_MS);
  local.setUTCDate(local.getUTCDate() + delayDays);
  local.setUTCHours(atHour, 0, 0, 0);
  if (local.getTime() - TUNIS_OFFSET_MS <= entree.getTime()) local.setUTCDate(local.getUTCDate() + 1);
  return new Date(local.getTime() - TUNIS_OFFSET_MS);
}

/** « J+3 · 18 h » pour le badge de colonne ; sinon le libellé du délai en minutes. */
export function timingLabel(r: { delayMinutes: number; delayDays?: number | null; atHour?: number | null }): string {
  if (r.atHour != null) return `J+${r.delayDays ?? 0} · ${r.atHour} h`;
  return delayLabel(r.delayMinutes);
}
