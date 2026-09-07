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
