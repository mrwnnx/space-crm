import type { FormationStats } from "@/lib/queries";
import { actorName } from "@/lib/actors";

/**
 * Les écarts d'une formation — la couche qui décide s'il y a un problème.
 *
 * ⚠️ C'est une RÈGLE qui décide, pas l'IA. L'inverse — demander à un modèle
 * « ce chiffre est-il bon ? » — produit du conseil générique et invente des
 * problèmes là où il n'y en a pas. Ici l'IA n'écrit que le « quoi faire », à
 * partir de faits qu'elle reçoit tout cuits : elle ne peut pas se tromper sur
 * les chiffres.
 *
 * Module neutre : lu par l'écran (pour afficher la pastille) ET par l'action
 * serveur (pour nourrir le modèle).
 */

export type GapBlock = "rythme" | "colonnes" | "temps" | "argent" | "emails";

export type Gap = {
  block: GapBlock;
  /** Le constat, en une phrase, construit sur les chiffres. Affiché tel quel. */
  constat: string;
  /** Les faits bruts passés au modèle — jamais de phrase rédigée ici. */
  faits: string[];
  /** Ce que le panneau ira chercher comme liste de gens. `null` = pas de liste. */
  cibles: "jamais_appeles" | "colonne_bloquante" | "colonne_lente" | "paiements" | null;
  /** Précision pour la requête de cibles (nom de colonne, par exemple). */
  cibleArg?: string;
};

