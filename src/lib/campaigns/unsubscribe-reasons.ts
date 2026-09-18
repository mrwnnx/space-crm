// Module NEUTRE (ni "server-only" ni "use client") : la page publique de
// désabonnement et les stats de campagne lisent la même liste.

/** Les raisons proposées à la personne, dans l'ordre affiché. Un clic chacune. */
export const UNSUBSCRIBE_REASONS = [
  { value: "not_interested", label: "Je ne suis plus intéressé(e) par la formation UX" },
  { value: "too_many", label: "Trop d'emails" },
  { value: "never_signed_up", label: "Je ne me souviens pas m'être inscrit(e)" },
  { value: "other_training", label: "J'ai choisi une autre formation" },
  { value: "other", label: "Autre" },
] as const;

export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number]["value"];

/** Libellés pour les stats — y compris ce que la personne n'a pas choisi. */
export const REASON_LABEL: Record<string, string> = Object.fromEntries([
  ...UNSUBSCRIBE_REASONS.map((r) => [r.value, r.label]),
  // Le bouton « Se désabonner » de Gmail : un POST silencieux, aucune question possible.
  ["one_click", "Gmail, en un clic"],
  ["none", "Sans réponse"],
]);

export function isUnsubscribeReason(v: unknown): v is UnsubscribeReason {
  return UNSUBSCRIBE_REASONS.some((r) => r.value === v);
}
