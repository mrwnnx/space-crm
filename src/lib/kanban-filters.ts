/**
 * Les filtres de la pipeline.
 *
 * Module neutre : les prédicats sont lus par le kanban (navigateur) et la
 * définition des critères sert aussi à compter. Tout est déjà chargé côté
 * client — filtrer ne coûte aucune requête.
 *
 * ⚠️ Les critères écartés, et pourquoi : le TAG et la LECTURE IA sont présents
 * sur 266 leads sur 266 de la formation september. Un filtre qui ne sépare
 * personne encombre la barre sans rien rendre.
 */

export type FiltrableLead = {
  wantsCall: boolean | null;
  formSourceId: string | null;
  intendedPlan: string | null;
  promoCode: string | null;
  motivation: string | null;
  jobTitle: string | null;
  qualification: string | null;
  nextFollowUpAt: Date | string | null;
  seenAt: Date | string | null;
  stageEnteredAt: Date | string | null;
  createdAt: Date | string;
  multiForm?: boolean;
  engaged?: { opened: boolean; clicked: boolean; video: boolean } | null;
  called?: boolean;
};

export type FiltreId =
  | "veut_appel" | "pas_appel" | "comptant" | "facilite" | "code_promo"
  | "a_ouvert" | "a_clique" | "a_ecrit" | "metier" | "double_formulaire"
  | "jamais_appele" | "jamais_ouvert" | "immobile" | "rappel_du" | "qualifie";

export type Groupe = "demande" | "fait" | "traitement";

export const GROUPE_LABEL: Record<Groupe, string> = {
  demande: "Ce qu'il a demandé",
  fait: "Ce qu'il a fait",
  traitement: "Ce qu'on en a fait",
};

const rempli = (v: unknown) => typeof v === "string" && v.trim() !== "";
const jours = (d: Date | string | null) =>
  d ? (Date.now() - new Date(d).getTime()) / 86400000 : 0;

export const FILTRES: { id: FiltreId; label: string; groupe: Groupe; test: (l: FiltrableLead) => boolean }[] = [
  { id: "veut_appel", label: "Veut un appel", groupe: "demande", test: (l) => l.wantsCall === true },
  { id: "pas_appel", label: "Ne veut pas d'appel", groupe: "demande", test: (l) => l.wantsCall === false },
  { id: "comptant", label: "Paiement comptant", groupe: "demande", test: (l) => l.intendedPlan === "total" },
  { id: "facilite", label: "Paiement en plusieurs fois", groupe: "demande", test: (l) => l.intendedPlan === "monthly" },
  { id: "code_promo", label: "A un code promo", groupe: "demande", test: (l) => rempli(l.promoCode) },

  { id: "a_clique", label: "A cliqué un email", groupe: "fait", test: (l) => l.engaged?.clicked === true },
  { id: "a_ouvert", label: "A ouvert un email", groupe: "fait", test: (l) => l.engaged?.opened === true },
  { id: "a_ecrit", label: "A écrit une motivation", groupe: "fait", test: (l) => rempli(l.motivation) },
  { id: "metier", label: "Métier renseigné", groupe: "fait", test: (l) => rempli(l.jobTitle) },
  { id: "double_formulaire", label: "Brochure puis inscription", groupe: "fait", test: (l) => l.multiForm === true },

  { id: "jamais_appele", label: "Jamais appelé", groupe: "traitement", test: (l) => l.called !== true },
  { id: "jamais_ouvert", label: "Jamais ouvert par nous", groupe: "traitement", test: (l) => l.seenAt === null },
  { id: "immobile", label: "Immobile depuis 7 j", groupe: "traitement", test: (l) => jours(l.stageEnteredAt ?? l.createdAt) >= 7 },
  { id: "rappel_du", label: "Rappel dû", groupe: "traitement", test: (l) => !!l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date() },
  { id: "qualifie", label: "Qualifié au téléphone", groupe: "traitement", test: (l) => rempli(l.qualification) },
];

export type TriId = "recent" | "ancien" | "immobile";

export const TRIS: { id: TriId; label: string }[] = [
  { id: "recent", label: "Plus récents" },
  { id: "ancien", label: "Plus anciens" },
  { id: "immobile", label: "Les plus immobiles" },
];

export function comparer(tri: TriId) {
  return (a: FiltrableLead, b: FiltrableLead) => {
    if (tri === "ancien") return +new Date(a.createdAt) - +new Date(b.createdAt);
    if (tri === "immobile") {
      // Le temps passé DANS LA COLONNE, pas depuis l'arrivée : un lead entré
      // hier dans « Intéressé » n'est pas immobile, même s'il date d'un mois.
      const va = +new Date(a.stageEnteredAt ?? a.createdAt);
      const vb = +new Date(b.stageEnteredAt ?? b.createdAt);
      return va - vb;
    }
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  };
}

/** Tous les filtres actifs doivent passer : on cumule, on n'additionne pas. */
export function passe(l: FiltrableLead, actifs: Set<string>, formSourceId: string | null): boolean {
  if (formSourceId && l.formSourceId !== formSourceId) return false;
  for (const f of FILTRES) if (actifs.has(f.id) && !f.test(l)) return false;
  return true;
}
