import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Les outils de LECTURE de l'assistant — lot 1.
 *
 * Aucun n'écrit quoi que ce soit. Les outils d'écriture viendront au lot 4,
 * avec leur aperçu : rien ne doit toucher la base avant que le reste soit
 * éprouvé.
 *
 * Chaque outil rend du TEXTE lisible et non du JSON brut : le modèle raisonne
 * mieux sur « Ahmed Ben Salah · 92 · a cliqué la vidéo » que sur un objet, et
 * ça divise par trois le nombre de jetons.
 */

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "chercher_leads",
    description:
      "Trouve des leads selon des critères. Utilise-le d'abord pour obtenir un identifiant avant d'appeler les autres outils. Rend au maximum 40 lignes, MAIS annonce toujours le nombre total correspondant — sers-t'en pour répondre aux questions de comptage.",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Une partie du nom ou de l'email." },
        colonne: { type: "string", description: "Nom exact de la colonne, ex. « Nouveau », « Intéressé »." },
        formation: { type: "string", description: "Une partie du nom de la formation." },
        tag: { type: "string", description: "Nom exact d'un tag, ex. « Spacer »." },
        demande_rappel: { type: "boolean", description: "true = a coché « rappelez-moi »." },
        jamais_appele: { type: "boolean", description: "true = aucun appel enregistré." },
        a_clique: { type: "boolean", description: "true = a cliqué un lien dans un email." },
        inscrit: { type: "boolean", description: "true = déjà inscrit, false = pas encore." },
        limite: { type: "number", description: "Entre 1 et 40. Par défaut 20." },
      },
    },
  },
  {
    name: "fiche_lead",
    description: "Tout ce qu'on sait d'un lead : coordonnées, formation, colonne, offre, motivation, qualification, engagement.",
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string" } },
      required: ["leadId"],
    },
  },
  {
    name: "historique_lead",
    description: "La chronologie complète d'un lead : arrivée, changements de colonne, appels, emails, ouvertures, clics, paiements.",
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string" } },
      required: ["leadId"],
    },
  },
  {
    name: "file_appels",
    description:
      "Qui rappeler et dans quel ordre, avec le score et les raisons de sa place. C'est la réponse à « qui je dois appeler aujourd'hui ».",
    input_schema: {
      type: "object",
      properties: { limite: { type: "number", description: "Entre 1 et 40. Par défaut 15." } },
    },
  },
  {
    name: "stats_formation",
    description:
      "Les chiffres d'une formation : leads, demandes de rappel, appels, inscrits, répartition par colonne, délais, argent, emails.",
    input_schema: {
      type: "object",
      properties: { formation: { type: "string", description: "Une partie du nom de la formation." } },
      required: ["formation"],
    },
  },
  {
    name: "lecture_ia_lead",
    description: "L'analyse déjà faite sur un lead : résumé, intention, frein, recommandation. Vide si le lead n'a jamais été analysé.",
    input_schema: {
      type: "object",
      properties: { leadId: { type: "string" } },
      required: ["leadId"],
    },
  },
];

type Args = Record<string, unknown>;
const str = (a: Args, k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
const bool = (a: Args, k: string) => (typeof a[k] === "boolean" ? (a[k] as boolean) : undefined);
const num = (a: Args, k: string, d: number, max: number) => {
  const n = Number(a[k]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), max) : d;
};

export async function runTool(name: string, args: Args): Promise<string> {
  switch (name) {
    case "chercher_leads":
      return chercherLeads(args);
    case "fiche_lead":
      return ficheLead(str(args, "leadId") ?? "");
    case "historique_lead":
      return historiqueLead(str(args, "leadId") ?? "");
    case "file_appels":
      return fileAppels(num(args, "limite", 15, 40));
    case "stats_formation":
      return statsFormation(str(args, "formation") ?? "");
    case "lecture_ia_lead":
      return lectureIa(str(args, "leadId") ?? "");
    default:
      return `Outil inconnu : ${name}`;
  }
}

