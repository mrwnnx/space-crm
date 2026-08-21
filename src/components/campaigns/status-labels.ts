/**
 * Libellés des statuts de campagne.
 *
 * Module NEUTRE — surtout pas "use client" : ces constantes sont lues par des
 * composants serveur (la fiche campagne) comme par des composants client (la
 * liste, les filtres). Importées depuis un module client, elles arrivent
 * `undefined` côté serveur, car Next y substitue des références.
 */
export const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft: { text: "Brouillon", className: "bg-muted text-muted-foreground" },
  scheduled: { text: "Programmée", className: "bg-blue-50 text-blue-700" },
  sending: { text: "Envoi en cours", className: "bg-amber-50 text-amber-700" },
  paused: { text: "Suspendue", className: "bg-orange-50 text-orange-700" },
  sent: { text: "Envoyée", className: "bg-green-50 text-green-700" },
  failed: { text: "Échec", className: "bg-red-50 text-red-700" },
  cancelled: { text: "Annulée", className: "bg-muted text-muted-foreground line-through" },
  archived: { text: "Archivée", className: "bg-muted text-muted-foreground" },
};
