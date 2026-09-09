/**
 * « Ce que je ferais à ta place » — déduit des faits, sans appeler l'IA.
 *
 * Module NEUTRE (ni "use client" ni "server-only") : l'écran de la fiche et le
 * serveur l'utilisent tous les deux. Une constante exportée depuis un fichier
 * "use client" arrive `undefined` dans un composant serveur en Next 16, et ni
 * `tsc` ni `next build` ne le voient.
 *
 * Cette recommandation existe même sans clé Anthropic valide. La recommandation
 * écrite par l'IA, quand elle existe, s'affiche à côté — elle ne la remplace pas.
 */

export type LeadFacts = {
  /** Colonne terminale : plus rien à faire côté vente. */
  converted: boolean;
  lost: boolean;
  /** Qualification posée par un humain après un appel. */
  qualification: string | null;
  /** Rappel programmé, s'il existe. */
  nextFollowUpAt: Date | string | null;
  /** A cliqué un lien dans un email reçu. */
  clicked: boolean;
  /** Le lien cliqué était la vidéo. */
  clickedVideo: boolean;
  /** A demandé à être rappelé en téléchargeant la brochure. */
  wantsCall: boolean;
  /** A rempli brochure PUIS inscription. */
  multiForm: boolean;
  lastCallAt: Date | string | null;
  lastCallStatus: string | null;
  /** Le frein lu par l'IA, s'il y en a un. */
  objection: string | null;
  /** Jours passés dans la colonne actuelle. */
  stageDays: number;
  unsubscribed: boolean;
  bounced: boolean;
  hasPhone: boolean;
};

export type Recommendation = {
  /** L'action, à l'impératif. Une phrase. */
  action: string;
  /** Les faits qui l'ont dictée, dans l'ordre où ils pèsent. */
  because: string[];
  /** Teinte de l'écran : ce qu'il faut faire tout de suite, ou pas. */
  tone: "now" | "soon" | "wait" | "stop";
};

const days = (d: Date | string | null): number | null =>
  d === null ? null : Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

/**
 * Les règles sont ordonnées : la PREMIÈRE qui s'applique gagne.
 *
 * C'est volontaire — un lead qui a cliqué ET qu'on vient d'appeler ne doit pas
 * être rappelé le lendemain, quelle que soit sa chaleur.
 */
export function recommend(f: LeadFacts): Recommendation {
  const since = days(f.lastCallAt);

  if (f.converted) {
    return {
      action: "Rien à faire ici — il est inscrit.",
      because: ["déjà converti"],
      tone: "stop",
    };
  }

  if (f.lost) {
    return {
      action: "Laisse-le. Rouvre seulement s'il revient de lui-même.",
      because: ["marqué perdu"],
      tone: "stop",
    };
  }

  if (f.qualification === "hors_cible" || f.qualification === "pas_serieux") {
    return {
      action: "Ne le relance pas : tu l'as déjà écarté au téléphone.",
      because: [f.qualification === "hors_cible" ? "hors cible" : "pas sérieux"],
      tone: "stop",
    };
  }

  if (!f.hasPhone) {
    return {
      action: "Récupère son numéro avant tout : il n'est joignable par rien.",
      because: ["aucun téléphone au dossier"],
      tone: "soon",
    };
  }

  if (f.qualification === "reporte") {
    return {
      action: "Garde-le pour la prochaine session, il te l'a demandé.",
      because: ["reporté à une prochaine session"],
      tone: "wait",
    };
  }

  const due = f.nextFollowUpAt ? new Date(f.nextFollowUpAt).getTime() : null;
  if (due !== null && due <= Date.now()) {
    return {
      action: "Rappelle-le aujourd'hui : c'est le rappel que tu avais fixé.",
      because: ["rappel arrivé à échéance"],
      tone: "now",
    };
  }
  if (due !== null) {
    return {
      action: "N'appelle pas encore — tu as fixé un rappel plus tard.",
      because: ["rappel programmé"],
      tone: "wait",
    };
  }

  // Appelé il y a moins de 3 jours : insister se retourne contre toi.
  if (since !== null && since < 3 && f.lastCallStatus !== "no_answer") {
    const extra = f.clicked
      ? " Il a cliqué dans l'email depuis : garde-le en tête pour la relance."
      : "";
    return {
      action: `Laisse retomber, tu l'as eu il y a ${since === 0 ? "aujourd'hui" : `${since} j`}.${extra}`,
      because: ["appelé récemment"],
      tone: "wait",
    };
  }

  const because: string[] = [];
  if (f.clickedVideo) because.push("a cliqué la vidéo");
  else if (f.clicked) because.push("a cliqué dans l'email");
  if (f.multiForm) because.push("brochure puis inscription");
  if (f.wantsCall) because.push("a demandé à être rappelé");
  if (since === null) because.push("jamais appelé");
  else if (f.lastCallStatus === "no_answer") because.push("n'avait pas répondu");
  if (f.stageDays >= 5) because.push(`${f.stageDays} j sans bouger`);

  // L'angle : par quoi commencer la conversation.
  const angle = f.objection
    ? ` Pars de son frein : ${f.objection}.`
    : f.clickedVideo
      ? " Pars de la vidéo, il l'a ouverte de lui-même."
      : "";

  if (f.clicked && since === null) {
    return {
      action: `Appelle-le maintenant.${angle}`,
      because,
      tone: "now",
    };
  }

  if (f.multiForm || f.wantsCall) {
    return {
      action: `Appelle-le en priorité.${angle}`,
      because,
      tone: "now",
    };
  }

  if (f.clicked) {
    return {
      action: `Relance-le : il a bougé depuis votre dernier échange.${angle}`,
      because,
      tone: "now",
    };
  }

  if (f.unsubscribed || f.bounced) {
    return {
      action: "Passe par le téléphone — l'email ne lui arrive plus.",
      because: [f.unsubscribed ? "désabonné" : "adresse en rebond"],
      tone: "soon",
    };
  }

  if (since === null) {
    return {
      action: `Appelle-le, personne ne l'a encore fait.${angle}`,
      because: because.length ? because : ["jamais appelé"],
      tone: "soon",
    };
  }

  return {
    action: "Rien de neuf de son côté. Passe-le après tes leads actifs.",
    because: because.length ? because : ["aucun signal récent"],
    tone: "wait",
  };
}