const pc = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function detectGaps(s: FormationStats): Gap[] {
  const gaps: Gap[] = [];

  // ── 1. Le rythme : est-ce qu'on traite ce qui entre ?
  const arrivees = s.rythme.reduce((a, r) => a + r.arrivees, 0);
  const appels = s.rythme.reduce((a, r) => a + r.appels, 0);
  const joursSansAppel = s.rythme.filter((r) => r.appels === 0).length;
  if (arrivees > 0 && appels < arrivees / 3) {
    const aboutis = s.gens.reduce((a, g) => a + g.aboutis, 0);
    gaps.push({
      block: "rythme",
      constat:
        `${arrivees} leads entrés, ${appels} appels passés sur 7 jours.` +
        (joursSansAppel > 0 ? ` ${joursSansAppel} journée${joursSansAppel > 1 ? "s" : ""} sans un seul appel.` : ""),
      faits: [
        `${arrivees} leads sont entrés en 7 jours, ${appels} appels ont été passés.`,
        `${joursSansAppel} journée(s) sur 7 sans aucun appel.`,
        `${s.socle.veulentAppel} personnes ont explicitement demandé à être rappelées.`,
        s.socle.appels > 0
          ? `Sur ${s.socle.appels} appels passés en tout, ${aboutis} ont abouti (${pc(aboutis, s.socle.appels)} %).`
          : "Aucun appel passé sur cette formation.",
        // Le NOM et pas l'adresse : « hello@thespace.academy, 10 chacun »
        // ressortait tel quel dans le conseil.
        ...s.gens
          .filter((g) => g.actor)
          .map((g) => `${actorName(g.actor)} : ${g.appels} appels, ${g.aboutis} aboutis, ${g.deplacements} déplacements.`),
      ],
      cibles: "jamais_appeles",
    });
  }

  // ── 2. Une colonne retient plus de la moitié des leads.
  const plusGrosse = [...s.colonnes].sort((a, b) => b.n - a.n)[0];
  if (plusGrosse && s.socle.leads > 0 && plusGrosse.n / s.socle.leads > 0.5) {
    gaps.push({
      block: "colonnes",
      constat: `${plusGrosse.n} leads sur ${s.socle.leads} n'ont jamais quitté « ${plusGrosse.name} ». Le goulot n'est pas dans la pipeline, il est à son entrée.`,
      faits: [
        `${plusGrosse.n} leads sur ${s.socle.leads} (${pc(plusGrosse.n, s.socle.leads)} %) sont bloqués dans la colonne « ${plusGrosse.name} ».`,
        `Répartition complète : ${s.colonnes.map((c) => `${c.name} ${c.n}`).join(", ")}.`,
        `${s.socle.inscrits} inscrits au total.`,
      ],
      cibles: "colonne_bloquante",
      cibleArg: plusGrosse.name,
    });
  }

  // ── 3. Le goulot de durée : la colonne la plus TRAVERSÉE, pas la plus lente.
  //     Une colonne qui retient 5 jours mais 5 fois ne coûte presque rien.
  const traversee = [...s.sejours].sort((a, b) => b.passages - a.passages)[0];
  if (traversee && traversee.mediane > 3) {
    gaps.push({
      block: "temps",
      constat: `« ${traversee.name} » retient ${String(traversee.mediane).replace(".", ",")} jours, ${traversee.passages} fois — c'est le nombre de passages qui compte, pas la durée seule.`,
      faits: [
        `La colonne « ${traversee.name} » retient les leads ${traversee.mediane} jours en médiane, sur ${traversee.passages} passages.`,
        `Séjours médians : ${s.sejours.map((x) => `${x.name} ${x.mediane} j (${x.passages}×)`).join(", ")}.`,
        s.delais
          ? `De l'arrivée à l'inscription : ${s.delais.min} j au plus rapide, ${s.delais.moyen} j en moyenne, ${s.delais.max} j au plus lent — sur ${s.delais.surCombien} inscrits seulement.`
          : "Aucune inscription pour l'instant.",
      ],
      cibles: "colonne_lente",
      cibleArg: traversee.name,
    });
  }

  // ── 4. L'argent : du retard, ou des encaissements sans preuve.
  if (s.argent.enRetard > 0 || s.argent.sansJustificatif > 0) {
    gaps.push({
      block: "argent",
      constat:
        s.argent.enRetard > 0
          ? `${s.argent.enRetard} échéance${s.argent.enRetard > 1 ? "s" : ""} en retard, ${s.argent.reste.toLocaleString("fr-FR")} restant à devoir.`
          : `${s.argent.sansJustificatif} encaissement${s.argent.sansJustificatif > 1 ? "s" : ""} sans justificatif.`,
      faits: [
        `${s.argent.encaisse} encaissés, ${s.argent.reste} restant à devoir.`,
        `${s.argent.enRetard} échéance(s) dépassée(s) et non payée(s).`,
        `${s.argent.sansJustificatif} encaissement(s) enregistré(s) sans justificatif déposé.`,
        `Par moyen de paiement : ${s.argent.parMoyen.map((m) => `${m.method ?? "non renseigné"} ${m.n}`).join(", ")}.`,
      ],
      cibles: "paiements",
    });
  }

  // ── 5. Les emails : une ouverture basse est un problème de distribution,
  //      pas de texte. Pas de liste de gens à appeler ici.
  if (s.emails.envoyes >= 10 && pc(s.emails.ouverts, s.emails.envoyes) < 15) {
    gaps.push({
      block: "emails",
      constat: `${pc(s.emails.ouverts, s.emails.envoyes)} % d'ouverture sur ${s.emails.envoyes} envois. En dessous de 15 %, c'est la délivrabilité qu'il faut regarder avant le texte.`,
      faits: [
        `${s.emails.envoyes} emails d'automatisation envoyés, ${s.emails.ouverts} ouverts (${pc(s.emails.ouverts, s.emails.envoyes)} %), ${s.emails.cliques} cliqués.`,
        s.emails.liens.length
          ? `Liens cliqués : ${s.emails.liens.map((l) => `${l.url} (${l.n})`).join(", ")}.`
          : "Aucun lien cliqué.",
        "IMPORTANT — déjà vérifié, ne le propose pas : SPF, DKIM et DMARC sont configurés et validés, le domaine d'envoi est authentifié, et neuf tests ont établi que la cause est l'onglet Promotions de Gmail, pas la délivrabilité technique.",
        "Ce qui a été mesuré sur neuf envois réels : un email en derija (lettres arabes) tombe dans Promotions quoi qu'on fasse, même sans lien ni bouton ; le même en français arrive en Principal. L'automatisation est passée au français il y a deux jours seulement, donc la plupart des envois comptés ici sont encore de l'ancienne version.",
      ],
      cibles: null,
    });
  }

  return gaps;
}

export function gapFor(gaps: Gap[], block: GapBlock): Gap | undefined {
  return gaps.find((g) => g.block === block);
}