async function chercherLeads(a: Args): Promise<string> {
  const conds = [sql`true`];
  const nom = str(a, "nom");
  if (nom) conds.push(sql`(l.full_name ilike ${"%" + nom + "%"} or l.email ilike ${"%" + nom + "%"})`);
  const colonne = str(a, "colonne");
  if (colonne) conds.push(sql`s.name ilike ${colonne}`);
  const formation = str(a, "formation");
  if (formation) conds.push(sql`b.name ilike ${"%" + formation + "%"}`);
  const tag = str(a, "tag");
  if (tag) {
    conds.push(sql`exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id
                            where lt.lead_id = l.id and t.name ilike ${tag})`);
  }
  if (bool(a, "demande_rappel") === true) conds.push(sql`l.wants_call`);
  if (bool(a, "demande_rappel") === false) conds.push(sql`coalesce(l.wants_call, false) = false`);
  if (bool(a, "inscrit") === true) conds.push(sql`l.converted`);
  if (bool(a, "inscrit") === false) conds.push(sql`not l.converted`);
  if (bool(a, "jamais_appele") === true) {
    conds.push(sql`not exists (select 1 from call_logs c
                                where c.reference_type = 'lead' and c.reference_id = l.id)`);
  }
  if (bool(a, "a_clique") === true) {
    conds.push(sql`exists (select 1 from automation_runs r
                            where r.lead_id = l.id and r.clicked_at is not null)`);
  }

  const rows = await db.execute<{
    id: string; nom: string | null; tel: string | null; colonne: string | null;
    formation: string | null; jours: number; veut: boolean; clique: boolean; appele: boolean;
  }>(sql`
    select l.id, l.full_name as nom, l.mobile_no as tel, s.name as colonne, b.name as formation,
           extract(day from now() - coalesce(l.stage_entered_at, l.created_at))::int as jours,
           coalesce(l.wants_call, false) as veut,
           exists (select 1 from automation_runs r where r.lead_id = l.id and r.clicked_at is not null) as clique,
           exists (select 1 from call_logs c where c.reference_type = 'lead' and c.reference_id = l.id) as appele
      from leads l
      left join lead_statuses s on s.id = l.status_id
      left join bootcamps b on b.id = l.bootcamp_id
     where ${sql.join(conds, sql` and `)}
     order by l.created_at desc
     limit ${num(a, "limite", 20, 40)}
  `);

  // Le TOTAL, pas seulement la page : sans lui, le modèle répondait « au moins
  // 40, la liste est tronquée » à une simple question de comptage.
  const [{ total }] = await db.execute<{ total: number }>(sql`
    select count(*)::int as total
      from leads l
      left join lead_statuses s on s.id = l.status_id
      left join bootcamps b on b.id = l.bootcamp_id
     where ${sql.join(conds, sql` and `)}
  `);

  if (total === 0) return "Aucun lead ne correspond.";
  return [
    total > rows.length
      ? `${total} leads correspondent. Voici les ${rows.length} plus récents :`
      : `${total} lead(s) :`,
    ...rows.map((r) =>
      [
        `${r.nom ?? "sans nom"} (id ${r.id})`,
        r.tel ?? "pas de téléphone",
        r.colonne ?? "sans colonne",
        `${r.jours} j sur place`,
        r.veut ? "a demandé un rappel" : null,
        r.clique ? "a cliqué un email" : null,
        r.appele ? null : "jamais appelé",
      ]
        .filter(Boolean)
        .join(" · ")
    ),
  ].join("\n");
}

async function ficheLead(leadId: string): Promise<string> {
  if (!leadId) return "Identifiant manquant.";
  const rows = await db.execute<Record<string, unknown>>(sql`
    select l.full_name, l.email, l.mobile_no, l.job_title, l.motivation,
           l.intended_plan, l.promo_code, l.wants_call, l.qualification,
           l.next_follow_up_at, l.converted, l.offer_total, l.offer_monthly_count,
           l.offer_monthly_amount, l.created_at,
           s.name as colonne, b.name as formation, fs.name as source,
           (select count(*)::int from call_logs c
             where c.reference_type = 'lead' and c.reference_id = l.id) as appels,
           (select count(*)::int from automation_runs r
             where r.lead_id = l.id and r.opened_at is not null) as ouvertures,
           (select count(*)::int from automation_runs r
             where r.lead_id = l.id and r.clicked_at is not null) as clics
      from leads l
      left join lead_statuses s on s.id = l.status_id
      left join bootcamps b on b.id = l.bootcamp_id
      left join form_sources fs on fs.id = l.form_source_id
     where l.id = ${leadId}
  `);
  const r = rows[0];
  if (!r) return "Lead introuvable.";

  const l = (k: string, v: unknown) => (v === null || v === undefined || v === "" ? null : `${k} : ${v}`);
  return [
    l("Nom", r.full_name),
    l("Email", r.email),
    l("Téléphone", r.mobile_no),
    l("Métier", r.job_title),
    l("Formation", r.formation),
    l("Colonne", r.colonne),
    l("Source", r.source),
    r.wants_call ? "A demandé à être rappelé" : null,
    l("Qualification", r.qualification),
    l("Prochaine relance", r.next_follow_up_at),
    l("Formule envisagée", r.intended_plan === "total" ? "comptant" : r.intended_plan === "monthly" ? "en plusieurs fois" : null),
    l("Offre négociée (total)", r.offer_total),
    r.offer_monthly_count ? `Offre négociée : ${r.offer_monthly_count} × ${r.offer_monthly_amount}` : null,
    l("Code promo", r.promo_code),
    r.converted ? "INSCRIT" : "Pas encore inscrit",
    `Appels : ${r.appels} · ouvertures d'email : ${r.ouvertures} · clics : ${r.clics}`,
    l("Motivation écrite", r.motivation),
  ]
    .filter(Boolean)
    .join("\n");
}

