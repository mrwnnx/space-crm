"use client";

import { useEffect } from "react";
import { markLeadSeenAction } from "@/app/actions";

/**
 * Éteint le marqueur « non traité » à la première ouverture de la fiche.
 *
 * Volontairement un effet client plutôt qu'un appel dans le Server Component :
 * écrire en base pendant le rendu d'une page est un effet de bord, rejoué à
 * chaque re-render et à chaque revalidation. Ici l'écriture part une seule fois,
 * après affichage, et l'utilisateur voit sa fiche sans attendre.
 *
 * `markLeadSeen` ne touche que les lignes dont `seen_at IS NULL` : rejouer
 * l'appel ne réécrit rien et n'écrase pas la date de première ouverture.
 */
export function MarkLeadSeen({ leadId }: { leadId: string }) {
  useEffect(() => {
    // Échec silencieux assumé : rater un marquage n'a aucune conséquence
    // visible, et ne doit surtout pas casser l'affichage de la fiche.
    markLeadSeenAction(leadId).catch(() => {});
  }, [leadId]);

  return null;
}