async function historiqueLead(leadId: string): Promise<string> {
  if (!leadId) return "Identifiant manquant.";
  const { getLeadTimeline } = await import("@/lib/queries");
  const events = await getLeadTimeline(leadId);
  if (events.length === 0) return "Aucun événement.";
  return events
    .slice(0, 40)
    .map((e) => {
      const d = new Date(e.at).toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      return `${d} — ${e.label}${e.detail ? ` (${e.detail})` : ""}${e.actor ? ` [${e.actor}]` : ""}`;
    })
    .join("\n");
}

async function fileAppels(limite: number): Promise<string> {
  const { getCallQueue } = await import("@/lib/queries");
  const q = await getCallQueue(limite);
  if (q.length === 0) return "La file d'appels est vide.";
  return q
    .map((l, i) =>
      `${i + 1}. ${l.fullName ?? "sans nom"} (id ${l.id}) · ${l.mobileNo ?? "pas de téléphone"} · score ${l.score} · ${l.reasons.join(", ")}`
    )
    .join("\n");
}

async function statsFormation(nom: string): Promise<string> {
  const found = await db.execute<{ id: string; name: string }>(sql`
    select id, name from bootcamps where name ilike ${"%" + nom + "%"} and archived_at is null limit 1
  `);
  const b = found[0];
  if (!b) return `Aucune formation ne correspond à « ${nom} ».`;

  const { getFormationStats } = await import("@/lib/queries");
  const { detectGaps } = await import("@/lib/stats-gaps");
  const s = await getFormationStats(b.id);
  const gaps = detectGaps(s);

  return [
    `Formation : ${b.name}`,
    `${s.socle.leads} leads · ${s.socle.veulentAppel} ont demandé un rappel · ${s.socle.appels} appels passés · ${s.socle.inscrits} inscrits`,
    `Colonnes : ${s.colonnes.map((c) => `${c.name} ${c.n}`).join(", ")}`,
    s.delais
      ? `Arrivée → inscription : ${s.delais.min} j au plus rapide, ${s.delais.moyen} j en moyenne, ${s.delais.max} j au plus lent (sur ${s.delais.surCombien} inscrits)`
      : "Aucune inscription pour l'instant.",
    `7 derniers jours : ${s.rythme.map((r) => `${r.jour} ${r.arrivees}↓/${r.appels}☎`).join(" ")}`,
    `Argent : ${s.argent.encaisse} encaissés, ${s.argent.reste} restant, ${s.argent.enRetard} en retard`,
    `Emails : ${s.emails.envoyes} envoyés, ${s.emails.ouverts} ouverts, ${s.emails.cliques} cliqués`,
    gaps.length ? `Écarts détectés : ${gaps.map((g) => g.constat).join(" | ")}` : "Aucun écart détecté.",
  ].join("\n");
}

async function lectureIa(leadId: string): Promise<string> {
  if (!leadId) return "Identifiant manquant.";
  const { getInsightForLead } = await import("@/lib/queries");
  const i = await getInsightForLead(leadId);
  if (!i) return "Ce lead n'a jamais été analysé par l'IA.";
  return [
    `Résumé : ${i.summary}`,
    `Intention : ${i.intent}`,
    i.objection ? `Frein : ${i.objection}` : null,
    i.recommendation ? `Recommandation : ${i.recommendation}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
